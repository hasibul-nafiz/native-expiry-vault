import { utf8ToBytes } from '@noble/hashes/utils.js';

import { deriveKey, openFrame, PBKDF2_ITERATIONS, sealFrame } from './crypto';
import { BackupError } from './errors';
import {
  bytesToHex,
  decodeContainer,
  encodeContainer,
  FORMAT_VERSION,
  hexToBytes,
  NONCE_BYTES,
  SALT_BYTES,
  type BackupHeader,
  CIPHER_ID,
  KDF_ID,
} from './format';

/**
 * Sealing and opening a whole `.evault` container.
 *
 * This is the layer the corrupt-file tests aim at: it needs no database, no
 * filesystem and no native module, so every way a file can be damaged is
 * expressible as a byte edit and a single assertion.
 *
 * Frame 0 is the manifest and is opened eagerly, because opening it is what
 * proves the password. Later frames hold attachment bytes and are opened one at
 * a time on request, so restoring a vault with 200MB of scans does not first
 * build 200MB of plaintext in memory.
 */

export interface ContainerSecrets {
  /** `SALT_BYTES` of CSPRNG output. */
  salt: Uint8Array;
  /** `NONCE_BYTES` of CSPRNG output. */
  nonce: Uint8Array;
}

export interface OpenedContainer {
  version: number;
  /** The manifest frame, decrypted. Everything else in the file is described by it. */
  manifest: Uint8Array;
  /** Attachment frames only; the verifier and the manifest are not counted. */
  attachmentFrameCount: number;
  /** Opens attachment frame `index`, counting from 0. */
  openAttachmentFrame(index: number): Uint8Array;
}

/**
 * Frame 0 seals a known constant and nothing else.
 *
 * Without it, a wrong password and a corrupted manifest are the same event —
 * an authentication failure on the first real frame — and the app would have to
 * guess which to report. Telling someone to check their password when the file
 * is damaged sends them round a loop they cannot get out of.
 *
 * It gives an offline attacker no new leverage: trying a candidate password
 * against this frame costs exactly what trying it against the manifest costs,
 * and they could always do the latter. The price is 32 bytes.
 */
const VERIFIER_PLAINTEXT = utf8ToBytes('expiryvault-backup');

/** Frame indices. Attachment `i` is frame `i + ATTACHMENT_FRAME_OFFSET`. */
const VERIFIER_FRAME = 0;
const MANIFEST_FRAME = 1;
const ATTACHMENT_FRAME_OFFSET = 2;

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

/**
 * Builds the container. `frames[0]` must be the manifest; the verifier frame is
 * added here so no caller can forget it.
 *
 * The salt and nonce are parameters rather than generated here so a test can
 * produce a byte-identical file twice and diff it.
 */
export function sealContainer(
  password: string,
  frames: readonly Uint8Array[],
  secrets: ContainerSecrets,
  iterations: number = PBKDF2_ITERATIONS,
): Uint8Array {
  if (frames.length === 0) {
    throw new BackupError('corrupt', 'A container needs at least a manifest frame.');
  }

  if (secrets.salt.length !== SALT_BYTES || secrets.nonce.length !== NONCE_BYTES) {
    throw new BackupError('corrupt', 'Container secrets are the wrong length.');
  }

  const key = deriveKey(password, { salt: secrets.salt, iterations });

  const header: BackupHeader = {
    cipher: CIPHER_ID,
    kdf: KDF_ID,
    iterations,
    salt: bytesToHex(secrets.salt),
    nonce: bytesToHex(secrets.nonce),
  };

  const sealed = [VERIFIER_PLAINTEXT, ...frames].map((frame, index) =>
    sealFrame(key, secrets.nonce, index, FORMAT_VERSION, frame),
  );

  return encodeContainer(header, sealed);
}

/**
 * Parses the container and opens its manifest.
 *
 * A failure here is one of: not our file, a version we cannot read, structural
 * damage, or the wrong password — each already distinguished by the layers
 * below, so nothing is re-guessed at.
 */
export function openContainer(bytes: Uint8Array, password: string): OpenedContainer {
  const { version, header, frames } = decodeContainer(bytes);
  const key = deriveKey(password, {
    salt: hexToBytes(header.salt),
    iterations: header.iterations,
  });
  const baseNonce = hexToBytes(header.nonce);

  if (frames.length < ATTACHMENT_FRAME_OFFSET) {
    throw new BackupError('corrupt', 'The backup is missing its verifier or manifest frame.');
  }

  // The password check, and only the password check.
  const verifier = openFrame(
    key,
    baseNonce,
    VERIFIER_FRAME,
    version,
    frames[VERIFIER_FRAME],
    'wrong-password',
  );

  if (!sameBytes(verifier, VERIFIER_PLAINTEXT)) {
    throw new BackupError(
      'wrong-password',
      'The backup could not be opened with that password.',
    );
  }

  // Past this point the password is known to be right, so an authentication
  // failure can only mean the file is damaged.
  const manifest = openFrame(
    key,
    baseNonce,
    MANIFEST_FRAME,
    version,
    frames[MANIFEST_FRAME],
    'corrupt',
  );

  const attachmentFrameCount = frames.length - ATTACHMENT_FRAME_OFFSET;

  return {
    version,
    manifest,
    attachmentFrameCount,
    openAttachmentFrame(index: number) {
      if (!Number.isInteger(index) || index < 0 || index >= attachmentFrameCount) {
        throw new BackupError(
          'corrupt',
          `The backup does not contain attachment frame ${index}; it has ${attachmentFrameCount}.`,
        );
      }

      const frameIndex = index + ATTACHMENT_FRAME_OFFSET;

      return openFrame(key, baseNonce, frameIndex, version, frames[frameIndex], 'corrupt');
    },
  };
}
