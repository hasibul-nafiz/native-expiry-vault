import { useSyncExternalStore } from 'react';

import { lockStorage, type LockStoragePort } from './lockStorage';

/**
 * Whether the vault is locked, and whether it can be.
 *
 * Still a module-level store rather than zustand, for the reason F3 gave: the
 * answer is global, it must survive remounts, and choosing the app's state
 * library is F11's call.
 *
 * `status` has three values, not two. Reading the PIN record out of the
 * Keychain is asynchronous, so at the first frame the app genuinely does not
 * know whether it should be showing a lock screen — and defaulting to
 * `unlocked` for those frames renders the dashboard behind the gate before
 * hiding it again. `unknown` holds the splash instead.
 */

export type LockStatus = 'unknown' | 'locked' | 'unlocked';

export interface LockState {
  status: LockStatus;
  /** A PIN exists. Nothing locks until one does. */
  enrolled: boolean;
  /** A biometric sheet is on screen. Suppresses the auto-lock timer. */
  authenticating: boolean;
  /** When the app was last truly backgrounded, for the grace period. */
  backgroundedAt: number | null;
}

type Listener = () => void;

const INITIAL: LockState = {
  status: 'unknown',
  enrolled: false,
  authenticating: false,
  backgroundedAt: null,
};

let state: LockState = INITIAL;
const listeners = new Set<Listener>();

function set(next: Partial<LockState>): void {
  const merged = { ...state, ...next };

  // `useSyncExternalStore` compares by reference, so a no-op write must not
  // produce a new object or every subscriber re-renders on every AppState tick.
  if (
    merged.status === state.status &&
    merged.enrolled === state.enrolled &&
    merged.authenticating === state.authenticating &&
    merged.backgroundedAt === state.backgroundedAt
  ) {
    return;
  }

  state = merged;

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

function getSnapshot(): LockState {
  return state;
}

/**
 * The current state, outside React.
 *
 * `useAutoLock`'s `AppState` handler reads through this rather than closing
 * over the hook's values, so the listener is subscribed once instead of being
 * torn down and rebuilt on every change — and cannot act on a stale snapshot.
 */
export function getLockState(): LockState {
  return state;
}

/**
 * Reads the enrolment out of secure-store and resolves `unknown`.
 *
 * A vault with a PIN starts locked — that is the whole point of the feature, and
 * it must hold for a cold start as well as a resume. A vault without one starts
 * unlocked and stays that way.
 */
export async function initialiseLock(storage: LockStoragePort = lockStorage): Promise<void> {
  const record = await storage.readPinRecord();
  const enrolled = record !== null;

  set({ enrolled, status: enrolled ? 'locked' : 'unlocked' });
}

/**
 * Locks the vault.
 *
 * A no-op when no PIN is enrolled. Without that guard an auto-lock could strand
 * the user on a gate that has nothing to verify them against.
 */
export function lockVault(): void {
  if (state.enrolled) {
    set({ status: 'locked', backgroundedAt: null });
  }
}

/** Called only by a verified biometric or PIN check. */
export function unlockVault(): void {
  set({ status: 'unlocked', backgroundedAt: null });
}

/** After enrolling or removing a PIN. Removing one unlocks, since nothing can re-open it. */
export function setLockEnrolled(enrolled: boolean): void {
  set({ enrolled, status: enrolled ? state.status : 'unlocked' });
}

/** Set around the biometric prompt, which backgrounds the app on both platforms. */
export function setAuthenticating(authenticating: boolean): void {
  set({ authenticating });
}

export function markBackgrounded(at: number): void {
  set({ backgroundedAt: at });
}

export function clearBackgrounded(): void {
  set({ backgroundedAt: null });
}

/** Test seam. Nothing in the app resets the store. */
export function resetLockStore(): void {
  state = INITIAL;

  for (const listener of listeners) {
    listener();
  }
}

export interface LockStateHook extends LockState {
  isLocked: boolean;
  /** The gate is undecided; render the splash rather than either side of it. */
  isResolving: boolean;
}

export function useLockState(): LockStateHook {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    ...current,
    isLocked: current.status === 'locked',
    isResolving: current.status === 'unknown',
  };
}
