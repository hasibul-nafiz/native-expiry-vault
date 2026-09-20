import { useSyncExternalStore } from 'react';

/**
 * Whether the vault is currently locked.
 *
 * F3 owns the routing consequence of this flag, not the security behind it: the
 * store below is a real, working in-memory lock that starts unlocked, so the app
 * runs normally today and `app/(app)/_layout.tsx` already redirects correctly
 * whenever something sets it. F9 adds biometric and PIN verification behind
 * `unlock`, plus persistence and the auto-lock timer, without changing any route.
 *
 * It is a module-level store rather than React state because the lock is global
 * and must survive remounts — and rather than a zustand store because choosing
 * the app's state library belongs with the feature that first needs one.
 */

type Listener = () => void;

let locked = false;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return locked;
}

/** Locks the vault. F9 calls this from the auto-lock timer and on backgrounding. */
export function lockVault(): void {
  if (!locked) {
    locked = true;
    emit();
  }
}

/** Unlocks the vault. F9 gates this behind biometric or PIN verification. */
export function unlockVault(): void {
  if (locked) {
    locked = false;
    emit();
  }
}

export interface LockState {
  isLocked: boolean;
  lock: () => void;
  unlock: () => void;
}

export function useLockState(): LockState {
  const isLocked = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return { isLocked, lock: lockVault, unlock: unlockVault };
}
