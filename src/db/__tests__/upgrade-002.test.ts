import { getSchemaVersion, migrate } from '../migrate';
import { migration001 } from '../migrations/001-initial';
import { migration002 } from '../migrations/002-archive-and-renewals';
import { createTestDatabase } from '../testing/betterSqlite3';
import type { Database } from '../types';

/**
 * The first real multi-version upgrade.
 *
 * Until now the runner's partial-upgrade path was only proven with synthetic
 * migrations that create throwaway tables. This exercises it against the actual
 * schema, with real rows already in place — which is the case that matters,
 * because it is what happens on a user's device when they install the update.
 */

let db: Database;

/** A database as it existed before F6: schema version 1, with data. */
async function givenVersion1WithData(): Promise<void> {
  await migrate(db, [migration001]);

  await db.runAsync(
    `INSERT INTO items (id, title, category, expiry_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['item-1', 'US Passport', 'passport', '2031-05-14', 'made-up', 'made-up'],
  );
  await db.runAsync(
    'INSERT INTO reminder_rules (id, item_id, offset_days, fire_date, created_at) VALUES (?, ?, ?, ?, ?)',
    ['rule-1', 'item-1', 30, '2031-04-14', 'made-up'],
  );
}

async function indexNames(): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );

  return rows.map((row) => row.name);
}

beforeEach(() => {
  db = createTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

describe('upgrading a populated version 1 database', () => {
  it('reaches version 2', async () => {
    await givenVersion1WithData();
    await expect(getSchemaVersion(db)).resolves.toBe(1);

    await migrate(db);

    await expect(getSchemaVersion(db)).resolves.toBe(2);
  });

  it('keeps existing rows intact', async () => {
    await givenVersion1WithData();

    await migrate(db);

    const item = await db.getFirstAsync<{ title: string; expiry_date: string }>(
      'SELECT title, expiry_date FROM items WHERE id = ?',
      ['item-1'],
    );
    expect(item).toEqual({ title: 'US Passport', expiry_date: '2031-05-14' });

    const rules = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM reminder_rules',
    );
    expect(rules?.count).toBe(1);
  });

  it('back-fills the new column as null, so existing items count as active', async () => {
    await givenVersion1WithData();

    await migrate(db);

    const row = await db.getFirstAsync<{ archived_at: string | null }>(
      'SELECT archived_at FROM items WHERE id = ?',
      ['item-1'],
    );
    expect(row?.archived_at).toBeNull();
  });

  it('adds the renewals table and its indexes', async () => {
    await givenVersion1WithData();

    await migrate(db);

    const table = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'renewals'",
    );
    expect(table).not.toBeNull();

    const indexes = await indexNames();
    expect(indexes).toContain('idx_renewals_item_id');
    expect(indexes).toContain('idx_items_active_expiry');
  });

  it('does not re-run migration 002 on an already-upgraded database', async () => {
    await givenVersion1WithData();
    await migrate(db);

    // A replay would throw "table renewals already exists".
    await expect(migrate(db)).resolves.toBe(2);
  });
});

describe('the new constraints', () => {
  beforeEach(async () => {
    await migrate(db);
    await db.runAsync(
      `INSERT INTO items (id, title, category, expiry_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['item-1', 'US Passport', 'passport', '2031-05-14', 'made-up', 'made-up'],
    );
  });

  it('accepts an ISO timestamp for archived_at', async () => {
    await expect(
      db.runAsync('UPDATE items SET archived_at = ? WHERE id = ?', [
        '2026-09-20T09:00:00.000Z',
        'item-1',
      ]),
    ).resolves.toEqual({ changes: 1 });
  });

  it.each([
    ['a date-only value', '2026-09-20'],
    ['free text', 'yesterday'],
    ['a timestamp without milliseconds', '2026-09-20T09:00:00Z'],
  ])('rejects %s for archived_at', async (_label, value) => {
    await expect(
      db.runAsync('UPDATE items SET archived_at = ? WHERE id = ?', [value, 'item-1']),
    ).rejects.toThrow(/CHECK constraint/);
  });

  it.each([
    ['30 February', '2026-02-30'],
    ['a single-digit month', '2026-9-01'],
  ])('rejects %s as a renewal date', async (_label, value) => {
    await expect(
      db.runAsync(
        `INSERT INTO renewals (id, item_id, previous_expiry_date, new_expiry_date, renewed_on, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['r-1', 'item-1', value, '2036-05-14', '2026-09-20', 'made-up'],
      ),
    ).rejects.toThrow(/CHECK constraint/);
  });

  it('rejects a renewal for an item that does not exist', async () => {
    await expect(
      db.runAsync(
        `INSERT INTO renewals (id, item_id, previous_expiry_date, new_expiry_date, renewed_on, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['r-1', 'ghost', '2031-05-14', '2036-05-14', '2026-09-20', 'made-up'],
      ),
    ).rejects.toThrow(/FOREIGN KEY/);
  });

  it('cascades renewals when the item is deleted', async () => {
    await db.runAsync(
      `INSERT INTO renewals (id, item_id, previous_expiry_date, new_expiry_date, renewed_on, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['r-1', 'item-1', '2031-05-14', '2036-05-14', '2026-09-20', 'made-up'],
    );

    await db.runAsync('DELETE FROM items WHERE id = ?', ['item-1']);

    const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM renewals');
    expect(row?.count).toBe(0);
  });
});

describe('migration 002 in isolation', () => {
  it('cannot run before 001, since it alters a table that does not exist', async () => {
    await expect(migrate(db, [{ ...migration002, version: 1 }])).rejects.toThrow(
      /no such table: items/,
    );
  });
});
