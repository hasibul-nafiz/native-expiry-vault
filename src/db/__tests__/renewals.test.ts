import { addDays, todayLocal } from '@/features/expiry';

import type { Item } from '../models';
import { createItem, getItem, markItemRenewed } from '../repositories/items';
import { createReminderRules, listReminderRulesForItem } from '../repositories/reminderRules';
import { countRenewals, listRenewals } from '../repositories/renewals';
import { createMigratedTestDatabase } from '../testing/betterSqlite3';
import type { Database } from '../types';

/**
 * The renewal flow, against a real migrated database.
 *
 * The property that matters most here is that the history row and the expiry
 * change are one atomic unit — a history that disagrees with the record it
 * describes would be worse than no history.
 */

let db: Database;
let item: Item;

const today = todayLocal();

function at(days: number): string {
  return addDays(today, days);
}

beforeEach(async () => {
  db = await createMigratedTestDatabase();
  item = await createItem(db, {
    title: 'US Passport',
    category: 'passport',
    expiryDate: at(30),
  });
});

afterEach(async () => {
  await db.closeAsync();
});

describe('a single renewal', () => {
  it('moves the expiry date and records when it happened', async () => {
    const renewed = await markItemRenewed(db, item.id, at(3680), today);

    expect(renewed).toMatchObject({ expiryDate: at(3680), renewedAt: today });
  });

  it('captures the previous expiry in the history', async () => {
    const previous = item.expiryDate;

    await markItemRenewed(db, item.id, at(3680), today);

    const history = await listRenewals(db, item.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      itemId: item.id,
      previousExpiryDate: previous,
      newExpiryDate: at(3680),
      renewedOn: today,
      note: null,
    });
  });

  it('stores an optional note', async () => {
    await markItemRenewed(db, item.id, at(3680), today, 'Collected from the consulate');

    const [entry] = await listRenewals(db, item.id);
    expect(entry.note).toBe('Collected from the consulate');
  });

  it('returns null for an item that does not exist, without writing history', async () => {
    await expect(markItemRenewed(db, 'ghost', at(3680), today)).resolves.toBeNull();

    const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM renewals');
    expect(row?.count).toBe(0);
  });
});

describe('reminders after a renewal', () => {
  it('recomputes every fire date against the new expiry', async () => {
    await createReminderRules(db, item.id, item.expiryDate, [30, 7]);

    await markItemRenewed(db, item.id, at(3680), today);

    const rules = await listReminderRulesForItem(db, item.id);
    expect(rules.map((rule) => [rule.offsetDays, rule.fireDate])).toEqual([
      [30, addDays(at(3680), -30)],
      [7, addDays(at(3680), -7)],
    ]);
  });

  it('keeps the reminders themselves, rather than recreating them', async () => {
    const before = await createReminderRules(db, item.id, item.expiryDate, [30, 7]);

    await markItemRenewed(db, item.id, at(3680), today);

    const after = await listReminderRulesForItem(db, item.id);
    expect(after.map((rule) => rule.id)).toEqual(before.map((rule) => rule.id));
  });
});

describe('repeated renewals', () => {
  it('appends rather than overwriting, newest first', async () => {
    await markItemRenewed(db, item.id, at(400), '2026-01-01');
    await markItemRenewed(db, item.id, at(800), '2026-06-01');
    await markItemRenewed(db, item.id, at(1200), '2027-01-01');

    const history = await listRenewals(db, item.id);

    expect(history.map((entry) => entry.renewedOn)).toEqual([
      '2027-01-01',
      '2026-06-01',
      '2026-01-01',
    ]);
    await expect(countRenewals(db, item.id)).resolves.toBe(3);
  });

  it('chains each entry’s previous expiry to the one before it', async () => {
    const original = item.expiryDate;

    await markItemRenewed(db, item.id, at(400), '2026-01-01');
    await markItemRenewed(db, item.id, at(800), '2026-06-01');

    const history = await listRenewals(db, item.id);

    // Newest first: the second renewal started where the first one ended.
    expect(history[0].previousExpiryDate).toBe(at(400));
    expect(history[1].previousExpiryDate).toBe(original);
  });

  it('leaves the item reflecting only the latest renewal', async () => {
    await markItemRenewed(db, item.id, at(400), '2026-01-01');
    await markItemRenewed(db, item.id, at(800), '2026-06-01');

    await expect(getItem(db, item.id)).resolves.toMatchObject({
      expiryDate: at(800),
      renewedAt: '2026-06-01',
    });
  });
});

describe('a failed renewal', () => {
  it('rolls back the history row when the new expiry is not a real date', async () => {
    const before = await getItem(db, item.id);

    await expect(markItemRenewed(db, item.id, '2026-02-30', today)).rejects.toThrow(
      /CHECK constraint/,
    );

    // Neither the item nor the history moved.
    await expect(getItem(db, item.id)).resolves.toEqual(before);
    await expect(countRenewals(db, item.id)).resolves.toBe(0);
  });

  it('rolls back when the renewal date itself is invalid', async () => {
    await expect(markItemRenewed(db, item.id, at(400), '2026-13-01')).rejects.toThrow(
      /CHECK constraint/,
    );

    await expect(countRenewals(db, item.id)).resolves.toBe(0);
    await expect(getItem(db, item.id)).resolves.toMatchObject({ expiryDate: at(30) });
  });

  it('leaves reminder fire dates untouched after a rollback', async () => {
    await createReminderRules(db, item.id, item.expiryDate, [30]);
    const before = await listReminderRulesForItem(db, item.id);

    await expect(markItemRenewed(db, item.id, '2026-02-30', today)).rejects.toThrow();

    await expect(listReminderRulesForItem(db, item.id)).resolves.toEqual(before);
  });
});

describe('history isolation', () => {
  it('keeps each item’s history separate', async () => {
    const other = await createItem(db, {
      title: 'Visa',
      category: 'visa',
      expiryDate: at(60),
    });

    await markItemRenewed(db, item.id, at(400), today);

    await expect(countRenewals(db, item.id)).resolves.toBe(1);
    await expect(countRenewals(db, other.id)).resolves.toBe(0);
  });
});
