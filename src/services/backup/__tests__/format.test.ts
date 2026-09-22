import { utf8ToBytes } from '@noble/hashes/utils.js';

import { BackupError } from '../errors';
import {
  decodeContainer,
  encodeContainer,
  FORMAT_VERSION,
  frameAssociatedData,
  frameNonce,
  MAGIC,
  NONCE_BYTES,
  parseHeader,
  SALT_BYTES,
  type BackupHeader,
} from '../format';

const header: BackupHeader = {
  cipher: 'xchacha20poly1305',
  kdf: 'pbkdf2-sha256',
  iterations: 10,
  salt: 'a'.repeat(SALT_BYTES * 2),
  nonce: 'b'.repeat(NONCE_BYTES * 2),
};

function frames(...sizes: number[]): Uint8Array[] {
  return sizes.map((size, index) => new Uint8Array(size).fill(index + 1));
}

function reasonOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof BackupError ? error.reason : `not-a-backup-error: ${String(error)}`;
  }

  return 'did-not-throw';
}

describe('frameNonce', () => {
  const base = new Uint8Array(NONCE_BYTES).fill(0);

  it('gives every frame a distinct nonce', () => {
    const seen = new Set(
      Array.from({ length: 500 }, (_, index) => frameNonce(base, index).join(',')),
    );

    expect(seen.size).toBe(500);
  });

  it('leaves the first twenty bytes of the base nonce alone', () => {
    expect(frameNonce(base, 7).slice(0, NONCE_BYTES - 4)).toEqual(base.slice(0, NONCE_BYTES - 4));
  });

  it('does not mutate the base nonce', () => {
    const original = new Uint8Array(NONCE_BYTES).fill(9);
    frameNonce(original, 3);

    expect(original.every((byte) => byte === 9)).toBe(true);
  });

  it('refuses a nonce of the wrong length', () => {
    expect(reasonOf(() => frameNonce(new Uint8Array(8), 0))).toBe('corrupt');
  });
});

describe('frameAssociatedData', () => {
  it('differs per frame index, so a moved frame cannot authenticate', () => {
    expect(frameAssociatedData(1, 0)).not.toEqual(frameAssociatedData(1, 1));
  });

  it('differs per format version, so frames cannot be spliced across versions', () => {
    expect(frameAssociatedData(1, 0)).not.toEqual(frameAssociatedData(2, 0));
  });
});

describe('parseHeader', () => {
  it('accepts a well-formed header', () => {
    expect(parseHeader({ ...header })).toEqual(header);
  });

  it.each([
    ['an unknown cipher', { ...header, cipher: 'aes-256-gcm' }, 'unsupported-version'],
    ['an unknown kdf', { ...header, kdf: 'argon2id' }, 'unsupported-version'],
    ['a zero iteration count', { ...header, iterations: 0 }, 'corrupt'],
    ['a fractional iteration count', { ...header, iterations: 1.5 }, 'corrupt'],
    ['a short salt', { ...header, salt: 'ab' }, 'corrupt'],
    ['a short nonce', { ...header, nonce: 'ab' }, 'corrupt'],
    ['an array', [], 'corrupt'],
    ['null', null, 'corrupt'],
  ])('rejects %s', (_label, input, reason) => {
    expect(reasonOf(() => parseHeader(input))).toBe(reason);
  });
});

describe('encodeContainer / decodeContainer', () => {
  it('round-trips the header and every frame', () => {
    const original = frames(32, 1000, 17);
    const decoded = decodeContainer(encodeContainer(header, original));

    expect(decoded.version).toBe(FORMAT_VERSION);
    expect(decoded.header).toEqual(header);
    expect(decoded.frames.map((frame) => [...frame])).toEqual(original.map((frame) => [...frame]));
  });

  it('starts with the magic bytes, so the file is identifiable without parsing', () => {
    expect(encodeContainer(header, frames(32)).slice(0, MAGIC.length)).toEqual(MAGIC);
  });

  it('rejects an empty file as not ours', () => {
    expect(reasonOf(() => decodeContainer(new Uint8Array(0)))).toBe('unsupported-format');
  });

  it('rejects a file with the wrong magic', () => {
    expect(reasonOf(() => decodeContainer(utf8ToBytes('PK\u0003\u0004 not a vault')))).toBe(
      'unsupported-format',
    );
  });

  it('rejects a newer format version rather than guessing at it', () => {
    const bytes = encodeContainer(header, frames(32));
    bytes[MAGIC.length + 1] = FORMAT_VERSION + 1;

    expect(reasonOf(() => decodeContainer(bytes))).toBe('unsupported-version');
  });

  it('rejects a file truncated inside its header', () => {
    const bytes = encodeContainer(header, frames(32));

    expect(reasonOf(() => decodeContainer(bytes.slice(0, 20)))).toBe('corrupt');
  });

  it('rejects a file truncated inside a frame', () => {
    const bytes = encodeContainer(header, frames(32, 64));

    expect(reasonOf(() => decodeContainer(bytes.slice(0, bytes.length - 10)))).toBe('corrupt');
  });

  it('rejects a header that is not JSON', () => {
    const bytes = encodeContainer(header, frames(32));
    // The first byte of the header body is `{`; anything else cannot parse.
    bytes[MAGIC.length + 2 + 4] = 0x21;

    expect(reasonOf(() => decodeContainer(bytes))).toBe('corrupt');
  });

  it('rejects a frame shorter than a Poly1305 tag', () => {
    const bytes = encodeContainer(header, [new Uint8Array(4)]);

    expect(reasonOf(() => decodeContainer(bytes))).toBe('corrupt');
  });

  it('rejects a container with no frames at all', () => {
    expect(reasonOf(() => decodeContainer(encodeContainer(header, [])))).toBe('corrupt');
  });
});
