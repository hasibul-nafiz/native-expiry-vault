import { LATEST_SCHEMA_VERSION, migrations } from './migrations';
import type { Database, Migration } from './types';

/**
 * Applies every pending migration in order, inside one transaction each, and
 * advances `PRAGMA user_version` in the same transaction — so a failure rolls
 * the schema back and the version still reflects what is actually on disk.
 */

export class MigrationError extends Error {
  constructor(
    readonly version: number,
    readonly statementIndex: number,
    cause: unknown,
  ) {
    super(
      `Migration ${version} failed at statement ${statementIndex}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
    this.name = 'MigrationError';
  }
}

export async function getSchemaVersion(db: Database): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');

  return row?.user_version ?? 0;
}

/**
 * Guards the registry itself: versions must start at 1, ascend by one, and be
 * plain integers. `PRAGMA user_version = N` cannot be parameterised, so N is
 * interpolated — this is the check that keeps the interpolation safe.
 */
export function assertMigrationsAreWellFormed(list: readonly Migration[] = migrations): void {
  list.forEach((migration, index) => {
    if (!Number.isInteger(migration.version)) {
      throw new Error(`Migration "${migration.name}" has a non-integer version.`);
    }

    if (migration.version !== index + 1) {
      throw new Error(
        `Migration "${migration.name}" has version ${migration.version}, expected ${index + 1}. ` +
          'Versions must start at 1 and be contiguous.',
      );
    }
  });
}

export async function migrate(
  db: Database,
  list: readonly Migration[] = migrations,
): Promise<number> {
  assertMigrationsAreWellFormed(list);

  let version = await getSchemaVersion(db);

  for (const migration of list) {
    if (migration.version <= version) {
      continue;
    }

    await db.withTransactionAsync(async () => {
      for (const [index, statement] of migration.statements.entries()) {
        try {
          await db.execAsync(statement);
        } catch (cause) {
          throw new MigrationError(migration.version, index, cause);
        }
      }

      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });

    version = migration.version;
  }

  return version;
}

export { LATEST_SCHEMA_VERSION };
