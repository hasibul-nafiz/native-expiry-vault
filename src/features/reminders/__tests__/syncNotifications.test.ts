import type { Item } from '@/db/models';
import { archiveItem, createItem, deleteItem, updateItem } from '@/db/repositories/items';
import {
  createReminderRules,
  listReminderRulesForItem,
  markReminderDelivered,
} from '@/db/repositories/reminderRules';
import { createMigratedTestDatabase } from '@/db/testing/betterSqlite3';
import type { Database } from '@/db/types';
import { addDays, atLocalTime, todayLocal } from '@/features/expiry';
import type {
  NotificationPort,
  PermissionState,
  ScheduledSummary,
} from '@/services/notifications';

import type { PlannedNotification } from '../computeReminders';
import { syncNotifications } from '../syncNotifications';

/**
 * The orchestration, against a real migrated database and a fake port.
 *
 * Real SQL matters here: the archived-item exclusion is enforced by a join, and
 * mocking the repository would test the mock instead of the query.
 */

let db: Database;

const today = todayLocal();

function at(days: number): string {
  return addDays(today, days);
}

/**
 * Midday today, so the 09:00 delivery hour has already passed. Without a fixed
 * clock the escalation cases would include or exclude today depending on what
 * time the suite happened to run.
 */
const NOON = atLocalTime(today, 12);

class FakePort implements NotificationPort {
  permission: PermissionState = 'granted';
  scheduled: PlannedNotification[] = [];
  cancelCount = 0;
  failOnSchedule: number | null = null;
  private nextId = 0;

  async getPermission() {
    return this.permission;
  }

  async requestPermission() {
    return this.permission;
  }

  async schedule(plan: PlannedNotification) {
    if (this.failOnSchedule === this.scheduled.length) {
      throw new Error('scheduling failed');
    }

    this.scheduled.push(plan);
    this.nextId += 1;

    return `notification-${this.nextId}`;
  }

  async cancelAll() {
    this.cancelCount += 1;
    this.scheduled = [];
  }

  async listScheduled(): Promise<ScheduledSummary[]> {
    return this.scheduled.map((plan, index) => ({
      identifier: `notification-${index + 1}`,
      title: plan.fireDate,
      fireAt: plan.fireAt,
    }));
  }
}

let port: FakePort;

/**
 * Escalation is off unless a test is about escalation: it adds a daily entry
 * per remaining day, which would otherwise drown the rule-scheduling
 * assertions in noise.
 */
async function addDocument(
  title: string,
  expiryInDays: number,
  offsets: number[],
  escalationEnabled = false,
): Promise<Item> {
  const item = await createItem(db, {
    title,
    category: 'passport',
    expiryDate: at(expiryInDays),
    escalationEnabled,
  });
  await createReminderRules(db, item.id, item.expiryDate, offsets);

  return item;
}

beforeEach(async () => {
  db = await createMigratedTestDatabase();
  port = new FakePort();
});

afterEach(async () => {
  await db.closeAsync();
});

