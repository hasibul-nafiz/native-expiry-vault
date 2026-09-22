import {
  MIN_PASSWORD_LENGTH,
  validateBackupPassword,
  validatePasswordConfirmation,
} from '../password';

describe('validateBackupPassword', () => {
  it('accepts a passphrase of the minimum length', () => {
    expect(validateBackupPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1) + 'b')).toEqual({ ok: true });
  });

  it('accepts an ordinary passphrase', () => {
    expect(validateBackupPassword('correct horse battery staple')).toEqual({ ok: true });
  });

  it('rejects one character short of the minimum', () => {
    expect(validateBackupPassword('ab'.repeat(MIN_PASSWORD_LENGTH / 2 - 1))).toEqual({
      ok: false,
      problem: 'too-short',
    });
  });

  it('rejects an empty passphrase', () => {
    expect(validateBackupPassword('')).toEqual({ ok: false, problem: 'too-short' });
  });

  it('rejects one long enough but made of one repeated character', () => {
    expect(validateBackupPassword('aaaaaaaaaaaaaaaa')).toEqual({
      ok: false,
      problem: 'single-character',
    });
  });

  it('rejects an absurdly long passphrase rather than spending a minute on it', () => {
    expect(validateBackupPassword('a'.repeat(1000))).toEqual({ ok: false, problem: 'too-long' });
  });

  it('counts a passphrase with spaces and punctuation by its length, not its shape', () => {
    expect(validateBackupPassword('my dog has fleas')).toEqual({ ok: true });
  });

  /** Emoji are surrogate pairs; the length rule must not be fooled into a short key. */
  it('measures non-Latin text by its code units', () => {
    expect(validateBackupPassword('পাসওয়ার্ড বাক্য')).toEqual({ ok: true });
  });
});

describe('validatePasswordConfirmation', () => {
  it('accepts two identical valid passphrases', () => {
    expect(validatePasswordConfirmation('a long enough phrase', 'a long enough phrase')).toEqual({
      ok: true,
    });
  });

  it('reports a mismatch', () => {
    expect(validatePasswordConfirmation('a long enough phrase', 'a long enough phrasf')).toEqual({
      ok: false,
      problem: 'mismatch',
    });
  });

  /** The passphrase's own problem is the more useful thing to report first. */
  it('reports the passphrase problem before the mismatch', () => {
    expect(validatePasswordConfirmation('short', 'different')).toEqual({
      ok: false,
      problem: 'too-short',
    });
  });

  it('rejects an empty confirmation', () => {
    expect(validatePasswordConfirmation('a long enough phrase', '')).toEqual({
      ok: false,
      problem: 'mismatch',
    });
  });
});
