import { utf8ToBytes } from '@noble/hashes/utils.js';

import { openContainer, sealContainer } from '../container';
import { BackupError } from '../errors';
import { decodeContainer, encodeContainer, NONCE_BYTES, SALT_BYTES } from '../format';

/**
 * The corrupt-file matrix.
 *
 * This layer needs no database, no filesystem and no native module, so every
 * way a backup file can be damaged is one byte edit and one assertion. That is
 * the point of keeping the container pure.
 *
 * `ITERATIONS` is 10 rather than the shipped 300,000: the KDF is what makes a
 * real export slow, and re-deriving it thirty times over would make this suite
 * take minutes to assert nothing about PBKDF2. The shipped count is pinned in
 * `crypto.test.ts` instead.
 */

const ITERATIONS = 10;
const PASSWORD = 'correct horse battery staple';

const SECRETS = {
  salt: new Uint8Array(SALT_BYTES).fill(7),
  nonce: new Uint8Array(NONCE_BYTES).fill(9),
};

const MANIFEST = utf8ToBytes('{"payloadVersion":1}');
const ATTACHMENT_A = utf8ToBytes('first attachment bytes');
const ATTACHMENT_B = utf8ToBytes('second attachment bytes');

function seal(frames: readonly Uint8Array[] = [MANIFEST, ATTACHMENT_A, ATTACHMENT_B]): Uint8Array {
  return sealContainer(PASSWORD, frames, SECRETS, ITERATIONS);
}

function reasonOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof BackupError ? error.reason : `not-a-backup-error: ${String(error)}`;
  }

  return 'did-not-throw';
}

/** Rebuilds a container from its own frames, reordered or dropped. */
function rebuild(bytes: Uint8Array, change: (frames: Uint8Array[]) => Uint8Array[]): Uint8Array {
  const { header, frames } = decodeContainer(bytes);

  return encodeContainer(header, change([...frames]));
}

describe('sealContainer / openContainer', () => {
  it('round-trips the manifest and every attachment', () => {
    const opened = openContainer(seal(), PASSWORD);

    expect(opened.manifest).toEqual(MANIFEST);
    expect(opened.attachmentFrameCount).toBe(2);
    expect(opened.openAttachmentFrame(0)).toEqual(ATTACHMENT_A);
    expect(opened.openAttachmentFrame(1)).toEqual(ATTACHMENT_B);
  });

  it('seals a manifest with no attachments', () => {
    const opened = openContainer(seal([MANIFEST]), PASSWORD);

    expect(opened.manifest).toEqual(MANIFEST);
    expect(opened.attachmentFrameCount).toBe(0);
  });

  it('produces the same bytes twice for the same inputs', () => {
    expect(seal()).toEqual(seal());
  });

  it('encrypts: no plaintext survives in the file', () => {
    const bytes = seal();
    const haystack = String.fromCharCode(...bytes);

    expect(haystack).not.toContain('first attachment bytes');
    expect(haystack).not.toContain('payloadVersion');
  });

  it('leaks nothing but the KDF parameters in the plaintext header', () => {
    const { header } = decodeContainer(seal());

    // No counts, no dates, no titles — an encrypted backup that advertises its
    // contents in the clear defeats the point of encrypting it.
    expect(Object.keys(header).sort()).toEqual(['cipher', 'iterations', 'kdf', 'nonce', 'salt']);
  });

  it('refuses to seal nothing', () => {
    expect(reasonOf(() => seal([]))).toBe('corrupt');
  });

  it('refuses secrets of the wrong length', () => {
    expect(
      reasonOf(() =>
        sealContainer(PASSWORD, [MANIFEST], { salt: new Uint8Array(4), nonce: SECRETS.nonce }),
      ),
    ).toBe('corrupt');
  });
});

