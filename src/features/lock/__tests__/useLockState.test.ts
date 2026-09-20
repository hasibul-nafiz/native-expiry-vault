import { act, renderHook } from '@testing-library/react-native';

import { lockVault, unlockVault, useLockState } from '../useLockState';

/**
 * The contract F9 implements against: the store is global, so locking in one
 * place must reach every subscriber.
 */

afterEach(() => {
  unlockVault();
});

describe('useLockState', () => {
  it('starts unlocked', () => {
    const { result } = renderHook(() => useLockState());

    expect(result.current.isLocked).toBe(false);
  });

  it('reflects a lock', () => {
    const { result } = renderHook(() => useLockState());

    act(() => {
      result.current.lock();
    });

    expect(result.current.isLocked).toBe(true);
  });

  it('reflects an unlock', () => {
    const { result } = renderHook(() => useLockState());

    act(() => {
      result.current.lock();
    });
    act(() => {
      result.current.unlock();
    });

    expect(result.current.isLocked).toBe(false);
  });

  it('shares one state across separate consumers', () => {
    const first = renderHook(() => useLockState());
    const second = renderHook(() => useLockState());

    act(() => {
      lockVault();
    });

    expect(first.result.current.isLocked).toBe(true);
    expect(second.result.current.isLocked).toBe(true);
  });

  it('survives unmounting every consumer', () => {
    const { unmount } = renderHook(() => useLockState());

    act(() => {
      lockVault();
    });
    unmount();

    const { result } = renderHook(() => useLockState());
    expect(result.current.isLocked).toBe(true);
  });

  it('ignores a redundant transition', () => {
    const { result } = renderHook(() => useLockState());

    act(() => {
      lockVault();
      lockVault();
    });

    expect(result.current.isLocked).toBe(true);
  });
});
