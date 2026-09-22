import { BackupError } from './errors';
import { PAYLOAD_VERSION } from './types';

/**
 * Migration of older backup payloads, built the same way as the database's own
 * migrations in `src/db/migrate.ts` — contiguous versions, applied in order,
 * guarded by a well-formedness check on the registry itself.
 *
 * A backup file outlives the build that wrote it. Someone restores a phone two
 * years later from a file an old version produced, which is the whole reason
 * the format carries a version at all.
 *
 * **The chain is empty today, and that is not an oversight.** Version 1 is the
 * only payload shape that has ever existed, so there is no migration to write,
 * and inventing a fake version 0 to make a test look green would prove nothing
 * about the day a real one arrives. What is verified instead is the machinery:
 * the runner is tested against a chain supplied by the test, exactly as
 * `migrate.test.ts` does for the database, and a version-1 fixture file is
 * committed to the repo so the release that adds version 2 already has a real
 * older file it must still read.
 *
 * Each step is a pure function over the decoded JSON. It runs **before**
 * validation, so it must treat its input as unknown and untrusted; the payload
 * is validated against the current schema afterwards.
 */

export interface PayloadMigration {
  /** The version this step produces. Steps run in ascending order. */
  version: number;
  name: string;
  migrate(payload: Record<string, unknown>): Record<string, unknown>;
}

/** No entries yet. The first one will carry `version: 2`. */
export const payloadMigrations: readonly PayloadMigration[] = [];

/**
 * Guards the registry: versions must start at 2 — version 1 is the original
 * shape and nothing migrates *to* it — ascend by one, and be plain integers.
 */
export function assertPayloadMigrationsAreWellFormed(
  list: readonly PayloadMigration[] = payloadMigrations,
): void {
  list.forEach((migration, index) => {
    const expected = index + 2;

    if (!Number.isInteger(migration.version)) {
      throw new Error(`Backup migration "${migration.name}" has a non-integer version.`);
    }

    if (migration.version !== expected) {
      throw new Error(
        `Backup migration "${migration.name}" has version ${migration.version}, expected ${expected}. ` +
          'Versions must start at 2 and be contiguous.',
      );
    }
  });
}

export interface MigrationOutcome {
  payload: Record<string, unknown>;
  /** False when the file was already current, so the UI can say it was upgraded. */
  migrated: boolean;
}

/**
 * Brings a decoded payload up to `PAYLOAD_VERSION`.
 *
 * A payload from the future is refused rather than attempted: the app cannot
 * know what a later version means, and a half-understood restore is worse than
 * a refusal the user can act on by updating the app.
 */
export function migrateBackupPayload(
  raw: unknown,
  list: readonly PayloadMigration[] = payloadMigrations,
  target: number = PAYLOAD_VERSION,
): MigrationOutcome {
  assertPayloadMigrationsAreWellFormed(list);

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BackupError('invalid-payload', 'The backup contents are not an object.');
  }

  let payload = { ...(raw as Record<string, unknown>) };
  const version = payload.payloadVersion;

  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new BackupError('invalid-payload', 'The backup does not say which version it is.');
  }

  if (version > target) {
    throw new BackupError(
      'unsupported-version',
      `This backup is version ${version}; this app reads up to ${target}. Update the app to restore it.`,
    );
  }

  for (const migration of list) {
    if (migration.version <= version || migration.version > target) {
      continue;
    }

    payload = migration.migrate(payload);
    payload.payloadVersion = migration.version;
  }

  if (payload.payloadVersion !== target) {
    throw new BackupError(
      'unsupported-version',
      `No migration path from backup version ${version} to ${target}.`,
    );
  }

  return { payload, migrated: version !== target };
}
