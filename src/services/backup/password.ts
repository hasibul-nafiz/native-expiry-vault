/**
 * The backup passphrase policy.
 *
 * This passphrase is the only thing protecting the exported file. The vault on
 * the device has three other layers — SQLCipher, the Keychain, the app lock —
 * but a `.evault` file sitting in a cloud drive or an email attachment has
 * exactly one, and `crypto.ts` explains why PBKDF2 alone cannot carry a weak
 * one. So the rules here are stricter than F9's PIN, which is defended by
 * hardware-backed storage and a lockout the attacker has to go through.
 *
 * Pure, and the same `{ ok }` shape as `validatePin`, so both read alike at
 * their call sites.
 */

/** Twelve characters. Long enough that PBKDF2 at 300,000 rounds is a real cost. */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 256;

export type PasswordProblem = 'too-short' | 'too-long' | 'single-character' | 'mismatch';

export type PasswordValidation = { ok: true } | { ok: false; problem: PasswordProblem };

function isSingleRepeatedCharacter(password: string): boolean {
  return [...password].every((character) => character === password[0]);
}

/**
 * Deliberately not a denylist or an entropy estimate.
 *
 * A denylist of common passwords is megabytes to be useful and would be bundled
 * into an app that ships no other word list; an entropy score would refuse
 * perfectly good passphrases for not containing a digit. Length is the rule
 * that actually correlates with cost to an attacker, so length is the rule.
 */
export function validateBackupPassword(password: string): PasswordValidation {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, problem: 'too-short' };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, problem: 'too-long' };
  }

  if (isSingleRepeatedCharacter(password)) {
    return { ok: false, problem: 'single-character' };
  }

  return { ok: true };
}

/**
 * Checks the confirmation field.
 *
 * There is no way to recover a backup whose password was mistyped — no reset,
 * no hint, no escrow — so the file is not written until the same passphrase has
 * been entered twice.
 */
export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): PasswordValidation {
  const primary = validateBackupPassword(password);

  if (!primary.ok) {
    return primary;
  }

  return password === confirmation ? { ok: true } : { ok: false, problem: 'mismatch' };
}
