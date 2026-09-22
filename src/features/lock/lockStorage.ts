import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { NO_FAILURES, type AttemptState } from './backoff';
import {
  buildPinRecord,
  parsePinRecord,
  serializePinRecord,
  SALT_BYTES,
  type PinRecord,
} from './pin';

/**
 * Where the lock keeps its two secrets.
 *
 * The PIN record and the failed-attempt counter both live in the
 * Keychain/Keystore, under the same `WHEN_UNLOCKED_THIS_DEVICE_ONLY` class as
 * the SQLCipher key in `src/db/key.ts` — so neither travels in a cloud backup
 * to another phone.
 *
 * The counter is here rather than in memory on purpose. Backoff that a
 * force-quit resets is not backoff.
 */

const PIN_KEY = 'lock-pin';
const ATTEMPTS_KEY = 'lock-attempts';

const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: 'expiryvault.lock',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export interface LockStoragePort {
  readPinRecord(): Promise<PinRecord | null>;
  /** Enrols or replaces the PIN, generating a fresh salt. */
  writePin(pin: string): Promise<void>;
  deletePin(): Promise<void>;
  readAttempts(): Promise<AttemptState>;
  writeAttempts(state: AttemptState): Promise<void>;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parseAttempts(raw: string): AttemptState {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return NO_FAILURES;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return NO_FAILURES;
  }

  const { failures, lockedUntil, lockoutMs } = parsed as Record<string, unknown>;

  if (
    typeof failures !== 'number' ||
    !Number.isInteger(failures) ||
    failures < 0 ||
    typeof lockoutMs !== 'number' ||
    lockoutMs < 0 ||
    !(lockedUntil === null || typeof lockedUntil === 'number')
  ) {
    return NO_FAILURES;
  }

  return { failures, lockedUntil, lockoutMs };
}

export const lockStorage: LockStoragePort = {
  async readPinRecord() {
    const raw = await SecureStore.getItemAsync(PIN_KEY, STORE_OPTIONS);

    return raw === null ? null : parsePinRecord(raw);
  },

  async writePin(pin) {
    const salt = toHex(await Crypto.getRandomBytesAsync(SALT_BYTES));

    await SecureStore.setItemAsync(PIN_KEY, serializePinRecord(buildPinRecord(pin, salt)), {
      ...STORE_OPTIONS,
    });
  },

  async deletePin() {
    await SecureStore.deleteItemAsync(PIN_KEY, STORE_OPTIONS);
    await SecureStore.deleteItemAsync(ATTEMPTS_KEY, STORE_OPTIONS);
  },

  async readAttempts() {
    const raw = await SecureStore.getItemAsync(ATTEMPTS_KEY, STORE_OPTIONS);

    return raw === null ? NO_FAILURES : parseAttempts(raw);
  },

  async writeAttempts(state) {
    await SecureStore.setItemAsync(ATTEMPTS_KEY, JSON.stringify(state), STORE_OPTIONS);
  },
};
