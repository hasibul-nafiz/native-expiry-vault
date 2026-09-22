import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

import { BackupError } from './errors';

/**
 * The `.evault` container: magic, header and framing. Pure byte work — nothing
 * here encrypts, and nothing here knows what a vault is.
 *
 * ```
 * magic "EVAULT" | version u16 | headerLen u32 | header JSON | frame*
 * frame:  len u32 | ciphertext ‖ Poly1305 tag
 * ```
 *
 * The header is plaintext because the KDF parameters must be readable before a
 * password can be checked. It therefore carries the parameters and **nothing
 * else** — no counts, no dates, no titles. An encrypted backup whose header
 * advertises "47 documents, created 2026-09-22" leaks the very thing it exists
 * to protect, so even the frame count lives inside the encrypted manifest
 * instead.
 *
 * Every integer is big-endian and fixed width, so the container is parseable
 * without a schema and a truncated file fails on a length check rather than on
 * a surprising allocation.
 */

/** Six bytes. Enough to reject an unrelated file before anything else runs. */
export const MAGIC = utf8ToBytes('EVAULT');

/** The container version this build writes. Payload versioning is separate. */
export const FORMAT_VERSION = 1;

/** XChaCha20's extended nonce. */
export const NONCE_BYTES = 24;
export const SALT_BYTES = 16;
export const POLY1305_TAG_BYTES = 16;

const VERSION_BYTES = 2;
const LENGTH_BYTES = 4;
const HEADER_OFFSET = MAGIC.length + VERSION_BYTES + LENGTH_BYTES;

/**
 * A ceiling on any single declared length, so a corrupt file cannot ask for a
 * multi-gigabyte allocation before the length is compared against what is
 * actually there. Far above any plausible attachment.
 */
const MAX_DECLARED_LENGTH = 512 * 1024 * 1024;

export const CIPHER_ID = 'xchacha20poly1305';
export const KDF_ID = 'pbkdf2-sha256';

/**
 * The plaintext header. Self-describing, so the iteration count can be re-tuned
 * after a device measurement without making existing backups unreadable.
 */
export interface BackupHeader {
  cipher: typeof CIPHER_ID;
  kdf: typeof KDF_ID;
  iterations: number;
  /** Hex, `SALT_BYTES` long. */
  salt: string;
  /** Hex, `NONCE_BYTES` long. The per-frame nonce is derived from it. */
  nonce: string;
}

export interface ParsedContainer {
  version: number;
  header: BackupHeader;
  frames: Uint8Array[];
}

function corrupt(message: string): BackupError {
  return new BackupError('corrupt', message);
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32(bytes: Uint8Array, offset: number): number {
  // `>>> 0` keeps the result unsigned; a length with the top bit set would
  // otherwise read as negative and skip the range checks below.
  return (
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>>
    0
  );
}

function writeUint16(target: Uint8Array, offset: number, value: number): void {
  target[offset] = (value >>> 8) & 0xff;
  target[offset + 1] = value & 0xff;
}

function writeUint32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function startsWithMagic(bytes: Uint8Array): boolean {
  if (bytes.length < MAGIC.length) {
    return false;
  }

  return MAGIC.every((byte, index) => bytes[index] === byte);
}

/**
 * The associated data every frame is authenticated against.
 *
 * Binding the frame's index means a frame moved, duplicated or swapped with
 * another fails to authenticate rather than decrypting into the wrong slot.
 * Binding the magic and version stops a frame from one container being spliced
 * into a container of a different version.
 */
export function frameAssociatedData(version: number, frameIndex: number): Uint8Array {
  const aad = new Uint8Array(MAGIC.length + VERSION_BYTES + LENGTH_BYTES);

  aad.set(MAGIC, 0);
  writeUint16(aad, MAGIC.length, version);
  writeUint32(aad, MAGIC.length + VERSION_BYTES, frameIndex);

  return aad;
}

/**
 * The nonce for one frame: the base nonce with the frame index XORed into its
 * last four bytes.
 *
 * XChaCha20's nonce is 24 random bytes, so a per-frame counter in the low word
 * keeps every frame's nonce distinct under one key without a second random
 * draw, which is the property Poly1305 needs. Unique for any container with
 * fewer than 2^32 frames.
 */
export function frameNonce(baseNonce: Uint8Array, frameIndex: number): Uint8Array {
  if (baseNonce.length !== NONCE_BYTES) {
    throw corrupt(`Nonce must be ${NONCE_BYTES} bytes, got ${baseNonce.length}.`);
  }

  const nonce = Uint8Array.from(baseNonce);
  const offset = NONCE_BYTES - LENGTH_BYTES;

  nonce[offset] ^= (frameIndex >>> 24) & 0xff;
  nonce[offset + 1] ^= (frameIndex >>> 16) & 0xff;
  nonce[offset + 2] ^= (frameIndex >>> 8) & 0xff;
  nonce[offset + 3] ^= frameIndex & 0xff;

  return nonce;
}

/** Rejects a header that parsed as JSON but describes something unusable. */
export function parseHeader(raw: unknown): BackupHeader {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw corrupt('The backup header is not an object.');
  }

  const input = raw as Record<string, unknown>;

  if (input.cipher !== CIPHER_ID) {
    throw new BackupError(
      'unsupported-version',
      `Unsupported cipher: ${String(input.cipher)}. This build reads ${CIPHER_ID}.`,
    );
  }

  if (input.kdf !== KDF_ID) {
    throw new BackupError(
      'unsupported-version',
      `Unsupported key derivation: ${String(input.kdf)}. This build reads ${KDF_ID}.`,
    );
  }

  const { iterations, salt, nonce } = input;

  if (typeof iterations !== 'number' || !Number.isInteger(iterations) || iterations < 1) {
    throw corrupt('The backup header has no usable iteration count.');
  }

  if (typeof salt !== 'string' || salt.length !== SALT_BYTES * 2) {
    throw corrupt('The backup header has no usable salt.');
  }

  if (typeof nonce !== 'string' || nonce.length !== NONCE_BYTES * 2) {
    throw corrupt('The backup header has no usable nonce.');
  }

  return { cipher: CIPHER_ID, kdf: KDF_ID, iterations, salt, nonce };
}

