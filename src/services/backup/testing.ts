import { BackupError } from './errors';
import type { BackupFileSystemPort } from './fileSystem';

/**
 * An in-memory `BackupFileSystemPort`, so export, restore and every failure
 * path run without a native module.
 *
 * It lives outside `__tests__/` so Jest does not collect it as a suite, and it
 * is never imported by application code, so Metro never bundles it — the same
 * arrangement `src/db/testing/betterSqlite3.ts` has.
 *
 * It models the two things that actually matter for correctness: that staging
 * is a separate place from the live directory, and that promoting replaces one
 * with the other wholesale. Failures are injectable, because most of what this
 * feature promises is about what happens when a write goes wrong.
 */

const DOCUMENT_ROOT = 'file:///documents';
const ATTACHMENTS_ROOT = `${DOCUMENT_ROOT}/attachments`;
const CACHE_ROOT = 'file:///cache/exports';

export interface FakeBackupFileSystem extends BackupFileSystemPort {
  /** Live attachment files, keyed by relative path. */
  readonly live: Map<string, Uint8Array>;
  /** Staged files, keyed by relative path. Empty unless a restore is running. */
  readonly staging: Map<string, Uint8Array>;
  readonly exports: Map<string, Uint8Array>;
  /** Number of times staging has been swapped in. */
  promoteCount: number;
  /** Throw from `writeStagedAttachment` once the nth file is reached. */
  failStagingAt: number | null;
  /** Throw from `promoteStaging`. */
  failPromote: boolean;
  /** Seeds a live attachment and returns the absolute URI a row would hold. */
  addLiveFile(relativePath: string, bytes: Uint8Array): string;
  uriFor(relativePath: string): string;
}

export function createFakeFileSystem(): FakeBackupFileSystem {
  const live = new Map<string, Uint8Array>();
  const staging = new Map<string, Uint8Array>();
  const exports = new Map<string, Uint8Array>();

  const uriFor = (relativePath: string) => `${ATTACHMENTS_ROOT}/${relativePath}`;
  const relativeOf = (fileUri: string) =>
    fileUri.startsWith(`${ATTACHMENTS_ROOT}/`) ? fileUri.slice(ATTACHMENTS_ROOT.length + 1) : null;

  const fileSystem: FakeBackupFileSystem = {
    live,
    staging,
    exports,
    promoteCount: 0,
    failStagingAt: null,
    failPromote: false,

    addLiveFile(relativePath, bytes) {
      live.set(relativePath, bytes);

      return uriFor(relativePath);
    },

    uriFor,

    async readAttachment(fileUri) {
      const relative = relativeOf(fileUri);

      return relative === null ? null : (live.get(relative) ?? null);
    },

    async listAttachmentPaths() {
      return [...live.keys()];
    },

    async writeStagedAttachment(relativePath, bytes) {
      if (relativePath.split('/').some((segment) => segment === '..' || segment === '')) {
        throw new BackupError('invalid-payload', `Unsafe path: ${relativePath}`);
      }

      if (fileSystem.failStagingAt !== null && staging.size >= fileSystem.failStagingAt) {
        throw new BackupError('io', 'Disk full.');
      }

      staging.set(relativePath, bytes);
    },

    restoredUri(relativePath) {
      return uriFor(relativePath);
    },

    async clearStaging() {
      staging.clear();
    },

    async promoteStaging() {
      if (fileSystem.failPromote) {
        throw new BackupError('io', 'Rename failed.');
      }

      live.clear();

      for (const [path, bytes] of staging) {
        live.set(path, bytes);
      }

      staging.clear();
      fileSystem.promoteCount += 1;
    },

    async fileExists(fileUri) {
      const relative = relativeOf(fileUri);

      return relative !== null && live.has(relative);
    },

    async writeExport(fileName, bytes) {
      exports.set(fileName, bytes);

      return `${CACHE_ROOT}/${fileName}`;
    },

    async deleteExport(fileUri) {
      exports.delete(fileUri.split('/').pop() ?? '');
    },

    async readContainerFile(fileUri) {
      const bytes = exports.get(fileUri.split('/').pop() ?? '');

      if (bytes === undefined) {
        throw new BackupError('io', `No such file: ${fileUri}`);
      }

      return bytes;
    },
  };

  return fileSystem;
}

/**
 * Deterministic "random" bytes.
 *
 * A backup sealed twice with the same password and the same counter is
 * byte-identical, which is what lets a test diff two containers and assert that
 * only the intended byte changed.
 */
export function createFakeRandomBytes(seed = 1): (length: number) => Promise<Uint8Array> {
  let counter = seed;

  return async (length: number) => {
    const bytes = new Uint8Array(length);

    for (let index = 0; index < length; index += 1) {
      bytes[index] = (counter + index) % 256;
    }

    counter += 1;

    return bytes;
  };
}
