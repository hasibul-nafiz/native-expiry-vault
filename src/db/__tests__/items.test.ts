import { statusWindow } from '@/features/expiry/status';

import type { NewItem } from '../models';
import { createReminderRules, listReminderRulesForItem } from '../repositories/reminderRules';
import {
  countItems,
  countItemsByCategory,
  countItemsByStatus,
  countItemsWithoutReminders,
  createItem,
  deleteItem,
  getItem,
  getNextExpiringItem,
  listItems,
  markItemRenewed,
  updateItem,
} from '../repositories/items';
import { createMigratedTestDatabase } from '../testing/betterSqlite3';
import type { Database } from '../types';

const TODAY = '2026-09-20';
const WINDOW = statusWindow(TODAY);

let db: Database;

beforeEach(async () => {
  db = await createMigratedTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

function passport(overrides: Partial<NewItem> = {}): NewItem {
  return {
    title: 'Passport',
    category: 'passport',
    expiryDate: '2031-05-14',
    ...overrides,
  };
}

describe('createItem', () => {
  it('round-trips every field', async () => {
    const created = await createItem(db, {
      title: 'German Residence Permit',
      category: 'visa',
      issuer: 'Berlin LEA',
      documentNumber: 'DE-9204',
      country: 'DE',
      issueDate: '2022-10-29',
      expiryDate: '2025-10-28',
      isVital: true,
      escalationEnabled: false,
      ocrConfidence: 0.984,
      ocrRawText: 'P<DEU...',
    });

    expect(created).toMatchObject({
      title: 'German Residence Permit',
      category: 'visa',
      issuer: 'Berlin LEA',
      documentNumber: 'DE-9204',
      country: 'DE',
      issueDate: '2022-10-29',
      expiryDate: '2025-10-28',
      renewedAt: null,
      isVital: true,
      escalationEnabled: false,
      ocrConfidence: 0.984,
      ocrRawText: 'P<DEU...',
    });
    expect(created.id).toEqual(expect.any(String));
    await expect(getItem(db, created.id)).resolves.toEqual(created);
  });

  it('applies the documented defaults', async () => {
    const created = await createItem(db, passport());

    expect(created).toMatchObject({
      issuer: null,
      documentNumber: null,
      country: null,
      issueDate: null,
      renewedAt: null,
      isVital: false,
      escalationEnabled: true,
      ocrConfidence: null,
      ocrRawText: null,
    });
  });

  it('gives each item a distinct id', async () => {
    const first = await createItem(db, passport());
    const second = await createItem(db, passport({ title: 'Second' }));

    expect(first.id).not.toBe(second.id);
  });

  it('stamps created and updated together', async () => {
    const created = await createItem(db, passport());

    expect(created.createdAt).toBe(created.updatedAt);
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('propagates a schema rejection rather than writing bad data', async () => {
    await expect(createItem(db, passport({ expiryDate: '2026-02-30' }))).rejects.toThrow(
      /CHECK constraint/,
    );
    await expect(countItems(db)).resolves.toBe(0);
  });
});

describe('getItem', () => {
  it('returns null for an unknown id', async () => {
    await expect(getItem(db, 'nope')).resolves.toBeNull();
  });
});

describe('listItems', () => {
  beforeEach(async () => {
    await createItem(db, passport({ title: 'Passport', expiryDate: '2031-05-14' }));
    await createItem(
      db,
      passport({
        title: 'Residence Permit',
        category: 'visa',
        expiryDate: '2026-10-08',
      }),
    );
    await createItem(
      db,
      passport({
        title: 'Travel Insurance',
        category: 'health',
        expiryDate: '2026-09-01',
      }),
    );
    await createItem(
      db,
      // Inside the 60-day window, which ends on 2026-11-19.
      passport({
        title: 'MacBook Warranty',
        category: 'warranty',
        expiryDate: '2026-11-10',
        issuer: 'Apple',
      }),
    );
  });

  it('orders by expiry date, soonest first', async () => {
    const titles = (await listItems(db)).map((item) => item.title);

    expect(titles).toEqual([
      'Travel Insurance',
      'Residence Permit',
      'MacBook Warranty',
      'Passport',
    ]);
  });

  it('filters by category', async () => {
    const items = await listItems(db, { category: 'visa' });

    expect(items.map((item) => item.title)).toEqual(['Residence Permit']);
  });

  it.each([
    ['expired', ['Travel Insurance']],
    ['soon', ['Residence Permit', 'MacBook Warranty']],
    ['safe', ['Passport']],
  ] as const)('filters by the %s status band', async (status, expected) => {
    const items = await listItems(db, { status, window: WINDOW });

    expect(items.map((item) => item.title)).toEqual(expected);
  });

  it('refuses a status filter without a window', async () => {
    await expect(listItems(db, { status: 'soon' })).rejects.toThrow(/status window/);
  });

  it('searches title and issuer case-insensitively', async () => {
    await expect(listItems(db, { search: 'permit' })).resolves.toHaveLength(1);
    await expect(listItems(db, { search: 'APPLE' })).resolves.toHaveLength(1);
  });

  it('treats LIKE wildcards in a search term as literal characters', async () => {
    await createItem(db, passport({ title: '100% Cotton Warranty' }));

    // Without escaping, '%' would match every row.
    const items = await listItems(db, { search: '100%' });

    expect(items.map((item) => item.title)).toEqual(['100% Cotton Warranty']);
  });

  it('ignores a blank search term', async () => {
    await expect(listItems(db, { search: '   ' })).resolves.toHaveLength(4);
  });

  it('combines filters', async () => {
    const items = await listItems(db, {
      status: 'soon',
      window: WINDOW,
      category: 'warranty',
    });

    expect(items.map((item) => item.title)).toEqual(['MacBook Warranty']);
  });

  it('returns an empty list when nothing matches', async () => {
    await expect(listItems(db, { category: 'license' })).resolves.toEqual([]);
  });
});

describe('updateItem', () => {
  it('changes only the fields it is given', async () => {
    const created = await createItem(db, passport({ issuer: 'Original' }));
    const updated = await updateItem(db, created.id, { title: 'Renamed' });

    expect(updated).toMatchObject({ title: 'Renamed', issuer: 'Original' });
  });

  it('can clear a nullable field', async () => {
    const created = await createItem(db, passport({ issuer: 'Original' }));

    await expect(updateItem(db, created.id, { issuer: null })).resolves.toMatchObject({
      issuer: null,
    });
  });

  it('returns null for an unknown id', async () => {
    await expect(updateItem(db, 'nope', { title: 'x' })).resolves.toBeNull();
  });

  it('is a no-op when given no changes', async () => {
    const created = await createItem(db, passport());

    await expect(updateItem(db, created.id, {})).resolves.toEqual(created);
  });

  it('recomputes every reminder fire date when the expiry moves', async () => {
    const created = await createItem(db, passport({ expiryDate: '2031-05-14' }));
    await createReminderRules(db, created.id, created.expiryDate, [180, 30, 7]);

    await updateItem(db, created.id, { expiryDate: '2032-05-14' });

    const rules = await listReminderRulesForItem(db, created.id);

    expect(rules.map((rule) => [rule.offsetDays, rule.fireDate])).toEqual([
      [180, '2031-11-16'],
      [30, '2032-04-14'],
      [7, '2032-05-07'],
    ]);
  });

  it('leaves fire dates alone when the expiry does not move', async () => {
    const created = await createItem(db, passport());
    await createReminderRules(db, created.id, created.expiryDate, [30]);
    const before = await listReminderRulesForItem(db, created.id);

    await updateItem(db, created.id, {
      expiryDate: created.expiryDate,
      title: 'Renamed',
    });

    await expect(listReminderRulesForItem(db, created.id)).resolves.toEqual(before);
  });

  it('rolls back the whole update when a constraint fails', async () => {
    const created = await createItem(db, passport());

    await expect(updateItem(db, created.id, { expiryDate: '2026-02-30' })).rejects.toThrow(
      /CHECK constraint/,
    );
    await expect(getItem(db, created.id)).resolves.toEqual(created);
  });
});

describe('markItemRenewed', () => {
  it('moves the expiry, records the renewal and reschedules reminders', async () => {
    const created = await createItem(db, passport({ expiryDate: '2026-10-08' }));
    await createReminderRules(db, created.id, created.expiryDate, [30]);

    const renewed = await markItemRenewed(db, created.id, '2036-10-08', TODAY);

    expect(renewed).toMatchObject({
      expiryDate: '2036-10-08',
      renewedAt: TODAY,
    });

    const rules = await listReminderRulesForItem(db, created.id);
    expect(rules[0].fireDate).toBe('2036-09-08');
  });

  it('returns null for an unknown id', async () => {
    await expect(markItemRenewed(db, 'nope', '2036-10-08', TODAY)).resolves.toBeNull();
  });
});

describe('deleteItem', () => {
  it('reports whether anything was removed', async () => {
    const created = await createItem(db, passport());

    await expect(deleteItem(db, created.id)).resolves.toBe(true);
    await expect(getItem(db, created.id)).resolves.toBeNull();
    await expect(deleteItem(db, created.id)).resolves.toBe(false);
  });
});

describe('aggregates', () => {
  it('counts an empty vault as zero in every band', async () => {
    await expect(countItemsByStatus(db, WINDOW)).resolves.toEqual({
      expired: 0,
      soon: 0,
      safe: 0,
    });
    await expect(countItems(db)).resolves.toBe(0);
    await expect(countItemsByCategory(db)).resolves.toEqual({});
    await expect(getNextExpiringItem(db, TODAY)).resolves.toBeNull();
  });

  describe('with a populated vault', () => {
    beforeEach(async () => {
      await createItem(db, passport({ title: 'Expired', expiryDate: '2026-09-01' }));
      await createItem(db, passport({ title: 'Today', expiryDate: TODAY }));
      await createItem(db, passport({ title: 'Edge of soon', expiryDate: WINDOW.soonEnd }));
      await createItem(db, passport({ title: 'Safe', category: 'visa', expiryDate: '2031-05-14' }));
    });

    it('counts each status band, with the boundaries where the pure function puts them', async () => {
      await expect(countItemsByStatus(db, WINDOW)).resolves.toEqual({
        expired: 1,
        soon: 2,
        safe: 1,
      });
    });

    it('counts by category', async () => {
      await expect(countItemsByCategory(db)).resolves.toEqual({
        passport: 3,
        visa: 1,
      });
    });

    it('finds the soonest item that has not expired', async () => {
      const next = await getNextExpiringItem(db, TODAY);

      expect(next?.title).toBe('Today');
    });

    it('counts items with no reminder rule', async () => {
      await expect(countItemsWithoutReminders(db)).resolves.toBe(4);

      const [first] = await listItems(db);
      await createReminderRules(db, first.id, first.expiryDate, [7]);

      await expect(countItemsWithoutReminders(db)).resolves.toBe(3);
    });
  });
});
