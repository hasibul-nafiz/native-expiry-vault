import { BackupError } from '../errors';
import {
  assertPayloadMigrationsAreWellFormed,
  migrateBackupPayload,
  payloadMigrations,
  type PayloadMigration,
} from '../migrations';
import { PAYLOAD_VERSION } from '../types';

/**
 * The migration runner, tested against chains the test supplies — the same way
 * `src/db/__tests__/migrate.test.ts` tests the database's runner.
 *
 * Version 1 is the only payload shape that has ever shipped, so the production
 * chain is empty. Fabricating a version 0 to make this file look busier would
 * assert nothing about the day a real migration is written; what has to be
 * right by then is the runner, and the runner is what these tests exercise.
 */

const V2: PayloadMigration = {
  version: 2,
  name: 'add-nickname',
  migrate: (payload) => ({ ...payload, nickname: 'from-v1' }),
};

const V3: PayloadMigration = {
  version: 3,
  name: 'rename-nickname',
  migrate: ({ nickname, ...rest }) => ({ ...rest, label: nickname }),
};

function v1(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { payloadVersion: 1, ...extra };
}

function reasonOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof BackupError ? error.reason : `not-a-backup-error: ${String(error)}`;
  }

  return 'did-not-throw';
}

describe('the shipped registry', () => {
  it('is well formed', () => {
    expect(() => assertPayloadMigrationsAreWellFormed()).not.toThrow();
  });

  it('is empty, because version 1 is the only shape that has existed', () => {
    expect(payloadMigrations).toHaveLength(0);
    expect(PAYLOAD_VERSION).toBe(1);
  });

  it('leaves a current payload untouched and says it was not migrated', () => {
    const payload = v1({ appVersion: '1.0.0' });

    expect(migrateBackupPayload(payload)).toEqual({ payload, migrated: false });
  });
});

describe('assertPayloadMigrationsAreWellFormed', () => {
  it('accepts a contiguous chain starting at 2', () => {
    expect(() => assertPayloadMigrationsAreWellFormed([V2, V3])).not.toThrow();
  });

  it('rejects a chain that starts at 1 — nothing migrates to the original shape', () => {
    expect(() => assertPayloadMigrationsAreWellFormed([{ ...V2, version: 1 }])).toThrow(
      /expected 2/,
    );
  });

  it('rejects a gap', () => {
    expect(() => assertPayloadMigrationsAreWellFormed([V2, { ...V3, version: 4 }])).toThrow(
      /expected 3/,
    );
  });

  it('rejects a non-integer version', () => {
    expect(() => assertPayloadMigrationsAreWellFormed([{ ...V2, version: 2.5 }])).toThrow(
      /non-integer/,
    );
  });
});

describe('migrateBackupPayload', () => {
  it('applies one step and stamps the new version', () => {
    const { payload, migrated } = migrateBackupPayload(v1(), [V2], 2);

    expect(payload).toEqual({ payloadVersion: 2, nickname: 'from-v1' });
    expect(migrated).toBe(true);
  });

  it('applies every step in order', () => {
    const { payload } = migrateBackupPayload(v1(), [V2, V3], 3);

    expect(payload).toEqual({ payloadVersion: 3, label: 'from-v1' });
  });

  it('skips steps at or below the payload version', () => {
    const { payload, migrated } = migrateBackupPayload(
      { payloadVersion: 2, nickname: 'already-there' },
      [V2, V3],
      3,
    );

    expect(payload).toEqual({ payloadVersion: 3, label: 'already-there' });
    expect(migrated).toBe(true);
  });

  it('preserves fields the migration does not touch', () => {
    const { payload } = migrateBackupPayload(v1({ createdAt: '2026-01-01T00:00:00.000Z' }), [V2], 2);

    expect(payload.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('does not mutate its input', () => {
    const input = v1();
    migrateBackupPayload(input, [V2], 2);

    expect(input).toEqual({ payloadVersion: 1 });
  });

  /**
   * A file from a newer app. Guessing at what a later version means is how a
   * restore silently drops a field it did not recognise.
   */
  it('refuses a payload from the future', () => {
    expect(reasonOf(() => migrateBackupPayload({ payloadVersion: 99 }, [], 1))).toBe(
      'unsupported-version',
    );
  });

  it('refuses a payload with no version', () => {
    expect(reasonOf(() => migrateBackupPayload({ items: [] }))).toBe('invalid-payload');
  });

  it('refuses a version that is not a whole number', () => {
    expect(reasonOf(() => migrateBackupPayload({ payloadVersion: 1.5 }))).toBe('invalid-payload');
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'payload'],
  ])('refuses %s as a payload', (_label, input) => {
    expect(reasonOf(() => migrateBackupPayload(input))).toBe('invalid-payload');
  });

  it('refuses a chain that cannot reach the target version', () => {
    expect(reasonOf(() => migrateBackupPayload(v1(), [], 3))).toBe('unsupported-version');
  });

  it('checks the registry before running anything', () => {
    expect(() => migrateBackupPayload(v1(), [{ ...V2, version: 5 }], 5)).toThrow(/expected 2/);
  });
});
