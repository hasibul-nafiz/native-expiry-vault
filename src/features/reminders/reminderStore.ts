import { useSyncExternalStore } from 'react';

import type { SyncOutcome } from './syncNotifications';

/**
 * What the app knows about its own reminders, and the signal that asks for a
 * resync.
 *
 * A module-level store for the same reason `useLockState` is one: the answer is
 * global, it must survive remounts, and any screen that changes a document
 * needs to ask for a resync without threading a callback down to it. Choosing
 * the app's state library is still F11's call, so this stays a plain
 * `useSyncExternalStore` like the lock.
 */

type Listener = () => void;

export interface ReminderState {
  /** Bumped by `requestReminderSync`; the hook re-runs when it changes. */
  revision: number;
  /** Null until the first sync has finished. */
  outcome: SyncOutcome | null;
  syncing: boolean;
  /** The last sync that failed outright, as opposed to being refused. */
  error: Error | null;
}

const INITIAL: ReminderState = { revision: 0, outcome: null, syncing: false, error: null };

let state: ReminderState = INITIAL;
const listeners = new Set<Listener>();

function set(next: Partial<ReminderState>): void {
  state = { ...state, ...next };

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

function getSnapshot(): ReminderState {
  return state;
}

/**
 * Asks for the schedule to be rebuilt. Called after anything that can change
 * when a reminder is due: creating, editing, renewing, archiving or deleting a
 * document.
 */
export function requestReminderSync(): void {
  set({ revision: state.revision + 1 });
}

export function reminderSyncStarted(): void {
  set({ syncing: true, error: null });
}

export function reminderSyncSucceeded(outcome: SyncOutcome): void {
  set({ syncing: false, outcome, error: null });
}

export function reminderSyncFailed(error: Error): void {
  set({ syncing: false, error });
}

/** Test-only: the store outlives a component, so each test needs a clean one. */
export function resetReminderStore(): void {
  state = INITIAL;

  for (const listener of listeners) {
    listener();
  }
}

export function useReminderState(): ReminderState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