export function encodeContainer(header: BackupHeader, frames: readonly Uint8Array[]): Uint8Array {
  const headerBytes = utf8ToBytes(JSON.stringify(header));
  const framesLength = frames.reduce((total, frame) => total + LENGTH_BYTES + frame.length, 0);
  const container = new Uint8Array(HEADER_OFFSET + headerBytes.length + framesLength);

  container.set(MAGIC, 0);
  writeUint16(container, MAGIC.length, FORMAT_VERSION);
  writeUint32(container, MAGIC.length + VERSION_BYTES, headerBytes.length);
  container.set(headerBytes, HEADER_OFFSET);

  let offset = HEADER_OFFSET + headerBytes.length;

  for (const frame of frames) {
    writeUint32(container, offset, frame.length);
    offset += LENGTH_BYTES;
    container.set(frame, offset);
    offset += frame.length;
  }

  return container;
}

export function decodeContainer(bytes: Uint8Array): ParsedContainer {
  if (!startsWithMagic(bytes)) {
    throw new BackupError('unsupported-format', 'This file is not an ExpiryVault backup.');
  }

  if (bytes.length < HEADER_OFFSET) {
    throw corrupt('The backup file ends before its header length.');
  }

  const version = readUint16(bytes, MAGIC.length);

  if (version > FORMAT_VERSION) {
    throw new BackupError(
      'unsupported-version',
      `This backup is format version ${version}; this app reads up to ${FORMAT_VERSION}. Update the app to restore it.`,
    );
  }

  const headerLength = readUint32(bytes, MAGIC.length + VERSION_BYTES);

  if (headerLength === 0 || headerLength > MAX_DECLARED_LENGTH) {
    throw corrupt('The backup header length is implausible.');
  }

  const headerEnd = HEADER_OFFSET + headerLength;

  if (headerEnd > bytes.length) {
    throw corrupt('The backup file ends inside its header.');
  }

  let header: BackupHeader;

  try {
    header = parseHeader(
      JSON.parse(new TextDecoder().decode(bytes.subarray(HEADER_OFFSET, headerEnd))),
    );
  } catch (cause) {
    if (cause instanceof BackupError) {
      throw cause;
    }

    throw corrupt('The backup header is not readable JSON.');
  }

  const frames: Uint8Array[] = [];
  let offset = headerEnd;

  while (offset < bytes.length) {
    if (offset + LENGTH_BYTES > bytes.length) {
      throw corrupt('The backup file ends inside a frame length.');
    }

    const frameLength = readUint32(bytes, offset);
    offset += LENGTH_BYTES;

    if (frameLength < POLY1305_TAG_BYTES || frameLength > MAX_DECLARED_LENGTH) {
      throw corrupt('A backup frame declares an implausible length.');
    }

    if (offset + frameLength > bytes.length) {
      throw corrupt('The backup file ends inside a frame.');
    }

    frames.push(bytes.subarray(offset, offset + frameLength));
    offset += frameLength;
  }

  if (frames.length === 0) {
    throw corrupt('The backup file contains no frames.');
  }

  return { version, header, frames };
}

export { bytesToHex, hexToBytes };
