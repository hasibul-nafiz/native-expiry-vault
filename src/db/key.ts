import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * The SQLCipher key for the local database.
 *
 * It is generated once on first launch from the platform CSPRNG and kept in the
 * iOS Keychain / Android Keystore. It is never written to the database, never
 * logged, never sent anywhere, and never leaves this module except to the
 * adapter that opens the connection.
 */

const KEY_BYTE_LENGTH = 32;
const STORAGE_KEY = 'database-key';
const HEX_KEY_PATTERN = /^[0-9a-f]{64}$/;

/**
 * `WHEN_UNLOCKED_THIS_DEVICE_ONLY` pins the key to this device: it is excluded
 * from iCloud and Android cloud backups, so a restored backup cannot carry the
 * key to a different phone.
 *
 * `requireAuthentication` is deliberately not set. It would force a biometric
 * prompt before the database could open at all, on every cold start — that is a
 * product decision belonging to F9's app lock, not to the data layer.
 */
const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: 'expiryvault.db',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export class DatabaseKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseKeyError';
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns the existing key, or generates and stores one on first launch.
 *
 * A stored value that is not a 64-character hex string means the keychain entry
 * was corrupted or tampered with. It is not silently replaced: overwriting it
 * would make the existing encrypted database permanently unreadable, so the
 * caller is told instead.
 */
export async function getOrCreateDatabaseKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(STORAGE_KEY, STORE_OPTIONS);

  if (existing !== null) {
    if (!HEX_KEY_PATTERN.test(existing)) {
      throw new DatabaseKeyError(
        'The stored database key is malformed. Refusing to replace it, because doing so ' +
          'would make the existing encrypted database unreadable.',
      );
    }

    return existing;
  }

  const key = toHex(await Crypto.getRandomBytesAsync(KEY_BYTE_LENGTH));

  if (!HEX_KEY_PATTERN.test(key)) {
    throw new DatabaseKeyError('Generated a database key of the wrong length.');
  }

  await SecureStore.setItemAsync(STORAGE_KEY, key, STORE_OPTIONS);

  return key;
}

/**
 * Removes the key. The encrypted database becomes unreadable, so this is only
 * for a deliberate "erase everything" action and must be paired with deleting
 * the database file itself.
 */
export async function deleteDatabaseKey(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY, STORE_OPTIONS);
}

/** Exported for the adapter's assertion; the pattern itself is not a secret. */
export function isValidDatabaseKey(value: string): boolean {
  return HEX_KEY_PATTERN.test(value);
}
