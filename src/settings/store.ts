import { useSyncExternalStore } from 'react';

import { defaultPreferences, type Preferences } from './preferences';
import { preferencesStorage, type PreferencesStoragePort } from './storage';

/**
 * Module-level preference state, the same `useSyncExternalStore` pattern F3's
 * lock and F7's reminder sync use rather than a state library.
 *
 * Preferences are read once at boot and held in memory; every screen reads the
 * same snapshot, so a theme or language change applies everywhere on the next
 * render rather than after a reload.
 */

export interface PreferencesState {
  preferences: Preferences;
  /** False until the file has been read, so the splash can hold. */
  loaded: boolean;
}

let state: PreferencesState = { preferences: { ...defaultPreferences }, loaded: false };

const listeners = new Set<() => void>();

function emit(next: PreferencesState): void {
  state = next;

  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getPreferencesState(): PreferencesState {
  return state;
}

/** Reads the file once at launch. Safe to call again; the last read wins. */
export async function initialisePreferences(
  storage: PreferencesStoragePort = preferencesStorage,
): Promise<void> {
  const preferences = await storage.read();

  emit({ preferences, loaded: true });
}

/**
 * Applies a change in memory immediately, then persists it.
 *
 * The in-memory update is synchronous so the UI reflects the choice on the next
 * render rather than after a file write. A failed write leaves the app in the
 * chosen state for this session and is not surfaced: losing a theme preference
 * is not worth an error dialog.
 */
export async function updatePreferences(
  patch: Partial<Preferences>,
  storage: PreferencesStoragePort = preferencesStorage,
): Promise<void> {
  const preferences = { ...state.preferences, ...patch };

  emit({ preferences, loaded: true });

  try {
    await storage.write(preferences);
  } catch {
    // Deliberately swallowed; see above.
  }
}

/** Test seam. Production never resets. */
export function resetPreferencesStore(): void {
  emit({ preferences: { ...defaultPreferences }, loaded: false });
}

export function usePreferencesState(): PreferencesState {
  return useSyncExternalStore(subscribe, getPreferencesState, getPreferencesState);
}

export function usePreferences(): Preferences {
  return usePreferencesState().preferences;
}
