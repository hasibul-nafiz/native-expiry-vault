import type { IsoDate, Item, ReminderRule } from '@/db/models';
import { fireDateFor } from '@/features/expiry';

import { computeReminders, PENDING_BUDGET } from '../computeReminders';

/**
 * The engine takes `now` as an argument, so every case here is a fixed instant
 * rather than a mocked clock.
 */

function makeItem(overrides: Partial<Item> & { id: string; expiryDate: IsoDate }): Item {
  return {
    title: `Document ${overrides.id}`,
    category: 'passport',
    issuer: null,
    documentNumber: null,
    country: null,
    issueDate: null,
    renewedAt: null,
    isVital: false,
    escalationEnabled: false,
    ocrConfidence: null,
    ocrRawText: null,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRule(overrides: Partial<ReminderRule> & { id: string; itemId: string }): ReminderRule {
  return {
    offsetDays: 30,
    enabled: true,
    fireDate: '2026-11-01',
    deliveredAt: null,
    notificationId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** 2026-09-20, 08:00 local — before the 09:00 delivery hour. */
const NOW = new Date(2026, 8, 20, 8, 0, 0);

describe('computeReminders', () => {
  it('plans nothing for an empty vault', () => {
    expect(computeReminders([], [], NOW)).toEqual({ scheduled: [], deferred: [], stale: [] });
  });

  it('schedules one notification at 09:00 local on the fire date', () => {
    const item = makeItem({ id: 'a', expiryDate: '2026-12-01', title: 'Passport' });
    const rule = makeRule({ id: 'r1', itemId: 'a', fireDate: '2026-11-01', offsetDays: 30 });

    const { scheduled } = computeReminders([item], [rule], NOW);

    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].fireDate).toBe('2026-11-01');
    expect(scheduled[0].fireAt).toEqual(new Date(2026, 10, 1, 9, 0, 0));
    expect(scheduled[0].ruleIds).toEqual(['r1']);
  });

  it('describes a lone document by name, and deep-links to it', () => {
    const item = makeItem({ id: 'a', expiryDate: '2026-12-01', title: 'Passport' });
    const rule = makeRule({ id: 'r1', itemId: 'a', fireDate: '2026-11-01' });

    const [notification] = computeReminders([item], [rule], NOW).scheduled;

    expect(notification.content).toEqual({
      kind: 'single',
      itemId: 'a',
      itemTitle: 'Passport',
      category: 'passport',
      daysUntilExpiry: 30,
    });
    expect(notification.deepLink).toBe('/item/a');
  });

  describe('grouping', () => {
    it('collapses documents sharing a fire date into one digest', () => {
      const items = [
        makeItem({ id: 'a', expiryDate: '2026-12-01' }),
        makeItem({ id: 'b', expiryDate: '2027-01-15' }),
        makeItem({ id: 'c', expiryDate: '2027-03-02' }),
      ];
      const rules = [
        makeRule({ id: 'r1', itemId: 'a', fireDate: '2026-11-01' }),
        makeRule({ id: 'r2', itemId: 'b', fireDate: '2026-11-01' }),
        makeRule({ id: 'r3', itemId: 'c', fireDate: '2026-11-01' }),
      ];

      const { scheduled } = computeReminders(items, rules, NOW);

      expect(scheduled).toHaveLength(1);
      expect(scheduled[0].content).toEqual({ kind: 'digest', count: 3 });
      expect(scheduled[0].deepLink).toBe('/');
      expect(scheduled[0].ruleIds).toEqual(['r1', 'r2', 'r3']);
      expect(scheduled[0].itemIds).toHaveLength(3);
    });

    it('counts one document once when two of its rules land on the same date', () => {
      // A renewal can move the expiry until an older rule sits on a newer one.
      const item = makeItem({ id: 'a', expiryDate: '2026-12-01' });
      const rules = [
        makeRule({ id: 'r1', itemId: 'a', fireDate: '2026-11-01', offsetDays: 30 }),
        makeRule({ id: 'r2', itemId: 'a', fireDate: '2026-11-01', offsetDays: 90 }),
      ];

      const { scheduled } = computeReminders([item], rules, NOW);

      expect(scheduled).toHaveLength(1);
      // One document, but both rules are satisfied by the single send.
      expect(scheduled[0].content).toEqual(expect.objectContaining({ kind: 'single' }));
      expect(scheduled[0].ruleIds).toEqual(['r1', 'r2']);
      expect(scheduled[0].itemIds).toEqual(['a']);
    });

    it('keeps separate dates separate, soonest first', () => {
      const item = makeItem({ id: 'a', expiryDate: '2027-05-01' });
      const rules = [
        makeRule({ id: 'late', itemId: 'a', fireDate: '2027-04-01' }),
        makeRule({ id: 'early', itemId: 'a', fireDate: '2026-11-02' }),
        makeRule({ id: 'mid', itemId: 'a', fireDate: '2027-02-01' }),
      ];

      const { scheduled } = computeReminders([item], rules, NOW);

      expect(scheduled.map((entry) => entry.fireDate)).toEqual([
        '2026-11-02',
        '2027-02-01',
        '2027-04-01',
      ]);
    });
  });

  describe('exclusions', () => {
    it('ignores an archived document entirely', () => {
      const item = makeItem({
        id: 'a',
        expiryDate: '2026-12-01',
        archivedAt: '2026-09-01T00:00:00.000Z',
      });
      const rule = makeRule({ id: 'r1', itemId: 'a', fireDate: '2026-11-01' });

      const plan = computeReminders([item], [rule], NOW);

      expect(plan.scheduled).toEqual([]);
      // Not stale either: the rule is dormant, and unarchiving must revive it.
      expect(plan.stale).toEqual([]);
    });

    it('ignores a disabled rule', () => {
      const item = makeItem({ id: 'a', expiryDate: '2026-12-01' });
      const rule = makeRule({ id: 'r1', itemId: 'a', fireDate: '2026-11-01', enabled: false });

      expect(computeReminders([item], [rule], NOW).scheduled).toEqual([]);
    });

    it('ignores a rule that has already been delivered', () => {
      const item = makeItem({ id: 'a', expiryDate: '2026-12-01' });
      const rule = makeRule({
        id: 'r1',
        itemId: 'a',
        fireDate: '2026-11-01',
        deliveredAt: '2026-11-01T09:00:00.000Z',
      });

      expect(computeReminders([item], [rule], NOW).scheduled).toEqual([]);
    });

    it('drops an orphan rule rather than throwing', () => {
      const rule = makeRule({ id: 'r1', itemId: 'missing', fireDate: '2026-11-01' });

      expect(computeReminders([], [rule], NOW).scheduled).toEqual([]);
    });
  });

  describe('past dates', () => {
    it('marks a rule whose date has passed as stale, never scheduling it', () => {
      const item = makeItem({ id: 'a', expiryDate: '2026-10-01' });
      const rule = makeRule({ id: 'r1', itemId: 'a', fireDate: '2026-09-01' });

      const plan = computeReminders([item], [rule], NOW);

      expect(plan.scheduled).toEqual([]);
      expect(plan.stale).toEqual(['r1']);
    });

    it('still schedules a rule due later today', () => {
      // NOW is 08:00; the 09:00 delivery time has not arrived yet.
      const item = makeItem({ id: 'a', expiryDate: '2026-10-20' });
      const rule = makeRule({ id: 'r1', itemId: 'a', fireDate: '2026-09-20' });

      const plan = computeReminders([item], [rule], NOW);

      expect(plan.scheduled).toHaveLength(1);
      expect(plan.stale).toEqual([]);
    });

    it('treats a rule due earlier today as stale once the hour has passed', () => {
      const item = makeItem({ id: 'a', expiryDate: '2026-10-20' });
      const rule = makeRule({ id: 'r1', itemId: 'a', fireDate: '2026-09-20' });
      const afterDelivery = new Date(2026, 8, 20, 9, 30, 0);

      const plan = computeReminders([item], [rule], afterDelivery);

      expect(plan.scheduled).toEqual([]);
      expect(plan.stale).toEqual(['r1']);
    });

    it('reports an expired document as expiring today rather than in 0 days', () => {
      const item = makeItem({ id: 'a', expiryDate: '2026-11-01' });
      const rule = makeRule({ id: 'r1', itemId: 'a', fireDate: '2026-11-01', offsetDays: 0 });

      const [notification] = computeReminders([item], [rule], NOW).scheduled;

      expect(notification.content).toEqual(
        expect.objectContaining({ kind: 'single', daysUntilExpiry: 0 }),
      );
    });
  });

  describe('the pending budget', () => {
    function manyRules(count: number) {
      const item = makeItem({ id: 'a', expiryDate: '2040-01-01' });
      const rules = Array.from({ length: count }, (_unused, index) =>
        makeRule({
          id: `r${String(index).padStart(3, '0')}`,
          itemId: 'a',
          // One distinct date each, starting well after NOW.
          fireDate: fireDateFor('2040-01-01', 4000 - index),
        }),
      );

      return { item, rules };
    }

    it('schedules at most the budget and defers the rest', () => {
      const { item, rules } = manyRules(PENDING_BUDGET + 20);

      const plan = computeReminders([item], rules, NOW);

      expect(plan.scheduled).toHaveLength(PENDING_BUDGET);
      expect(plan.deferred).toHaveLength(20);
    });

    it('keeps the soonest dates and defers the furthest', () => {
      const { item, rules } = manyRules(PENDING_BUDGET + 20);

      const plan = computeReminders([item], rules, NOW);
      const lastScheduled = plan.scheduled.at(-1);
      const firstDeferred = plan.deferred[0];

      expect(lastScheduled).toBeDefined();
      expect(firstDeferred).toBeDefined();
      expect(lastScheduled?.fireDate.localeCompare(firstDeferred.fireDate)).toBeLessThan(0);
    });

    it('honours an explicit budget', () => {
      const { item, rules } = manyRules(10);

      expect(computeReminders([item], rules, NOW, { budget: 3 }).scheduled).toHaveLength(3);
    });
  });

  /**
   * `items.escalation_enabled` promises "daily alerts once inside the
   * escalation window". These are the terms of that promise.
   */
  describe('escalation', () => {
    function escalating(expiryDate: IsoDate) {
      return makeItem({ id: 'a', expiryDate, escalationEnabled: true, title: 'Visa' });
    }

    it('adds a daily entry through to the expiry date', () => {
      // NOW is 2026-09-20 08:00; expiry three days out.
      const plan = computeReminders([escalating('2026-09-23')], [], NOW, { escalationDays: 14 });

      expect(plan.scheduled.map((entry) => entry.fireDate)).toEqual([
        '2026-09-20',
        '2026-09-21',
        '2026-09-22',
        '2026-09-23',
      ]);
    });

    it('starts no earlier than today for a document already inside the window', () => {
      const plan = computeReminders([escalating('2026-09-22')], [], NOW, { escalationDays: 14 });

      expect(plan.scheduled[0].fireDate).toBe('2026-09-20');
    });

    it('skips today once the delivery hour has passed', () => {
      const afterDelivery = new Date(2026, 8, 20, 9, 30, 0);

      const plan = computeReminders([escalating('2026-09-22')], [], afterDelivery, {
        escalationDays: 14,
      });

      expect(plan.scheduled.map((entry) => entry.fireDate)).toEqual([
        '2026-09-21',
        '2026-09-22',
      ]);
    });

    it('carries no rule ids, because no rule backs it', () => {
      const plan = computeReminders([escalating('2026-09-22')], [], NOW, { escalationDays: 14 });

      expect(plan.scheduled.every((entry) => entry.ruleIds.length === 0)).toBe(true);
    });

    it('ignores a document with the flag off', () => {
      const item = makeItem({ id: 'a', expiryDate: '2026-09-22', escalationEnabled: false });

      expect(computeReminders([item], [], NOW, { escalationDays: 14 }).scheduled).toEqual([]);
    });

    it('ignores an archived document', () => {
      const item = makeItem({
        id: 'a',
        expiryDate: '2026-09-22',
        escalationEnabled: true,
        archivedAt: '2026-09-01T00:00:00.000Z',
      });

      expect(computeReminders([item], [], NOW, { escalationDays: 14 }).scheduled).toEqual([]);
    });

    it('does not nag after expiry', () => {
      const item = escalating('2026-09-10');

      expect(computeReminders([item], [], NOW, { escalationDays: 14 }).scheduled).toEqual([]);
    });

    /**
     * The budget guard. A document expiring in a year would otherwise book
     * fourteen slots for alerts nothing can miss — the schedule is rebuilt on
     * every launch, resume and edit.
     */
    it('does not book a window that is still far away', () => {
      const plan = computeReminders([escalating('2027-12-01')], [], NOW, { escalationDays: 14 });

      expect(plan.scheduled).toEqual([]);
    });

    it('books a window that is about to begin', () => {
      // 20 days out, inside the one-window lookahead for a 14-day window.
      const plan = computeReminders([escalating('2026-10-10')], [], NOW, { escalationDays: 14 });

      expect(plan.scheduled[0].fireDate).toBe('2026-09-27');
      expect(plan.scheduled.at(-1)?.fireDate).toBe('2026-10-10');
    });

    it('merges with a rule landing on the same day rather than sending twice', () => {
      const item = escalating('2026-09-22');
      const rule = makeRule({ id: 'r1', itemId: 'a', fireDate: '2026-09-21' });

      const plan = computeReminders([item], [rule], NOW, { escalationDays: 14 });

      const shared = plan.scheduled.find((entry) => entry.fireDate === '2026-09-21');
      expect(shared?.itemIds).toEqual(['a']);
      expect(shared?.ruleIds).toEqual(['r1']);
      expect(shared?.content).toEqual(expect.objectContaining({ kind: 'single' }));
    });

    it('groups two escalating documents on the same day into one digest', () => {
      const items = [
        makeItem({ id: 'a', expiryDate: '2026-09-21', escalationEnabled: true, title: 'Visa' }),
        makeItem({ id: 'b', expiryDate: '2026-09-21', escalationEnabled: true, title: 'Permit' }),
      ];

      const plan = computeReminders(items, [], NOW, { escalationDays: 14 });

      expect(plan.scheduled).toHaveLength(2);
      expect(plan.scheduled[0].content).toEqual({ kind: 'digest', count: 2 });
    });

    it('can be switched off entirely', () => {
      const plan = computeReminders([escalating('2026-09-22')], [], NOW, { escalationDays: 0 });

      expect(plan.scheduled).toEqual([]);
    });
  });

  it('honours an explicit delivery hour', () => {
    const item = makeItem({ id: 'a', expiryDate: '2026-12-01' });
    const rule = makeRule({ id: 'r1', itemId: 'a', fireDate: '2026-11-01' });

    const [notification] = computeReminders([item], [rule], NOW, { hour: 18 }).scheduled;

    expect(notification.fireAt).toEqual(new Date(2026, 10, 1, 18, 0, 0));
  });

  it('produces an identical plan from identical input, so a repeat sync converges', () => {
    const items = [
      makeItem({ id: 'b', expiryDate: '2027-01-15', title: 'Visa' }),
      makeItem({ id: 'a', expiryDate: '2026-12-01', title: 'Passport' }),
    ];
    const rules = [
      makeRule({ id: 'r2', itemId: 'b', fireDate: '2026-11-01' }),
      makeRule({ id: 'r1', itemId: 'a', fireDate: '2026-11-01' }),
    ];

    const first = computeReminders(items, rules, NOW);
    const second = computeReminders([...items].reverse(), [...rules].reverse(), NOW);

    expect(second).toEqual(first);
  });
});
