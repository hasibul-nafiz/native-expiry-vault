import * as SecureStore from 'expo-secure-store';

import {
  DatabaseKeyError,
  deleteDatabaseKey,
  getOrCreateDatabaseKey,
  isValidDatabaseKey,
} from '../key';

/**
 * `expo-secure-store` is a native module, so it is replaced with an in-memory
 * store that records the options each call was given. `expo-crypto` is already
 * mocked deterministically in `jest.setup.ts`.
 *
 * What is under test is this module's own logic — generate once, reuse
 * thereafter, refuse to clobber a corrupted entry, and ask for the right
 * keychain protection. The Keychain/Keystore round-trip itself can only be
 * confirmed on a device.
 */
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  const calls: {
    setOptions: unknown[];
    getOptions: unknown[];
    deleteOptions: unknown[];
  } = {
    setOptions: [],
    getOptions: [],
    deleteOptions: [],
  };

  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked-this-device-only',
    getItemAsync: jest.fn(async (key: string, options?: unknown) => {
      calls.getOptions.push(options);

      return store.get(key) ?? null;
    }),
    setItemAsync: jest.fn(async (key: string, value: string, options?: unknown) => {
      calls.setOptions.push(options);
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string, options?: unknown) => {
      calls.deleteOptions.push(options);
      store.delete(key);
    }),
    __store: store,
    __calls: calls,
  };
});

const mocked = SecureStore as unknown as {
  __store: Map<string, string>;
  __calls: { setOptions: unknown[]; getOptions: unknown[] };
};

beforeEach(() => {
  mocked.__store.clear();
  mocked.__calls.setOptions.length = 0;
  mocked.__calls.getOptions.length = 0;
  jest.clearAllMocks();
});

describe('getOrCreateDatabaseKey', () => {
  it('generates a 256-bit key as 64 lowercase hex characters', async () => {
    const key = await getOrCreateDatabaseKey();

    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(isValidDatabaseKey(key)).toBe(true);
  });

  it('stores the key it generated', async () => {
    const key = await getOrCreateDatabaseKey();

    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(mocked.__store.get('database-key')).toBe(key);
  });

  it('reuses the stored key on every later call', async () => {
    const first = await getOrCreateDatabaseKey();
    const second = await getOrCreateDatabaseKey();
    const third = await getOrCreateDatabaseKey();

    expect(second).toBe(first);
    expect(third).toBe(first);
    // Generated once, not three times.
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it('pins the key to this device and does not demand authentication to read it', async () => {
    await getOrCreateDatabaseKey();

    expect(mocked.__calls.setOptions[0]).toEqual({
      keychainService: 'expiryvault.db',
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    // requireAuthentication would gate every cold start on biometrics; that is
    // F9's decision, not the data layer's.
    expect(mocked.__calls.setOptions[0]).not.toHaveProperty('requireAuthentication');
  });

  it('reads with the same options it wrote with', async () => {
    await getOrCreateDatabaseKey();

    expect(mocked.__calls.getOptions[0]).toEqual(mocked.__calls.setOptions[0]);
  });

  it.each([
    ['too short', 'abc123'],
    ['uppercase hex', 'A'.repeat(64)],
    ['not hex at all', 'z'.repeat(64)],
    ['empty', ''],
  ])('refuses to overwrite a %s stored key', async (_label, corrupted) => {
    mocked.__store.set('database-key', corrupted);

    await expect(getOrCreateDatabaseKey()).rejects.toThrow(DatabaseKeyError);
    // The corrupted value is left in place: replacing it would make an existing
    // encrypted database permanently unreadable.
    expect(mocked.__store.get('database-key')).toBe(corrupted);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});

describe('deleteDatabaseKey', () => {
  it('removes the stored key', async () => {
    await getOrCreateDatabaseKey();
    await deleteDatabaseKey();

    expect(mocked.__store.has('database-key')).toBe(false);
  });
});

describe('isValidDatabaseKey', () => {
  it.each(['0'.repeat(64), 'a1b2'.repeat(16)])('accepts %s', (value) => {
    expect(isValidDatabaseKey(value)).toBe(true);
  });

  it.each(["'; DROP TABLE items; --", 'a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64)])(
    'rejects %s',
    (value) => {
      expect(isValidDatabaseKey(value)).toBe(false);
    },
  );
});