describe('a damaged or hostile file', () => {
  it('reports the wrong password as a wrong password', () => {
    expect(reasonOf(() => openContainer(seal(), 'not the password'))).toBe('wrong-password');
  });

  it('reports an empty password as a wrong password, not a crash', () => {
    expect(reasonOf(() => openContainer(seal(), ''))).toBe('wrong-password');
  });

  /**
   * The verifier frame is what makes this distinguishable. Without it, a
   * damaged manifest is an authentication failure on the first real frame and
   * is indistinguishable from a typo — which would send someone re-entering a
   * correct password forever.
   */
  it('reports a damaged manifest as corrupt, not as a wrong password', () => {
    const bytes = seal();
    const { frames } = decodeContainer(bytes);
    const manifestStart = bytes.length - frames.slice(1).reduce((n, f) => n + f.length + 4, 0);
    bytes[manifestStart + 4] ^= 0xff;

    expect(reasonOf(() => openContainer(bytes, PASSWORD))).toBe('corrupt');
  });

  it('reports a flipped byte in an attachment as corrupt', () => {
    const bytes = seal();
    bytes[bytes.length - 5] ^= 0x01;
    const opened = openContainer(bytes, PASSWORD);

    expect(reasonOf(() => opened.openAttachmentFrame(1))).toBe('corrupt');
  });

  it('reports a flipped byte in the final tag as corrupt', () => {
    const bytes = seal();
    bytes[bytes.length - 1] ^= 0x80;
    const opened = openContainer(bytes, PASSWORD);

    expect(reasonOf(() => opened.openAttachmentFrame(1))).toBe('corrupt');
  });

  it('rejects reordered attachment frames', () => {
    const bytes = rebuild(seal(), (frames) => [frames[0], frames[1], frames[3], frames[2]]);
    const opened = openContainer(bytes, PASSWORD);

    // The frame index is in the associated data, so a frame in the wrong slot
    // cannot authenticate rather than decrypting into the wrong attachment.
    expect(reasonOf(() => opened.openAttachmentFrame(0))).toBe('corrupt');
  });

  it('rejects a duplicated frame', () => {
    const bytes = rebuild(seal(), (frames) => [frames[0], frames[1], frames[2], frames[2]]);
    const opened = openContainer(bytes, PASSWORD);

    expect(reasonOf(() => opened.openAttachmentFrame(1))).toBe('corrupt');
  });

  it('notices a dropped trailing frame through the count', () => {
    const bytes = rebuild(seal(), (frames) => frames.slice(0, 3));

    expect(openContainer(bytes, PASSWORD).attachmentFrameCount).toBe(1);
  });

  it('rejects a container holding only a verifier', () => {
    const bytes = rebuild(seal(), (frames) => frames.slice(0, 1));

    expect(reasonOf(() => openContainer(bytes, PASSWORD))).toBe('corrupt');
  });

  it('refuses an attachment frame that does not exist', () => {
    const opened = openContainer(seal(), PASSWORD);

    expect(reasonOf(() => opened.openAttachmentFrame(9))).toBe('corrupt');
    expect(reasonOf(() => opened.openAttachmentFrame(-1))).toBe('corrupt');
  });

  it('rejects frames spliced in from a container sealed with another password', () => {
    const other = sealContainer('a completely different passphrase', [MANIFEST], SECRETS, ITERATIONS);
    const otherFrames = decodeContainer(other).frames;
    const bytes = rebuild(seal(), (frames) => [frames[0], otherFrames[1], frames[2], frames[3]]);

    expect(reasonOf(() => openContainer(bytes, PASSWORD))).toBe('corrupt');
  });

  it('rejects a file that is not ours at all', () => {
    expect(reasonOf(() => openContainer(utf8ToBytes('hello, world'), PASSWORD))).toBe(
      'unsupported-format',
    );
  });

  it('treats a tampered salt as a wrong password, which is what it amounts to', () => {
    const bytes = seal();
    // The salt is plaintext and unauthenticated by design: it has to be read
    // before any key exists. Changing it derives a different key, so the file
    // no longer opens — it is not a way in.
    const saltPosition = String.fromCharCode(...bytes).indexOf('"salt":"') + 8;
    bytes[saltPosition] = bytes[saltPosition] === 0x30 ? 0x31 : 0x30;

    expect(reasonOf(() => openContainer(bytes, PASSWORD))).toBe('wrong-password');
  });
});
