import { Directory, File, Paths } from 'expo-file-system';

import { BackupError, toBackupError } from './errors';

/**
 * Everything a backup does to the filesystem, behind one port.
 *
 * The port exists so that export, restore and every failure path can be tested
 * without a native module — the same containment `notifications.ts` and
 * `biometrics.ts` give their libraries. Below it, this file is the only place
 * in the feature that imports `expo-file-system`.
 *
 * Restore stages into a sibling directory and swaps it in *after* the database
 * transaction commits. A filesystem move cannot join a SQL transaction, so the
 * order is what makes failure survivable rather than atomic:
 *
 * 1. Write every attachment into `attachments-restore/`. A failure here deletes
 *    staging; the live vault has not been touched at all.
 * 2. Run the whole database transaction. A failure rolls it back, and staging is
 *    deleted; again nothing is lost.
 * 3. Only now delete `attachments/` and rename staging into its place. The rows
 *    that referenced the old files are already gone, so those files are already
 *    unreferenced by the time they are removed.
 *
 * A crash between 2 and 3 is the one window that exists. It leaves rows pointing
 * at files that are not there yet — visible, reportable, and not corrupting.
 */

const ATTACHMENTS_DIRECTORY = 'attachments';
const STAGING_DIRECTORY = 'attachments-restore';
const EXPORT_DIRECTORY = 'exports';

export interface BackupFileSystemPort {
  /** An attachment's bytes, or `null` when the row outlived its file. */
  readAttachment(fileUri: string): Promise<Uint8Array | null>;
  /** Relative paths of every file actually present under the attachments root. */
  listAttachmentPaths(): Promise<string[]>;
  writeStagedAttachment(relativePath: string, bytes: Uint8Array): Promise<void>;
  /** The absolute URI a staged file will have once staging is promoted. */
  restoredUri(relativePath: string): string;
  clearStaging(): Promise<void>;
  promoteStaging(): Promise<void>;
  fileExists(fileUri: string): Promise<boolean>;
  /** Writes the container into the cache and returns its URI, ready to share. */
  writeExport(fileName: string, bytes: Uint8Array): Promise<string>;
  deleteExport(fileUri: string): Promise<void>;
  readContainerFile(fileUri: string): Promise<Uint8Array>;
}

/**
 * Rejects anything that could write outside the directory the importer owns.
 *
 * `schema.ts` already refuses these paths during validation. This is the second
 * check, at the point of use, because the cost of being wrong is a file written
 * somewhere it was never meant to go.
 */
function assertSafeRelativePath(relativePath: string): string[] {
  const segments = relativePath.split('/');

  const unsafe =
    relativePath.startsWith('/') ||
    relativePath.includes('\\') ||
    /^[A-Za-z]:/.test(relativePath) ||
    segments.some((segment) => segment === '' || segment === '.' || segment === '..');

  if (unsafe) {
    throw new BackupError('invalid-payload', `Unsafe attachment path in backup: ${relativePath}`);
  }

  return segments;
}

function attachmentsRoot(): Directory {
  return new Directory(Paths.document, ATTACHMENTS_DIRECTORY);
}

function stagingRoot(): Directory {
  return new Directory(Paths.document, STAGING_DIRECTORY);
}

export const backupFileSystem: BackupFileSystemPort = {
  async readAttachment(fileUri) {
    try {
      const file = new File(fileUri);

      return file.exists ? file.bytesSync() : null;
    } catch (cause) {
      throw toBackupError(cause, 'io');
    }
  },

  async listAttachmentPaths() {
    const root = attachmentsRoot();

    if (!root.exists) {
      return [];
    }

    try {
      const paths: string[] = [];

      for (const entry of root.list()) {
        if (entry instanceof Directory) {
          for (const child of entry.list()) {
            if (child instanceof File) {
              paths.push(`${entry.name}/${child.name}`);
            }
          }
        } else {
          paths.push(entry.name);
        }
      }

      return paths;
    } catch (cause) {
      throw toBackupError(cause, 'io');
    }
  },

  async writeStagedAttachment(relativePath, bytes) {
    const segments = assertSafeRelativePath(relativePath);

    try {
      const directory = new Directory(stagingRoot(), ...segments.slice(0, -1));

      if (!directory.exists) {
        directory.create({ intermediates: true });
      }

      const file = new File(directory, segments[segments.length - 1]);

      if (!file.exists) {
        file.create({ intermediates: true, overwrite: true });
      }

      file.write(bytes);
    } catch (cause) {
      throw toBackupError(cause, 'io');
    }
  },

  restoredUri(relativePath) {
    const segments = assertSafeRelativePath(relativePath);

    return new File(attachmentsRoot(), ...segments).uri;
  },

  async clearStaging() {
    try {
      const staging = stagingRoot();

      if (staging.exists) {
        staging.delete();
      }
    } catch (cause) {
      throw toBackupError(cause, 'io');
    }
  },

  async promoteStaging() {
    try {
      const staging = stagingRoot();

      if (!staging.exists) {
        // A backup with no attachments at all: the live directory still has to
        // go, or files from the replaced vault would outlive their rows.
        staging.create({ intermediates: true });
      }

      const live = attachmentsRoot();

      if (live.exists) {
        live.delete();
      }

      await staging.move(new Directory(Paths.document, ATTACHMENTS_DIRECTORY));
    } catch (cause) {
      throw toBackupError(cause, 'io');
    }
  },

  async fileExists(fileUri) {
    try {
      return new File(fileUri).exists;
    } catch {
      return false;
    }
  },

  /**
   * The export is written to the cache directory, not to documents.
   *
   * It is a decrypted-on-demand copy of the whole vault; leaving it in the
   * app's permanent storage would mean a second copy of everything, protected
   * only by the passphrase, for as long as the app is installed. The caller
   * deletes it once the share sheet is done, and the OS can reclaim it anyway.
   */
  async writeExport(fileName, bytes) {
    try {
      const directory = new Directory(Paths.cache, EXPORT_DIRECTORY);

      if (!directory.exists) {
        directory.create({ intermediates: true });
      }

      const file = new File(directory, fileName);

      if (file.exists) {
        file.delete();
      }

      file.create({ intermediates: true, overwrite: true });
      file.write(bytes);

      return file.uri;
    } catch (cause) {
      throw toBackupError(cause, 'io');
    }
  },

  async deleteExport(fileUri) {
    try {
      const file = new File(fileUri);

      if (file.exists) {
        file.delete();
      }
    } catch {
      // A leftover file in the cache is the OS's to reclaim. Failing the export
      // after the user has already received the file would be a worse outcome
      // than a stale cache entry.
    }
  },

  async readContainerFile(fileUri) {
    try {
      const file = new File(fileUri);

      if (!file.exists) {
        throw new BackupError('io', 'The selected file could not be read.');
      }

      return file.bytesSync();
    } catch (cause) {
      throw toBackupError(cause, 'io');
    }
  },
};
