/**
 * One error type for every database driver.
 *
 * Both adapters normalise whatever their driver throws into this, so callers
 * see the same shape whether they are running against expo-sqlite or the
 * in-memory test driver, and the SQLite message (`CHECK constraint failed: ...`,
 * `FOREIGN KEY constraint failed`, ...) is preserved verbatim.
 *
 * It also keeps native driver errors from escaping: better-sqlite3 is a native
 * addon whose error objects are created in the host realm, so `instanceof Error`
 * is false inside a Jest test context and assertions about them misreport.
 * Re-throwing an ordinary `Error` from this module avoids that entirely.
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    readonly sql: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'DatabaseError';
  }
}

/** Wraps a driver failure, keeping its message and the statement that caused it. */
export function toDatabaseError(cause: unknown, sql: string): DatabaseError {
  const message = cause instanceof Error ? cause.message : String(cause);

  return new DatabaseError(message, sql, { cause });
}
