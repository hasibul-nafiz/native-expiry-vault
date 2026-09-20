import { createMigratedTestDatabase } from '../testing/betterSqlite3';
import type { Database } from '../types';

/**
 * These tests assert the database's own guarantees — the constraints that must
 * hold even if a future repository bug tries to write something invalid.
 */

const NOW = '2026-09-20T09:00:00.000Z';

let db: Database;

beforeEach(async () => {
  db = await createMigratedTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

async function insertItem(overrides: Record<string, string | number | null> = {}): Promise<void> {
  const values = {
    id: 'item-1',
    title: 'Passport',
    category: 'passport',
    expiry_date: '2031-05-14',
    issue_date: null,
    country: null,
    is_vital: 0,
    escalation_enabled: 1,
    ocr_confidence: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
  const columns = Object.keys(values);

  await db.runAsync(
    `INSERT INTO items (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    Object.values(values),
  );
}

describe('date-only columns', () => {
  it.each(['2026-09-20', '2024-02-29', '1900-01-01', '2999-12-31'])(
    'accepts the real calendar date %s',
    async (date) => {
      await expect(insertItem({ expiry_date: date })).resolves.toBeUndefined();
    },
  );

  it.each([
    ['a single-digit month', '2026-9-01'],
    ['a single-digit day', '2026-09-1'],
    ['no separators', '20260920'],
    ['a timestamp', '2026-09-20T00:00:00.000Z'],
    ['free text', 'not-a-date'],
    ['an empty string', ''],
    ['month 13', '2026-13-01'],
    ['month 00', '2026-00-10'],
    ['day 00', '2026-09-00'],
    ['day 31 of a 30-day month', '2026-09-31'],
    ['29 February in a non-leap year', '2023-02-29'],
    ['30 February', '2026-02-30'],
  ])('rejects %s', async (_label, date) => {
    await expect(insertItem({ expiry_date: date })).rejects.toThrow(/CHECK constraint/);
  });

  it('requires an expiry date', async () => {
    await expect(insertItem({ expiry_date: null })).rejects.toThrow(/NOT NULL/);
  });

  it('allows a null issue date but validates a present one', async () => {
    await expect(insertItem({ issue_date: null })).resolves.toBeUndefined();
    await expect(insertItem({ id: 'item-2', issue_date: '2026-02-30' })).rejects.toThrow(
      /CHECK constraint/,
    );
  });

  it('rejects an issue date after the expiry date', async () => {
    await expect(
      insertItem({ issue_date: '2031-05-15', expiry_date: '2031-05-14' }),
    ).rejects.toThrow(/CHECK constraint/);
  });
});

describe('items constraints', () => {
  it('rejects an unknown category', async () => {
    await expect(insertItem({ category: 'spaceship' })).rejects.toThrow(/CHECK constraint/);
  });

  it('rejects a blank title', async () => {
    await expect(insertItem({ title: '   ' })).rejects.toThrow(/CHECK constraint/);
  });

  it.each([
    ['a non-boolean flag', { is_vital: 2 }],
    ['a lowercase country code', { country: 'de' }],
    ['a three-letter country code', { country: 'DEU' }],
    ['an out-of-range OCR confidence', { ocr_confidence: 1.5 }],
  ])('rejects %s', async (_label, overrides) => {
    await expect(insertItem(overrides)).rejects.toThrow(/CHECK constraint/);
  });
});

describe('foreign keys', () => {
  it.each(['attachments', 'reminder_rules', 'item_notes', 'renewal_tasks'])(
    'rejects an orphan row in %s',
    async (table) => {
      const columns: Record<string, readonly (string | number)[]> = {
        attachments: ['a-1', 'ghost', 'file:///a', 'a.pdf', 'application/pdf', 1, 'front', 0, NOW],
        reminder_rules: ['r-1', 'ghost', 30, 1, '2031-04-14', NOW],
        item_notes: ['n-1', 'ghost', 'Title', 'Body', NOW, NOW],
        renewal_tasks: ['t-1', 'ghost', 'Task', 0, 0, NOW, NOW],
      };
      const sql: Record<string, string> = {
        attachments:
          'INSERT INTO attachments (id, item_id, file_uri, file_name, mime_type, byte_size, role, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        reminder_rules:
          'INSERT INTO reminder_rules (id, item_id, offset_days, enabled, fire_date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        item_notes:
          'INSERT INTO item_notes (id, item_id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        renewal_tasks:
          'INSERT INTO renewal_tasks (id, item_id, title, done, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      };

      await expect(db.runAsync(sql[table], columns[table])).rejects.toThrow(/FOREIGN KEY/);
    },
  );

  it('cascades a deleted item to every child table', async () => {
    await insertItem();
    await db.runAsync(
      'INSERT INTO attachments (id, item_id, file_uri, file_name, mime_type, byte_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['a-1', 'item-1', 'file:///a', 'a.pdf', 'application/pdf', 10, NOW],
    );
    await db.runAsync(
      'INSERT INTO reminder_rules (id, item_id, offset_days, fire_date, created_at) VALUES (?, ?, ?, ?, ?)',
      ['r-1', 'item-1', 30, '2031-04-14', NOW],
    );
    await db.runAsync(
      'INSERT INTO item_notes (id, item_id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['n-1', 'item-1', 'Title', 'Body', NOW, NOW],
    );
    await db.runAsync(
      'INSERT INTO renewal_tasks (id, item_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      ['t-1', 'item-1', 'Task', NOW, NOW],
    );
    await db.runAsync('INSERT INTO tags (id, label, created_at) VALUES (?, ?, ?)', [
      'g-1',
      'Travel',
      NOW,
    ]);
    await db.runAsync('INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)', ['item-1', 'g-1']);

    await db.runAsync('DELETE FROM items WHERE id = ?', ['item-1']);

    for (const table of [
      'attachments',
      'reminder_rules',
      'item_notes',
      'renewal_tasks',
      'item_tags',
    ]) {
      const row = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM ${table}`,
      );
      expect(row?.count).toBe(0);
    }

    // The tag itself survives — only the association is removed.
    const tags = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM tags');
    expect(tags?.count).toBe(1);
  });
});

