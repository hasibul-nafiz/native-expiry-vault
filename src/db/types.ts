/**
 * The narrow database port every repository depends on.
 *
 * Repositories never import `expo-sqlite` directly. Production wraps the native
 * driver (`adapters/expoSqlite.ts`); tests wrap an in-memory better-sqlite3
 * instance (`testing/betterSqlite3.ts`) so migrations and queries are executed
 * against real SQLite rather than a mock.
 */

/** Everything SQLite can bind to a `?` placeholder. */
export type SqlParam = string | number | null;

export interface RunResult {
  changes: number;
}

export interface Database {
  /** Bulk, unparameterised SQL — migrations and pragmas only, never user input. */
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: readonly SqlParam[]): Promise<RunResult>;
  getFirstAsync<T>(sql: string, params?: readonly SqlParam[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: readonly SqlParam[]): Promise<T[]>;
  /** Rolls back if `task` rejects. */
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}

/**
 * One schema version. Statements run in order inside a single transaction, so a
 * failure leaves `PRAGMA user_version` untouched.
 */
export interface Migration {
  version: number;
  name: string;
  statements: readonly string[];
}
