import { defaultPreferences, type Preferences } from '../preferences';
import type { PreferencesStoragePort } from '../storage';
import {
  getPreferencesState,
  initialisePreferences,
  resetPreferencesStore,
  updatePreferences,
} from '../store';

function fakeStorage(initial: Preferences = defaultPreferences): PreferencesStoragePort & {
  written: Preferences[];
} {
  const written: Preferences[] = [];

  return {
    written,
    read: async () => ({ ...initial }),
    write: async (preferences) => {
      written.push(preferences);
    },
  };
}

beforeEach(() => {
  resetPreferencesStore();
});

describe('initialisePreferences', () => {
  it('starts unloaded so the splash can hold', () => {
    expect(getPreferencesState().loaded).toBe(false);
  });

  it('loads what storage returns', async () => {
    await initialisePreferences(fakeStorage({ ...defaultPreferences, theme: 'dark' }));

    expect(getPreferencesState()).toEqual({
      preferences: { ...defaultPreferences, theme: 'dark' },
      loaded: true,
    });
  });
});

describe('updatePreferences', () => {
  it('applies the change in memory immediately', async () => {
    const storage = fakeStorage();
    await initialisePreferences(storage);

    const pending = updatePreferences({ theme: 'light' }, storage);

    // Before the write resolves: the UI must not wait on the filesystem.
    expect(getPreferencesState().preferences.theme).toBe('light');
    await pending;
  });

  it('persists the whole object, not just the patch', async () => {
    const storage = fakeStorage({ ...defaultPreferences, language: 'bn' });
    await initialisePreferences(storage);

    await updatePreferences({ theme: 'dark' }, storage);

    expect(storage.written).toEqual([{ ...defaultPreferences, language: 'bn', theme: 'dark' }]);
  });

  it('merges successive changes', async () => {
    const storage = fakeStorage();
    await initialisePreferences(storage);

    await updatePreferences({ theme: 'dark' }, storage);
    await updatePreferences({ reminderHour: 20 }, storage);

    expect(getPreferencesState().preferences).toMatchObject({
      theme: 'dark',
      reminderHour: 20,
    });
  });

  /**
   * Losing a theme preference is not worth an error dialog, and throwing here
   * would reject an unawaited promise inside an onPress handler.
   */
  it('keeps the change for this session when the write fails', async () => {
    const failing: PreferencesStoragePort = {
      read: async () => ({ ...defaultPreferences }),
      write: async () => {
        throw new Error('read-only filesystem');
      },
    };
    await initialisePreferences(failing);

    await expect(updatePreferences({ theme: 'dark' }, failing)).resolves.toBeUndefined();
    expect(getPreferencesState().preferences.theme).toBe('dark');
  });
});
