import { act, renderHook } from '@testing-library/react-native';

import {
  getLockState,
  initialiseLock,
  lockVault,
  resetLockStore,
  setAuthenticating,
  setLockEnrolled,
  unlockVault,
  useLockState,
} from '../useLockState';
import { fakeLockStorage } from './fixtures/fakes';

afterEach(() => {
  resetLockStore();
});

describe('bootstrap', () => {
  it('starts undecided rather than guessing', () => {
    const { result } = renderHook(() => useLockState());

    // The alternative — defaulting to unlocked — renders the dashboard for a
    // frame before the Keychain read comes back and hides it again.
    expect(result.current.status).toBe('unknown');
    expect(result.current.isResolving).toBe(true);
    expect(result.current.isLocked).toBe(false);
  });

  it('resolves to locked when a PIN is enrolled', async () => {
    const { result } = renderHook(() => useLockState());

    await act(async () => {
      await initialiseLock(fakeLockStorage('284091'));
    });

    expect(result.current.status).toBe('locked');
    expect(result.current.enrolled).toBe(true);
    expect(result.current.isLocked).toBe(true);
  });

  it('resolves to unlocked when no PIN is enrolled', async () => {
    const { result } = renderHook(() => useLockState());

    await act(async () => {
      await initialiseLock(fakeLockStorage(null));
    });

    expect(result.current.status).toBe('unlocked');
    expect(result.current.enrolled).toBe(false);
    expect(result.current.isResolving).toBe(false);
  });
});

describe('locking', () => {
  it('refuses to lock a vault with no PIN', async () => {
    const { result } = renderHook(() => useLockState());

    await act(async () => {
      await initialiseLock(fakeLockStorage(null));
    });
    act(() => {
      lockVault();
    });

    // Otherwise an auto-lock strands the user on a gate with nothing to verify
    // them against.
    expect(result.current.isLocked).toBe(false);
  });

  it('locks and unlocks an enrolled vault', async () => {
    const { result } = renderHook(() => useLockState());

    await act(async () => {
      await initialiseLock(fakeLockStorage('284091'));
    });
    act(() => {
      unlockVault();
    });
    expect(result.current.isLocked).toBe(false);

    act(() => {
      lockVault();
    });
    expect(result.current.isLocked).toBe(true);
  });

  it('unlocks when the PIN is removed', async () => {
    const { result } = renderHook(() => useLockState());

    await act(async () => {
      await initialiseLock(fakeLockStorage('284091'));
    });
    act(() => {
      setLockEnrolled(false);
    });

    expect(result.current.enrolled).toBe(false);
    expect(result.current.isLocked).toBe(false);
  });
});

describe('the store itself', () => {
  it('shares one state across separate consumers', async () => {
    const first = renderHook(() => useLockState());
    const second = renderHook(() => useLockState());

    await act(async () => {
      await initialiseLock(fakeLockStorage('284091'));
    });

    expect(first.result.current.isLocked).toBe(true);
    expect(second.result.current.isLocked).toBe(true);
  });

  it('survives unmounting every consumer', async () => {
    const { unmount } = renderHook(() => useLockState());

    await act(async () => {
      await initialiseLock(fakeLockStorage('284091'));
    });
    unmount();

    const { result } = renderHook(() => useLockState());
    expect(result.current.isLocked).toBe(true);
  });

  it('keeps one object identity for a redundant write', async () => {
    renderHook(() => useLockState());

    await act(async () => {
      await initialiseLock(fakeLockStorage('284091'));
    });

    const before = getLockState();

    act(() => {
      lockVault();
    });

    // `useSyncExternalStore` compares by reference, so a no-op that allocated a
    // new object would re-render every subscriber on every AppState tick.
    expect(getLockState()).toBe(before);
  });

    it('is readable outside React, which is how useAutoLock reads it', async () => {
      await initialiseLock(fakeLockStorage('284091'));

      expect(getLockState().status).toBe('locked');
    });

  it('tracks an in-flight biometric prompt', () => {
    act(() => {
      setAuthenticating(true);
    });

    expect(getLockState().authenticating).toBe(true);
  });
});
