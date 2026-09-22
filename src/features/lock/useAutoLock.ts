import { useEffect } from 'react';
import { AppState } from 'react-native';

import { DEFAULT_GRACE_MS, shouldLockOnResume, startsGracePeriod } from './autoLock';
import { clearBackgrounded, getLockState, lockVault, markBackgrounded } from './useLockState';

/**
 * Re-locks the vault when the app has been away long enough.
 *
 * Mounted once at the root, above the gate, so it keeps listening no matter
 * which side of the gate is rendered.
 *
 * The handler reads the store directly rather than through `useLockState`, so
 * the listener is attached once for the life of the app instead of being
 * rebuilt on every state change — and so it can never act on a stale value.
 */

export interface UseAutoLockOptions {
  graceMs?: number;
}

export function useAutoLock({ graceMs = DEFAULT_GRACE_MS }: UseAutoLockOptions = {}): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const { enrolled, status, authenticating, backgroundedAt } = getLockState();

      if (!enrolled) {
        return;
      }

      if (startsGracePeriod(next)) {
        /*
          Two things must not start the clock. A biometric prompt backgrounds
          the app on Android and makes it inactive on iOS, so authenticating
          through it would re-lock the vault it just opened. And an app that is
          already locked has no grace period to run.
        */
        if (!authenticating && status === 'unlocked') {
          markBackgrounded(Date.now());
        }

        return;
      }

      if (next === 'active') {
        if (shouldLockOnResume({ backgroundedAt, now: Date.now(), graceMs })) {
          lockVault();
        } else {
          clearBackgrounded();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [graceMs]);
}
