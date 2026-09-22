import { statusWindow } from '@/features/expiry/status';
import { addDays, todayLocal } from '@/features/expiry';

import type { Item } from '../models';
import {
  archiveItem,
  countItems,
  countItemsByCategory,
  countItemsByStatus,
  countItemsWithoutReminders,
  createItem,
  getItem,
  getNextExpiringItem,
  listArchivedItems,
  listItems,
  unarchiveItem,
} from '../repositories/items';
import {
  createReminderRules,
  listReminderRulesForItem,
  listSchedulableRules,
} from '../repositories/reminderRules';
import { createMigratedTestDatabase } from '../testing/betterSqlite3';
import type { Database } from '../types';

/**
 * Archiving hides an item from the vault everywhere without destroying it.
 *
 * The risk this guards against is a query that forgets the distinction, so each
 * read path is asserted individually rather than trusting one shared filter.
 */

let db: Database;
let kept: Item;
let archived: Item;

const today = todayLocal();
const window = statusWindow(today);

function at(days: number): string {
  return addDays(today, days);
}

beforeEach(async () => {
  db = await createMigratedTestDatabase();
  kept = await createItem(db, { title: 'US Passport', category: 'passport', expiryDate: at(400) });
  archived = await createItem(db, {
    title: 'Old Visa',
    category: 'visa',
    expiryDate: at(10),
  });
});

afterEach(async () => {
  await db.closeAsync();
});

describe('archiveItem', () => {
  it('stamps when it happened rather than just flagging it', async () => {
    const result = await archiveItem(db, archived.id);

    expect(result?.archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('leaves active items with a null timestamp', async () => {
    await archiveItem(db, archived.id);

    await expect(getItem(db, kept.id)).resolves.toMatchObject({ archivedAt: null });
  });

  it('still returns the item by id, so a deep link to it keeps working', async () => {
    await archiveItem(db, archived.id);

    await expect(getItem(db, archived.id)).resolves.not.toBeNull();
  });
});

describe('what archiving hides', () => {
  beforeEach(async () => {
    await archiveItem(db, archived.id);
  });

  it('removes it from the item list', async () => {
    const items = await listItems(db);

    expect(items.map((item) => item.title)).toEqual(['US Passport']);
  });

  it('removes it from the total count', async () => {
    await expect(countItems(db)).resolves.toBe(1);
  });

  it('removes it from the status counters', async () => {
    // The archived visa expires in 10 days, so it would otherwise be "soon".
    await expect(countItemsByStatus(db, window)).resolves.toEqual({
      safe: 1,
      soon: 0,
      expired: 0,
    });
  });

  it('removes its category from the chip counts', async () => {
    await expect(countItemsByCategory(db)).resolves.toEqual({ passport: 1 });
  });

  it('removes it from the next-expiring lookup', async () => {
    // It expires sooner than the passport, so it would otherwise win.
    const next = await getNextExpiringItem(db, today);

    expect(next?.title).toBe('US Passport');
  });

  it('removes it from the missing-reminders count', async () => {
    await expect(countItemsWithoutReminders(db)).resolves.toBe(1);
  });

  it('is excluded from a filtered list too', async () => {
    await expect(listItems(db, { category: 'visa' })).resolves.toEqual([]);
    await expect(listItems(db, { search: 'Old Visa' })).resolves.toEqual([]);
    await expect(listItems(db, { status: 'soon', window })).resolves.toEqual([]);
  });
});

describe('includeArchived', () => {
  beforeEach(async () => {
    await archiveItem(db, archived.id);
  });

  it('brings archived items back into the list', async () => {
    const items = await listItems(db, { includeArchived: true });

    expect(items.map((item) => item.title).sort()).toEqual(['Old Visa', 'US Passport']);
  });

  it('still honours the other filters', async () => {
    await expect(listItems(db, { category: 'visa', includeArchived: true })).resolves.toHaveLength(
      1,
    );
  });

  it('lists archived items on their own', async () => {
    const items = await listArchivedItems(db);

    expect(items.map((item) => item.title)).toEqual(['Old Visa']);
  });
});

describe('unarchiveItem', () => {
  it('restores the item everywhere', async () => {
    await archiveItem(db, archived.id);
    await expect(countItems(db)).resolves.toBe(1);

    const restored = await unarchiveItem(db, archived.id);

    expect(restored?.archivedAt).toBeNull();
    await expect(countItems(db)).resolves.toBe(2);
    await expect(listArchivedItems(db)).resolves.toEqual([]);
  });

  it('is a no-op on an item that was never archived', async () => {
    await expect(unarchiveItem(db, kept.id)).resolves.toMatchObject({ archivedAt: null });
  });
});

describe('what archiving preserves', () => {
  it('keeps the reminder rules, so unarchiving restores a working item', async () => {
    await createReminderRules(db, archived.id, archived.expiryDate, [7]);

    await archiveItem(db, archived.id);

    // The rules survive; the scheduler is responsible for not firing them.
    await expect(listReminderRulesForItem(db, archived.id)).resolves.toHaveLength(1);
  });

  /**
   * The other half of the same guarantee. The rules are kept, so the queries
   * the scheduler reads must be the thing that excludes them — otherwise an
   * archived document goes on notifying.
   */
  it('hides the rules from the scheduler while keeping them on the item', async () => {
    await createReminderRules(db, kept.id, kept.expiryDate, [7]);
    await createReminderRules(db, archived.id, archived.expiryDate, [7]);

    await archiveItem(db, archived.id);

    const schedulable = await listSchedulableRules(db);

    expect(schedulable.map((rule) => rule.itemId)).toEqual([kept.id]);
  });

  it('returns the rules to the scheduler when the item is unarchived', async () => {
    await createReminderRules(db, archived.id, archived.expiryDate, [7]);
    await archiveItem(db, archived.id);

    await unarchiveItem(db, archived.id);

    const schedulable = await listSchedulableRules(db);

    expect(schedulable.map((rule) => rule.itemId)).toContain(archived.id);
  });
});
