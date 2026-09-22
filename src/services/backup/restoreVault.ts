import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

import { backupRepository, type Database } from '@/db';

import { BackupError, toBackupError } from './errors';
import { backupFileSystem, type BackupFileSystemPort } from './fileSystem';
import type { OpenedBackup } from './importVault';
import type { BackupTables } from './types';

/**
 * Replacing the vault with the contents of an opened backup.
 *
 * Destructive and deliberate: every table is emptied and rewritten, and the
 * attachments directory is replaced wholesale. The caller has already shown the
 * user what the file contains and taken an explicit confirmation.
 *
 * The ordering is the part that matters, and it is the ordering
 * `fileSystem.ts` documents: stage all the files, run the entire database
 * change in one transaction, and only then swap the directories. Up to and
 * including the commit, every failure leaves the existing vault untouched.
 */

export interface RestoreProgress {
  phase: 'staging' | 'writing' | 'promoting';
  completed: number;
  total: number;
}

export interface RestoreOptions {
  db: Database;
  backup: OpenedBackup;
  fileSystem?: BackupFileSystemPort;
  onProgress?: (progress: RestoreProgress) => void;
}

export interface RestoreResult {
  itemCount: number;
  attachmentCount: number;
  /**
   * Relative paths that are not on disk after the swap. Always empty unless the
   * app was killed between the commit and the swap — reported rather than
   * assumed away, because the rows referencing them are already live.
   */
  missingFiles: string[];
}

export async function restoreVault({
  db,
  backup,
  fileSystem = backupFileSystem,
  onProgress,
}: RestoreOptions): Promise<RestoreResult> {
  const { payload, container } = backup;
  const total = payload.files.length;

  await fileSystem.clearStaging();

  try {
    for (const [index, entry] of payload.files.entries()) {
      onProgress?.({ phase: 'staging', completed: index, total });

      const bytes = container.openAttachmentFrame(index);

      // The frame already authenticated, so this cannot catch tampering — it
      // catches a file whose manifest and frames were built inconsistently,
      // which is the one kind of damage a valid signature cannot rule out.
      if (bytes.length !== entry.byteSize) {
        throw new BackupError(
          'corrupt',
          `${entry.relativePath} is ${bytes.length} bytes; the backup says ${entry.byteSize}.`,
        );
      }

      if (bytesToHex(sha256(bytes)) !== entry.sha256) {
        throw new BackupError('corrupt', `${entry.relativePath} does not match its digest.`);
      }

      await fileSystem.writeStagedAttachment(entry.relativePath, bytes);
    }

    const pathByAttachmentId = new Map(
      payload.files.map((file) => [file.attachmentId, file.relativePath]),
    );

    const tables: BackupTables = {
      ...payload.tables,
      attachments: payload.tables.attachments.map((attachment) => {
        const path = pathByAttachmentId.get(attachment.id);

        return path === undefined
          ? attachment
          : { ...attachment, fileUri: fileSystem.restoredUri(path) };
      }),
    };

    onProgress?.({ phase: 'writing', completed: 0, total });

    // One transaction for the whole vault. A constraint violation, a disk
    // error, anything at all: the rollback puts every table back, and staging
    // is deleted below.
    await db.withTransactionAsync(async () => {
      await backupRepository.replaceAllTables(db, tables);
    });

    onProgress?.({ phase: 'promoting', completed: total, total });

    await fileSystem.promoteStaging();

    const missingFiles: string[] = [];

    for (const entry of payload.files) {
      if (!(await fileSystem.fileExists(fileSystem.restoredUri(entry.relativePath)))) {
        missingFiles.push(entry.relativePath);
      }
    }

    return {
      itemCount: payload.tables.items.length,
      attachmentCount: payload.files.length,
      missingFiles,
    };
  } catch (cause) {
    // Reached only before the swap, or during it. Staging is the importer's
    // own scratch space, so removing it can never take anything the user had.
    await fileSystem.clearStaging().catch(() => undefined);

    throw toBackupError(cause, 'io');
  }
}