describe('reminder_rules constraints', () => {
  beforeEach(async () => {
    await insertItem();
  });

  it('rejects a negative offset', async () => {
    await expect(
      db.runAsync(
        'INSERT INTO reminder_rules (id, item_id, offset_days, fire_date, created_at) VALUES (?, ?, ?, ?, ?)',
        ['r-1', 'item-1', -1, '2031-04-14', NOW],
      ),
    ).rejects.toThrow(/CHECK constraint/);
  });

  it('rejects a duplicate offset for the same item', async () => {
    await db.runAsync(
      'INSERT INTO reminder_rules (id, item_id, offset_days, fire_date, created_at) VALUES (?, ?, ?, ?, ?)',
      ['r-1', 'item-1', 30, '2031-04-14', NOW],
    );

    await expect(
      db.runAsync(
        'INSERT INTO reminder_rules (id, item_id, offset_days, fire_date, created_at) VALUES (?, ?, ?, ?, ?)',
        ['r-2', 'item-1', 30, '2031-04-14', NOW],
      ),
    ).rejects.toThrow(/UNIQUE constraint/);
  });
});

describe('other tables', () => {
  it('rejects an attachment role outside the allowed set', async () => {
    await insertItem();

    await expect(
      db.runAsync(
        'INSERT INTO attachments (id, item_id, file_uri, file_name, mime_type, byte_size, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['a-1', 'item-1', 'file:///a', 'a.pdf', 'application/pdf', 10, 'side', NOW],
      ),
    ).rejects.toThrow(/CHECK constraint/);
  });

  it('rejects a duplicate tag label', async () => {
    await db.runAsync('INSERT INTO tags (id, label, created_at) VALUES (?, ?, ?)', [
      'g-1',
      'Travel',
      NOW,
    ]);

    await expect(
      db.runAsync('INSERT INTO tags (id, label, created_at) VALUES (?, ?, ?)', [
        'g-2',
        'Travel',
        NOW,
      ]),
    ).rejects.toThrow(/UNIQUE constraint/);
  });

  it('rejects a travel stay that exits before it enters', async () => {
    await expect(
      db.runAsync(
        'INSERT INTO travel_stays (id, area, entry_date, exit_date, created_at) VALUES (?, ?, ?, ?, ?)',
        ['s-1', 'schengen', '2026-05-10', '2026-05-09', NOW],
      ),
    ).rejects.toThrow(/CHECK constraint/);
  });

  it('allows an open-ended travel stay', async () => {
    await expect(
      db.runAsync(
        'INSERT INTO travel_stays (id, area, entry_date, exit_date, created_at) VALUES (?, ?, ?, ?, ?)',
        ['s-1', 'schengen', '2026-05-10', null, NOW],
      ),
    ).resolves.toEqual({ changes: 1 });
  });
});
