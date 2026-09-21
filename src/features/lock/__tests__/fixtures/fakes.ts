import type { BiometricCapability, BiometricOutcome, BiometricPort } from '@/services/biometrics';

import { NO_FAILURES, type AttemptState } from '../../backoff';
import type { LockStoragePort } from '../../lockStorage';
import { buildPinRecord, type PinRecord } from '../../pin';

/**
 * In-memory doubles for the two ports the lock depends on.
 *
 * The storage fake runs the real `buildPinRecord` and the real `verifyPin`, so
 * a broken derivation fails here rather than passing against a stub — but at a
 * token iteration count. Component tests exercise the path, not the cost;
 * `pin.test.ts` is what pins the shipped `PBKDF2_ITERATIONS`. At full strength
 * a screen test that mistypes a PIN five times spends several seconds deriving.
 */

/** Cheap salt: uniqueness is what matters here, not unpredictability. */
let saltCounter = 0;

const TEST_ITERATIONS = 1;

export interface FakeLockStorage extends LockStoragePort {
  record: PinRecord | null;
  attempts: AttemptState;
}

export function fakeLockStorage(initialPin: string | null = null): FakeLockStorage {
  saltCounter += 1;

  const state: FakeLockStorage = {
    record:
      initialPin === null
        ? null
        : buildPinRecord(initialPin, `salt${saltCounter}`, TEST_ITERATIONS),
    attempts: NO_FAILURES,

    readPinRecord: async () => state.record,
    writePin: async (pin) => {
      saltCounter += 1;
      state.record = buildPinRecord(pin, `salt${saltCounter}`, TEST_ITERATIONS);
    },
    deletePin: async () => {
      state.record = null;
      state.attempts = NO_FAILURES;
    },
    readAttempts: async () => state.attempts,
    writeAttempts: async (next) => {
      state.attempts = next;
    },
  };

  return state;
}

export const NO_BIOMETRICS: BiometricCapability = {
  available: false,
  enrolled: false,
  kind: 'none',
};

export const FACE_ID: BiometricCapability = { available: true, enrolled: true, kind: 'faceId' };

export interface FakeBiometrics extends BiometricPort {
  calls: number;
}

export function fakeBiometrics(
  capability: BiometricCapability = NO_BIOMETRICS,
  outcomes: BiometricOutcome[] = [],
): FakeBiometrics {
  const queue = [...outcomes];

  const port: FakeBiometrics = {
    calls: 0,
    getCapability: async () => capability,
    authenticate: async () => {
      port.calls += 1;

      return queue.shift() ?? { status: 'cancelled' };
    },
  };

  return port;
}
