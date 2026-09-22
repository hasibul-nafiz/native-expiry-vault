import {
  defaultPreferences,
  parsePreferences,
  resolveLocale,
  type Preferences,
} from '../preferences';

describe('parsePreferences', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'system'],
    ['an array', []],
    ['a number', 7],
  ])('falls back to defaults for %s', (_label, raw) => {
    expect(parsePreferences(raw)).toEqual(defaultPreferences);
  });

  it('reads a complete, valid file', () => {
    const stored: Preferences = {
      theme: 'dark',
      language: 'bn',
      reminderHour: 18,
      autoLockDelayMs: 300_000,
      biometricUnlock: false,
    };

    expect(parsePreferences(stored)).toEqual(stored);
  });

  it('fills in only the missing fields', () => {
    expect(parsePreferences({ theme: 'light' })).toEqual({
      ...defaultPreferences,
      theme: 'light',
    });
  });

  /**
   * One bad field must not reset the others — a file written by a newer version
   * with an unknown theme should still keep the user's language.
   */
  it('rejects a single invalid field without discarding the rest', () => {
    const parsed = parsePreferences({ theme: 'solarized', language: 'bn' });

    expect(parsed.theme).toBe(defaultPreferences.theme);
    expect(parsed.language).toBe('bn');
  });

  describe('reminderHour', () => {
    it.each([0, 9, 23])('accepts %i', (hour) => {
      expect(parsePreferences({ reminderHour: hour }).reminderHour).toBe(hour);
    });

    it.each([
      ['below range', -1],
      ['above range', 24],
      ['fractional', 9.5],
      ['a string', '9'],
      ['NaN', Number.NaN],
    ])('rejects %s', (_label, hour) => {
      expect(parsePreferences({ reminderHour: hour }).reminderHour).toBe(
        defaultPreferences.reminderHour,
      );
    });
  });

  it('rejects an auto-lock delay that is not one of the offered choices', () => {
    expect(parsePreferences({ autoLockDelayMs: 12_345 }).autoLockDelayMs).toBe(
      defaultPreferences.autoLockDelayMs,
    );
  });

  it('accepts a false boolean rather than treating it as missing', () => {
    expect(parsePreferences({ biometricUnlock: false }).biometricUnlock).toBe(false);
  });

  it('ignores unknown keys', () => {
    expect(parsePreferences({ theme: 'dark', somethingElse: 1 })).toEqual({
      ...defaultPreferences,
      theme: 'dark',
    });
  });
});

describe('resolveLocale', () => {
  it('uses an explicit choice regardless of the device', () => {
    expect(resolveLocale('bn', ['en-GB'])).toBe('bn');
    expect(resolveLocale('en', ['bn-BD'])).toBe('en');
  });

  it('follows the device when set to system', () => {
    expect(resolveLocale('system', ['bn-BD', 'en-US'])).toBe('bn');
  });

  it('matches on the language subtag, so regional variants resolve', () => {
    expect(resolveLocale('system', ['bn-IN'])).toBe('bn');
    expect(resolveLocale('system', ['en-AU'])).toBe('en');
  });

  it('is case-insensitive', () => {
    expect(resolveLocale('system', ['BN-BD'])).toBe('bn');
  });

  it('takes the first supported locale in the device list', () => {
    expect(resolveLocale('system', ['fr-FR', 'bn-BD', 'en-US'])).toBe('bn');
  });

  it('falls back to English when nothing matches', () => {
    expect(resolveLocale('system', ['fr-FR', 'de-DE'])).toBe('en');
  });

  it('falls back to English for an empty device list', () => {
    expect(resolveLocale('system', [])).toBe('en');
  });
});
