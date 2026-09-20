import {
  assertMigrationsAreWellFormed,
  getSchemaVersion,
  LATEST_SCHEMA_VERSION,
  migrate,
  MigrationError,
} from '../migrate';
import { migrations } from '../migrations';
import { createTestDatabase } from '../testing/betterSqlite3';
import type { Database, Migration } from '../types';

async function tableNames(db: Database): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );

  return rows.map((row) => row.name);
}

describe('migration registry', () => {
  it('is contiguous from version 1', () => {
    expect(() => assertMigrationsAreWellFormed()).not.toThrow();
  });

  it('reports the last version as the latest schema version', () => {
    expect(LATEST_SCHEMA_VERSION).toBe(migrations[migrations.length - 1].version);
  });

  it.each([
    [
      'a gap',
      [
        { version: 1, name: 'a', statements: [] },
        { version: 3, name: 'b', statements: [] },
      ],
    ],
    ['a non-integer version', [{ version: 1.5, name: 'a', statements: [] }]],
    ['a start above 1', [{ version: 2, name: 'a', statements: [] }]],
  ])('rejects %s', (_label, list: Migration[]) => {
    expect(() => assertMigrationsAreWellFormed(list)).toThrow();
  });
});

describe('migrate', () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it('starts at version 0 on a fresh database', async () => {
    await expect(getSchemaVersion(db)).resolves.toBe(0);
  });

  it('brings a fresh database to the latest version', async () => {
    await expect(migrate(db)).resolves.toBe(LATEST_SCHEMA_VERSION);
    await expect(getSchemaVersion(db)).resolves.toBe(LATEST_SCHEMA_VERSION);
  });

  it('creates every table', async () => {
    await migrate(db);

    await expect(tableNames(db)).resolves.toEqual([
      'attachments',
      'item_notes',
      'item_tags',
      'items',
      'reminder_rules',
      'renewal_tasks',
      'renewals',
      'tags',
      'travel_stays',
    ]);
  });

  it('is a no-op when run twice', async () => {
    await migrate(db);
    const before = await tableNames(db);

    await expect(migrate(db)).resolves.toBe(LATEST_SCHEMA_VERSION);
    await expect(tableNames(db)).resolves.toEqual(before);
  });

  it('applies only the migrations above the current version', async () => {
    const first: Migration = {
      version: 1,
      name: 'first',
      statements: ['CREATE TABLE one (id TEXT PRIMARY KEY NOT NULL)'],
    };
    const second: Migration = {
      version: 2,
      name: 'second',
      statements: ['CREATE TABLE two (id TEXT PRIMARY KEY NOT NULL)'],
    };

    await migrate(db, [first]);
    await expect(tableNames(db)).resolves.toEqual(['one']);

    // Re-running the whole list must not replay `first` — that would throw
    // "table one already exists".
    await expect(migrate(db, [first, second])).resolves.toBe(2);
    await expect(tableNames(db)).resolves.toEqual(['one', 'two']);
  });

  it('rolls back and leaves the version untouched when a statement fails', async () => {
    const broken: Migration = {
      version: 1,
      name: 'broken',
      statements: [
        'CREATE TABLE fine (id TEXT PRIMARY KEY NOT NULL)',
        'CREATE TABLE this is not valid sql',
      ],
    };

    await expect(migrate(db, [broken])).rejects.toThrow(MigrationError);
    await expect(getSchemaVersion(db)).resolves.toBe(0);
    await expect(tableNames(db)).resolves.toEqual([]);
  });

  it('names the failing version and statement', async () => {
    const broken: Migration = {
      version: 1,
      name: 'broken',
      statements: ['SELECT 1', 'NOT SQL AT ALL'],
    };

    await expect(migrate(db, [broken])).rejects.toThrow(/Migration 1 failed at statement 1/);
  });
});
