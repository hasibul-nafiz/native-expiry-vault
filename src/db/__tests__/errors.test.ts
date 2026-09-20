import { DatabaseError } from '../errors';
import { createMigratedTestDatabase } from '../testing/betterSqlite3';
import type { Database } from '../types';

/**
 * Regression cover for driver-error normalisation.
 *
 * better-sqlite3 is a native addon: the errors it throws are constructed in the
 * host realm, so inside a Jest test context `instanceof Error` is false for
 * them and any assertion about a thrown error silently misreports — which
 * showed up as tests that passed alone and failed in a full run. The adapters
 * therefore re-throw an ordinary `DatabaseError`, and these tests pin that down.
 */

let db: Database;

beforeEach(async () => {
  db = await createMigratedTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

describe('driver errors', () => {
  it('surfaces as a real Error in this realm', async () => {
    const failure = await db
      .runAsync('INSERT INTO items (id) VALUES (?)', ['x'])
      .then(() => null)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure).toBeInstanceOf(DatabaseError);
  });

  it('keeps the SQLite message and the statement that failed', async () => {
    const sql = 'SELECT * FROM does_not_exist';

    const failure = (await db
      .getAllAsync(sql)
      .then(() => null)
      .catch((error: unknown) => error)) as DatabaseError;

    expect(failure.message).toMatch(/no such table: does_not_exist/);
    expect(failure.sql).toBe(sql);
    expect(failure.cause).toBeDefined();
  });

  it.each([
    [
      'a CHECK violation',
      "INSERT INTO items (id, title, category, expiry_date, created_at, updated_at) VALUES ('a', 'T', 'nope', '2026-09-20', 'n', 'n')",
      /CHECK constraint/,
    ],
    [
      'a NOT NULL violation',
      "INSERT INTO items (id, title, category, created_at, updated_at) VALUES ('a', 'T', 'passport', 'n', 'n')",
      /NOT NULL/,
    ],
    [
      'a foreign-key violation',
      "INSERT INTO item_notes (id, item_id, title, body, created_at, updated_at) VALUES ('n', 'ghost', 'T', 'B', 'n', 'n')",
      /FOREIGN KEY/,
    ],
  ])('reports %s with its original message', async (_label, sql, pattern) => {
    await expect(db.execAsync(sql)).rejects.toThrow(pattern);
  });
});
