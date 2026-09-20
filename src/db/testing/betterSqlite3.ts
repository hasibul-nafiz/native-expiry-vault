import BetterSqlite3 from 'better-sqlite3';

import { toDatabaseError } from '../errors';
import { migrate } from '../migrate';
import type { Database, RunResult, SqlParam } from '../types';

/**
 * Test-only `Database` implementation backed by an in-memory better-sqlite3
 * instance, so migrations, CHECK constraints, foreign keys and every repository
 * query execute against real SQLite rather than a mock.
 *
 * It lives outside `__tests__/` so Jest does not collect it as a test file, and
 * it is never imported by application code, so Metro never bundles it. The
 * driver is plain SQLite, not SQLCipher — encryption sits below this port and is
 * covered separately by the key-management tests.
 */

class BetterSqlite3Database implements Database {
  constructor(private readonly db: BetterSqlite3.Database) {}

  /**
   * better-sqlite3 is a native addon, so the errors it throws are built in the
   * host realm and fail `instanceof Error` inside a Jest test context. Every
   * call goes through here so what escapes is always an ordinary `Error`.
   */
  private run<T>(sql: string, action: () => T): T {
    try {
      return action();
    } catch (cause) {
      throw toDatabaseError(cause, sql);
    }
  }

  async execAsync(sql: string): Promise<void> {
    this.run(sql, () => this.db.exec(sql));
  }

  async runAsync(sql: string, params: readonly SqlParam[] = []): Promise<RunResult> {
    const info = this.run(sql, () => this.db.prepare(sql).run([...params]));

    return { changes: info.changes };
  }

  async getFirstAsync<T>(sql: string, params: readonly SqlParam[] = []): Promise<T | null> {
    const row = this.run(sql, () => this.db.prepare(sql).get([...params]));

    return (row as T | undefined) ?? null;
  }

  async getAllAsync<T>(sql: string, params: readonly SqlParam[] = []): Promise<T[]> {
    return this.run(sql, () => this.db.prepare(sql).all([...params])) as T[];
  }

  /**
   * better-sqlite3's own `transaction()` helper cannot wrap an async callback,
   * so the transaction is driven explicitly. Nothing else touches the connection
   * between these statements: the driver is synchronous and each test owns its
   * own in-memory database.
   */
  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    await this.execAsync('BEGIN');

    try {
      await task();
      await this.execAsync('COMMIT');
    } catch (error) {
      await this.execAsync('ROLLBACK');
      throw error;
    }
  }

  async closeAsync(): Promise<void> {
    this.run('CLOSE', () => this.db.close());
  }
}

/** A fresh, empty in-memory database with foreign keys enforced. */
export function createTestDatabase(): Database {
  const raw = new BetterSqlite3(':memory:');
  raw.pragma('foreign_keys = ON');

  return new BetterSqlite3Database(raw);
}

/** A fresh in-memory database with every migration already applied. */
export async function createMigratedTestDatabase(): Promise<Database> {
  const db = createTestDatabase();
  await migrate(db);

  return db;
}
