import { File, Paths } from 'expo-file-system';

import { defaultPreferences, parsePreferences, type Preferences } from './preferences';

/**
 * Reads and writes the preferences file.
 *
 * A plain JSON file in the app's document directory, not secure-store and not
 * the encrypted database: these values gate the very first paint (see
 * `preferences.ts`), and none of them is a secret.
 *
 * Every failure resolves to defaults rather than throwing. A user whose
 * preferences file is unreadable should get a working app in system theme, not
 * a crash on launch.
 */

export const PREFERENCES_FILENAME = 'preferences.json';

export interface PreferencesStoragePort {
  read(): Promise<Preferences>;
  write(preferences: Preferences): Promise<void>;
}

function preferencesFile(): File {
  return new File(Paths.document, PREFERENCES_FILENAME);
}

export const preferencesStorage: PreferencesStoragePort = {
  async read() {
    try {
      const file = preferencesFile();

      if (!file.exists) {
        return { ...defaultPreferences };
      }

      return parsePreferences(JSON.parse(file.textSync()));
    } catch {
      // Unreadable or malformed JSON. `parsePreferences` already tolerates a
      // bad *shape*; this catches a file that will not parse at all.
      return { ...defaultPreferences };
    }
  },

  async write(preferences) {
    const file = preferencesFile();

    if (!file.exists) {
      file.create({ intermediates: true, overwrite: true });
    }

    file.write(JSON.stringify(preferences));
  },
};
