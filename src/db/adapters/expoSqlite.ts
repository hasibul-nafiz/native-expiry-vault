import * as SQLite from 'expo-sqlite';

import { toDatabaseError } from '../errors';
import { getOrCreateDatabaseKey, isValidDatabaseKey } from '../key';
import { migrate } from '../migrate';
import type { Database, RunResult, SqlParam } from '../types';

/**
 * The production `Database`: expo-sqlite with SQLCipher.
 *
 * `useSQLCipher: true` is set on the expo-sqlite config plugin in
 * `app.config.ts`, so this requires a dev client or a release build — SQLCipher
 * is not available in Expo Go.
 */

export const DATABASE_NAME = 'expiryvault.db';

class ExpoSqliteDatabase implements Database {
  constructor(private readonly db: SQLite.SQLiteDatabase) {}

  /** Normalises driver failures to `DatabaseError`, matching the test adapter. */
  private async run<T>(sql: string, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (cause) {
      throw toDatabaseError(cause, sql);
    }
  }

  async execAsync(sql: string): Promise<void> {
    await this.run(sql, () => this.db.execAsync(sql));
  }

  async runAsync(sql: string, params: readonly SqlParam[] = []): Promise<RunResult> {
    const result = await this.run(sql, () => this.db.runAsync(sql, [...params]));

    return { changes: result.changes };
  }

  async getFirstAsync<T>(sql: string, params: readonly SqlParam[] = []): Promise<T | null> {
    return this.run(sql, () => this.db.getFirstAsync<T>(sql, [...params]));
  }

  async getAllAsync<T>(sql: string, params: readonly SqlParam[] = []): Promise<T[]> {
    return this.run(sql, () => this.db.getAllAsync<T>(sql, [...params]));
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async () => {
      await task();
    });
  }

  async closeAsync(): Promise<void> {
    await this.db.closeAsync();
  }
}

/**
 * Opens the encrypted database, applies the pragmas and runs migrations.
 *
 * `PRAGMA key` must be the first statement on the connection, before anything
 * touches a page. The key is interpolated because pragmas cannot take bound
 * parameters; `isValidDatabaseKey` restricts it to 64 hex characters, so there
 * is nothing in it that could terminate the string literal.
 */
export async function openEncryptedDatabase(
  databaseName: string = DATABASE_NAME,
): Promise<Database> {
  const key = await getOrCreateDatabaseKey();

  if (!isValidDatabaseKey(key)) {
    throw new Error('Refusing to open the database with a malformed key.');
  }

  const native = await SQLite.openDatabaseAsync(databaseName);
  const db = new ExpoSqliteDatabase(native);

  await db.execAsync(`PRAGMA key = '${key}'`);
  // Fails loudly here rather than returning empty results later if the key is wrong.
  await db.getFirstAsync('SELECT count(*) FROM sqlite_master');

  await db.execAsync('PRAGMA foreign_keys = ON');
  await db.execAsync('PRAGMA journal_mode = WAL');

  await migrate(db);

  return db;
}
