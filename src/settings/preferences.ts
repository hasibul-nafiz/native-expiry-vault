/**
 * The app's user preferences: pure shape, defaults and parsing.
 *
 * These deliberately do NOT live in the encrypted database, reversing F2's
 * "settings table deferred to F11". Theme and language have to apply to the
 * lock screen, which renders *above* `DatabaseProvider` — reading them from
 * SQLCipher would paint the gate in the wrong theme and language before the
 * vault ever opens. None of these values is a secret, so a plain JSON file is
 * the right home and no migration is needed.
 *
 * Every field is parsed defensively: the file is user-writable on a rooted
 * device and survives app upgrades, so an unknown or malformed value falls back
 * to its default rather than propagating an invalid state into the UI.
 */

export const themePreferences = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof themePreferences)[number];

/**
 * Supported UI languages. `system` follows the device.
 *
 * Adding a locale is this array plus a translation file — the missing-key test
 * reads this list, so a new entry fails CI until its file is complete.
 */
export const languagePreferences = ['system', 'en', 'bn'] as const;
export type LanguagePreference = (typeof languagePreferences)[number];

/** Locales that have a translation file. `system` resolves into one of these. */
export const supportedLocales = ['en', 'bn'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export const FALLBACK_LOCALE: SupportedLocale = 'en';

/**
 * Auto-lock delays offered in Settings, in milliseconds.
 *
 * F9's `DEFAULT_GRACE_MS` (60s) is the default and stays the constant that
 * `useAutoLock` falls back to; this list is the set of choices around it.
 */
export const autoLockDelays = [0, 60_000, 300_000, 900_000] as const;
export type AutoLockDelay = (typeof autoLockDelays)[number];

/** Reminder delivery hour, 0-23. F7's `DEFAULT_REMINDER_HOUR` is 9. */
export const MIN_REMINDER_HOUR = 0;
export const MAX_REMINDER_HOUR = 23;

export interface Preferences {
  theme: ThemePreference;
  language: LanguagePreference;
  /** Local hour at which reminders are delivered. */
  reminderHour: number;
  autoLockDelayMs: AutoLockDelay;
  /**
   * Offer biometric unlock when the hardware has an enrolment. Closes F9's
   * logged gap that biometrics could not be turned off independently of the PIN.
   */
  biometricUnlock: boolean;
}

export const defaultPreferences: Preferences = {
  theme: 'system',
  language: 'system',
  reminderHour: 9,
  autoLockDelayMs: 60_000,
  biometricUnlock: true,
};

function oneOf<T extends string | number>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function hourOr(value: unknown, fallback: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < MIN_REMINDER_HOUR ||
    value > MAX_REMINDER_HOUR
  ) {
    return fallback;
  }

  return value;
}

/**
 * Parses whatever was on disk into a complete, valid `Preferences`.
 *
 * Never throws and never returns a partial object: a corrupt file, a missing
 * field or a value from a newer version all resolve to the default for that
 * field alone, so one bad entry cannot reset the rest.
 */
export function parsePreferences(raw: unknown): Preferences {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...defaultPreferences };
  }

  const input = raw as Record<string, unknown>;

  return {
    theme: oneOf(themePreferences, input.theme, defaultPreferences.theme),
    language: oneOf(languagePreferences, input.language, defaultPreferences.language),
    reminderHour: hourOr(input.reminderHour, defaultPreferences.reminderHour),
    autoLockDelayMs: oneOf(
      autoLockDelays,
      input.autoLockDelayMs,
      defaultPreferences.autoLockDelayMs,
    ),
    biometricUnlock: boolOr(input.biometricUnlock, defaultPreferences.biometricUnlock),
  };
}

/**
 * Resolves the language preference to a locale with a translation file.
 *
 * `deviceLocales` is the ordered list the OS reports; the first one the app
 * supports wins, matching on the language subtag so `bn-BD` and `bn-IN` both
 * resolve to `bn`.
 */
export function resolveLocale(
  language: LanguagePreference,
  deviceLocales: readonly string[],
): SupportedLocale {
  if (language !== 'system') {
    return language;
  }

  for (const tag of deviceLocales) {
    const subtag = tag.toLowerCase().split('-')[0];
    const match = supportedLocales.find((locale) => locale === subtag);

    if (match !== undefined) {
      return match;
    }
  }

  return FALLBACK_LOCALE;
}
