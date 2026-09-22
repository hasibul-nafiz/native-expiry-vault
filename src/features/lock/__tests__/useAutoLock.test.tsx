import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { DEFAULT_GRACE_MS } from '../autoLock';
import { useAutoLock } from '../useAutoLock';
import {
  getLockState,
  initialiseLock,
  resetLockStore,
  setAuthenticating,
  unlockVault,
} from '../useLockState';
import { fakeLockStorage } from './fixtures/fakes';

/**
 * The wiring between `AppState` and the lock.
 *
 * `shouldLockOnResume` is tested on its own; what this covers is the part that
 * cannot be pure — which transitions reach it, and with what.
 */

const START = 1_700_000_000_000;

let emit: (status: AppStateStatus) => void;
let now: number;

beforeEach(() => {
  now = START;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
    if (event === 'change') {
      emit = handler as (status: AppStateStatus) => void;
    }

    return { remove: jest.fn() };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  resetLockStore();
});

async function mountUnlockedVault(): Promise<void> {
  await act(async () => {
    await initialiseLock(fakeLockStorage('284091'));
  });
  act(() => {
    unlockVault();
  });

  renderHook(() => {
    useAutoLock();
  });
}

function send(status: AppStateStatus): void {
  act(() => {
    emit(status);
  });
}

describe('useAutoLock', () => {
  it('does not lock when the app comes back inside the grace period', async () => {
    await mountUnlockedVault();

    send('background');
    now = START + DEFAULT_GRACE_MS - 1;
    send('active');

    expect(getLockState().status).toBe('unlocked');
  });

  it('locks when the app has been away longer than the grace period', async () => {
    await mountUnlockedVault();

    send('background');
    now = START + DEFAULT_GRACE_MS;
    send('active');

    expect(getLockState().status).toBe('locked');
  });

  it('clears the timestamp on an early return, so a later resume is not stale', async () => {
    await mountUnlockedVault();

    send('background');
    now = START + 1000;
    send('active');

    expect(getLockState().backgroundedAt).toBeNull();

    // Hours later, with no intervening background, the app must still be open.
    now = START + 10 * 60 * 60 * 1000;
    send('active');

    expect(getLockState().status).toBe('unlocked');
  });

  it('ignores an inactive transition', async () => {
    await mountUnlockedVault();

    // iOS reports `inactive` for the app-switcher peek and Control Centre.
    send('inactive');
    now = START + 10 * DEFAULT_GRACE_MS;
    send('active');

    expect(getLockState().status).toBe('unlocked');
  });

  it('does not re-lock the vault the biometric prompt is unlocking', async () => {
    await mountUnlockedVault();

    act(() => {
      setAuthenticating(true);
    });

    // Android's BiometricPrompt genuinely backgrounds the app. Without the
    // guard, a slow authentication would lock the vault it just opened.
    send('background');
    now = START + 5 * DEFAULT_GRACE_MS;
    send('active');

    expect(getLockState().status).toBe('unlocked');
  });

  it('locks when the clock moved backwards while the app was away', async () => {
    await mountUnlockedVault();

    send('background');
    now = START - 60_000;
    send('active');

    expect(getLockState().status).toBe('locked');
  });

  it('does nothing at all when no PIN is enrolled', async () => {
    await act(async () => {
      await initialiseLock(fakeLockStorage(null));
    });
    renderHook(() => {
      useAutoLock();
    });

    send('background');
    now = START + 10 * DEFAULT_GRACE_MS;
    send('active');

    expect(getLockState().status).toBe('unlocked');
    expect(getLockState().backgroundedAt).toBeNull();
  });

  it('does not restart the grace period for an already-locked vault', async () => {
    await act(async () => {
      await initialiseLock(fakeLockStorage('284091'));
    });
    renderHook(() => {
      useAutoLock();
    });

    send('background');

    expect(getLockState().backgroundedAt).toBeNull();
  });
});