describe('syncNotifications', () => {
  it('schedules nothing and reports the refusal without permission', async () => {
    await addDocument('Passport', 400, [180, 30]);
    port.permission = 'denied';

    const outcome = await syncNotifications(db, port);

    expect(outcome.permission).toBe('denied');
    expect(outcome.scheduled).toBe(0);
    expect(port.cancelCount).toBe(0);
  });

  it('leaves the rules intact when permission is missing, so granting later catches up', async () => {
    const item = await addDocument('Passport', 400, [180, 30]);
    port.permission = 'denied';

    await syncNotifications(db, port);
    const afterDenial = await listReminderRulesForItem(db, item.id);
    expect(afterDenial.every((rule) => rule.deliveredAt === null)).toBe(true);

    port.permission = 'granted';
    const outcome = await syncNotifications(db, port);

    expect(outcome.permission).toBe('granted');
    expect(outcome.scheduled).toBe(2);
  });

  it('writes the notification id onto every rule in a digest', async () => {
    // Both documents expire on the same day, so both 30-day rules share a date.
    const first = await addDocument('Passport', 400, [30]);
    const second = await addDocument('Visa', 400, [30]);

    await syncNotifications(db, port);

    const firstRules = await listReminderRulesForItem(db, first.id);
    const secondRules = await listReminderRulesForItem(db, second.id);

    expect(port.scheduled).toHaveLength(1);
    expect(firstRules[0].notificationId).toBe('notification-1');
    // The same handle: one notification satisfies both rules.
    expect(secondRules[0].notificationId).toBe('notification-1');
  });

  it('marks past-dated rules delivered rather than firing them late', async () => {
    const item = await createItem(db, {
      title: 'Expired visa',
      category: 'visa',
      expiryDate: at(5),
      escalationEnabled: false,
    });
    // A 30-day rule on a document 5 days from expiry fires 25 days ago.
    await createReminderRules(db, item.id, item.expiryDate, [30, 1]);

    const outcome = await syncNotifications(db, port);

    const rules = await listReminderRulesForItem(db, item.id);
    const past = rules.find((rule) => rule.offsetDays === 30);
    const future = rules.find((rule) => rule.offsetDays === 1);

    expect(outcome.stale).toBe(1);
    expect(past?.deliveredAt).not.toBeNull();
    expect(future?.deliveredAt).toBeNull();
    expect(port.scheduled).toHaveLength(1);
  });

  it('does not reconsider a stale rule on the next run', async () => {
    const item = await createItem(db, {
      title: 'Visa',
      category: 'visa',
      expiryDate: at(5),
      escalationEnabled: false,
    });
    await createReminderRules(db, item.id, item.expiryDate, [30]);

    expect((await syncNotifications(db, port)).stale).toBe(1);
    expect((await syncNotifications(db, port)).stale).toBe(0);
  });

  it('cancels everything before rescheduling', async () => {
    await addDocument('Passport', 400, [180, 30]);

    await syncNotifications(db, port);

    expect(port.cancelCount).toBe(1);
    expect(port.scheduled).toHaveLength(2);
  });

  it('converges: a second sync with no changes produces the same set', async () => {
    await addDocument('Passport', 400, [180, 90, 30]);
    await addDocument('Visa', 200, [90, 30]);

    const first = await syncNotifications(db, port);
    const firstDates = port.scheduled.map((plan) => plan.fireDate);

    const second = await syncNotifications(db, port);
    const secondDates = port.scheduled.map((plan) => plan.fireDate);

    expect(second).toEqual(first);
    expect(secondDates).toEqual(firstDates);
  });

  it('drops an archived document from the schedule', async () => {
    const item = await addDocument('Passport', 400, [180, 30]);
    await addDocument('Visa', 300, [30]);

    expect((await syncNotifications(db, port)).scheduled).toBe(3);

    await archiveItem(db, item.id);
    const outcome = await syncNotifications(db, port);

    expect(outcome.scheduled).toBe(1);
    expect(port.scheduled).toHaveLength(1);
  });

  it('clears the stored handle for a rule that is no longer scheduled', async () => {
    const item = await addDocument('Passport', 400, [180, 30]);

    await syncNotifications(db, port);
    expect((await listReminderRulesForItem(db, item.id))[0].notificationId).not.toBeNull();

    await archiveItem(db, item.id);
    await syncNotifications(db, port);

    const rules = await listReminderRulesForItem(db, item.id);
    // Archived: nothing pending, so nothing may claim to be pending.
    expect(rules.every((rule) => rule.notificationId === null)).toBe(true);
  });

  it('schedules nothing for a deleted document', async () => {
    const item = await addDocument('Passport', 400, [180, 30]);
    await deleteItem(db, item.id);

    expect((await syncNotifications(db, port)).scheduled).toBe(0);
  });

  it('ignores rules already delivered', async () => {
    const item = await addDocument('Passport', 400, [180, 30]);
    const rules = await listReminderRulesForItem(db, item.id);
    await markReminderDelivered(db, rules[0].id);

    expect((await syncNotifications(db, port)).scheduled).toBe(1);
  });

  it('reports how far ahead the vault is scheduled', async () => {
    await addDocument('Passport', 400, [180, 30]);

    const outcome = await syncNotifications(db, port);

    expect(outcome.scheduledThrough).toBe(at(370));
  });

  it('reports work deferred beyond the budget', async () => {
    await addDocument('Passport', 400, [180, 90, 30]);

    const outcome = await syncNotifications(db, port, { budget: 2 });

    expect(outcome.scheduled).toBe(2);
    expect(outcome.deferred).toBe(1);
  });

  it('leaves no rule claiming a handle when scheduling fails part way', async () => {
    const item = await addDocument('Passport', 400, [180, 90, 30]);
    port.failOnSchedule = 1;

    await expect(syncNotifications(db, port)).rejects.toThrow('scheduling failed');

    const rules = await listReminderRulesForItem(db, item.id);
    const withHandles = rules.filter((rule) => rule.notificationId !== null);

    // Only the one that genuinely went out; the rest were cleared beforehand.
    expect(withHandles).toHaveLength(1);
  });

  it('schedules a daily alert for an escalating document', async () => {
    // Expires in 3 days with escalation on: today+1, +2, +3.
    await addDocument('Visa', 3, [], true);

    const outcome = await syncNotifications(db, port, { now: NOON });

    expect(outcome.scheduled).toBe(3);
    expect(port.scheduled.map((plan) => plan.fireDate)).toEqual([at(1), at(2), at(3)]);
  });

  it('writes no reminder rows for escalation', async () => {
    const item = await addDocument('Visa', 3, [], true);

    await syncNotifications(db, port, { now: NOON });

    // Synthesised, not stored: turning the flag off must leave nothing behind.
    await expect(listReminderRulesForItem(db, item.id)).resolves.toEqual([]);
  });

  it('stops escalating once the flag is off', async () => {
    const item = await addDocument('Visa', 3, [], true);
    expect((await syncNotifications(db, port, { now: NOON })).scheduled).toBe(3);

    await updateItem(db, item.id, { escalationEnabled: false });

    expect((await syncNotifications(db, port, { now: NOON })).scheduled).toBe(0);
  });

  it('does not escalate an archived document', async () => {
    const item = await addDocument('Visa', 3, [], true);
    await archiveItem(db, item.id);

    expect((await syncNotifications(db, port, { now: NOON })).scheduled).toBe(0);
  });

  it('does not book escalation days for a distant expiry', async () => {
    // Escalation is on, but the window is over a year away; booking it now
    // would claim fourteen slots for alerts nothing will miss.
    await addDocument('Passport', 400, [30], true);

    const outcome = await syncNotifications(db, port, { now: NOON });

    expect(outcome.scheduled).toBe(1);
  });

  it('handles an empty vault', async () => {
    const outcome = await syncNotifications(db, port);

    expect(outcome).toEqual({
      scheduled: 0,
      stale: 0,
      deferred: 0,
      scheduledThrough: null,
      permission: 'granted',
    });
  });
});
