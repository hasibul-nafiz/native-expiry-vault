import { bytesToHex } from '@noble/hashes/utils.js';

import { deriveKey, DERIVED_KEY_BYTES, openFrame, PBKDF2_ITERATIONS, sealFrame } from '../crypto';
import { BackupError } from '../errors';
import { NONCE_BYTES, SALT_BYTES } from '../format';

const SALT = new Uint8Array(SALT_BYTES).fill(3);
const NONCE = new Uint8Array(NONCE_BYTES).fill(5);
const KEY = new Uint8Array(DERIVED_KEY_BYTES).fill(1);
const PLAINTEXT = new Uint8Array([1, 2, 3, 4, 5]);

function reasonOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof BackupError ? error.reason : `not-a-backup-error: ${String(error)}`;
  }

  return 'did-not-throw';
}

describe('deriveKey', () => {
  it('is deterministic for the same password and parameters', () => {
    const first = deriveKey('passphrase', { salt: SALT, iterations: 10 });
    const second = deriveKey('passphrase', { salt: SALT, iterations: 10 });

    expect(bytesToHex(first)).toBe(bytesToHex(second));
  });

  it('gives a different key for a different password', () => {
    expect(bytesToHex(deriveKey('a-passphrase', { salt: SALT, iterations: 10 }))).not.toBe(
      bytesToHex(deriveKey('b-passphrase', { salt: SALT, iterations: 10 })),
    );
  });

  /** The salt is what stops one precomputed table covering every backup. */
  it('gives a different key for a different salt', () => {
    const other = new Uint8Array(SALT_BYTES).fill(4);

    expect(bytesToHex(deriveKey('passphrase', { salt: SALT, iterations: 10 }))).not.toBe(
      bytesToHex(deriveKey('passphrase', { salt: other, iterations: 10 })),
    );
  });

  it('gives a different key for a different iteration count', () => {
    expect(bytesToHex(deriveKey('passphrase', { salt: SALT, iterations: 10 }))).not.toBe(
      bytesToHex(deriveKey('passphrase', { salt: SALT, iterations: 11 })),
    );
  });

  it('produces a 256-bit key', () => {
    expect(deriveKey('passphrase', { salt: SALT, iterations: 10 })).toHaveLength(32);
  });

  it('refuses a salt of the wrong length', () => {
    expect(reasonOf(() => deriveKey('p', { salt: new Uint8Array(4), iterations: 10 }))).toBe(
      'corrupt',
    );
  });

  it('refuses a nonsensical iteration count', () => {
    expect(reasonOf(() => deriveKey('p', { salt: SALT, iterations: 0 }))).toBe('corrupt');
  });

  /**
   * The shipped cost, pinned here rather than in a suite that runs it thirty
   * times. Lowering it is a security decision and should fail a test, not slip
   * through as a performance fix.
   */
  it('ships at 300,000 iterations', () => {
    expect(PBKDF2_ITERATIONS).toBe(300_000);
  });
});

describe('sealFrame / openFrame', () => {
  it('round-trips', () => {
    const sealed = sealFrame(KEY, NONCE, 0, 1, PLAINTEXT);

    expect(openFrame(KEY, NONCE, 0, 1, sealed, 'corrupt')).toEqual(PLAINTEXT);
  });

  it('adds a Poly1305 tag', () => {
    expect(sealFrame(KEY, NONCE, 0, 1, PLAINTEXT)).toHaveLength(PLAINTEXT.length + 16);
  });

  it('fails when opened at a different frame index', () => {
    const sealed = sealFrame(KEY, NONCE, 0, 1, PLAINTEXT);

    expect(reasonOf(() => openFrame(KEY, NONCE, 1, 1, sealed, 'corrupt'))).toBe('corrupt');
  });

  it('fails when opened under a different format version', () => {
    const sealed = sealFrame(KEY, NONCE, 0, 1, PLAINTEXT);

    expect(reasonOf(() => openFrame(KEY, NONCE, 0, 2, sealed, 'corrupt'))).toBe('corrupt');
  });

  it('fails under the wrong key', () => {
    const sealed = sealFrame(KEY, NONCE, 0, 1, PLAINTEXT);
    const other = new Uint8Array(DERIVED_KEY_BYTES).fill(2);

    expect(reasonOf(() => openFrame(other, NONCE, 0, 1, sealed, 'wrong-password'))).toBe(
      'wrong-password',
    );
  });

  it('reports the reason the caller asked for', () => {
    const sealed = sealFrame(KEY, NONCE, 0, 1, PLAINTEXT);
    sealed[0] ^= 0xff;

    expect(reasonOf(() => openFrame(KEY, NONCE, 0, 1, sealed, 'wrong-password'))).toBe(
      'wrong-password',
    );
    expect(reasonOf(() => openFrame(KEY, NONCE, 0, 1, sealed, 'corrupt'))).toBe('corrupt');
  });

  it('refuses a key of the wrong length', () => {
    expect(reasonOf(() => sealFrame(new Uint8Array(8), NONCE, 0, 1, PLAINTEXT))).toBe('corrupt');
  });

  it('never puts the plaintext in an error message', () => {
    const sealed = sealFrame(KEY, NONCE, 0, 1, PLAINTEXT);
    sealed[2] ^= 0xff;

    try {
      openFrame(KEY, NONCE, 0, 1, sealed, 'wrong-password');
      throw new Error('should not open');
    } catch (error) {
      expect((error as BackupError).message).toBe(
        'The backup could not be opened with that password.',
      );
    }
  });
});
