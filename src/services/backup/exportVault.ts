import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import { backupRepository, getSchemaVersion, type Database } from '@/db';
import type { Preferences } from '@/settings/preferences';

import { sealContainer } from './container';
import { PBKDF2_ITERATIONS } from './crypto';
import { toBackupError } from './errors';
import { backupFileSystem, type BackupFileSystemPort } from './fileSystem';
import { NONCE_BYTES, SALT_BYTES } from './format';
import { PAYLOAD_VERSION, type BackupFileEntry, type BackupPayload } from './types';

/**
 * Writing a `.evault` file.
 *
 * The whole vault is read first, then framed, then sealed, then written once.
 * Nothing is shared from here — the caller owns the share sheet, so that the
 * file can be deleted as soon as the sheet closes.
 */

export interface ExportProgress {
  phase: 'reading' | 'sealing' | 'writing';
  completed: number;
  total: number;
}

export interface ExportOptions {
  db: Database;
  password: string;
  preferences: Preferences | null;
  appVersion: string;
  randomBytes: (length: number) => Promise<Uint8Array>;
  fileSystem?: BackupFileSystemPort;
  now?: () => Date;
  iterations?: number;
  onProgress?: (progress: ExportProgress) => void;
}

export interface ExportResult {
  fileUri: string;
  fileName: string;
  byteSize: number;
  itemCount: number;
  attachmentCount: number;
  /**
   * Attachment rows whose file was gone. The row is left out of the backup
   * along with the file it can no longer describe.
   */
  missingAttachments: number;
  /**
   * Files under the attachments root that no row points at — the orphans a
   * crash between saving an item and inserting its attachment rows can leave
   * behind. They are not backed up, and a restore replaces the directory, so
   * this is also where they are finally cleared.
   */
  orphanFiles: number;
}

/**
 * `<itemDirectory>/<fileName>`, from an absolute attachment URI.
 *
 * The absolute path carries the app's container id, which changes on every
 * reinstall and differs on every device, so only the part below the attachments
 * root is portable.
 */
export function relativeAttachmentPath(fileUri: string): string {
  const segments = fileUri.split('/').filter((segment) => segment !== '');

  return segments.slice(-2).join('/');
}

/** `expiryvault-2026-09-22.evault` — sorts chronologically in any file list. */
export function exportFileName(now: Date): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');

  return `expiryvault-${year}-${month}-${day}.evault`;
}

export async function exportVault({
  db,
  password,
  preferences,
  appVersion,
  randomBytes,
  fileSystem = backupFileSystem,
  now = () => new Date(),
  iterations = PBKDF2_ITERATIONS,
  onProgress,
}: ExportOptions): Promise<ExportResult> {
  try {
    const tables = await backupRepository.readAllTables(db);
    const schemaVersion = await getSchemaVersion(db);

    const files: BackupFileEntry[] = [];
    const attachmentFrames: Uint8Array[] = [];
    const keptAttachments: typeof tables.attachments = [];
    const total = tables.attachments.length;
    let missingAttachments = 0;

    for (const [index, attachment] of tables.attachments.entries()) {
      onProgress?.({ phase: 'reading', completed: index, total });

      const bytes = await fileSystem.readAttachment(attachment.fileUri);

      if (bytes === null) {
        // The row outlived its file. Exporting it would produce a backup that
        // restores a record pointing at nothing, so the row goes too and the
        // count is reported.
        missingAttachments += 1;
        continue;
      }

      keptAttachments.push(attachment);
      files.push({
        attachmentId: attachment.id,
        relativePath: relativeAttachmentPath(attachment.fileUri),
        byteSize: bytes.length,
        sha256: bytesToHex(sha256(bytes)),
      });
      attachmentFrames.push(bytes);
    }

    const exportedPaths = new Set(files.map((file) => file.relativePath));
    const onDisk = await fileSystem.listAttachmentPaths();
    const orphanFiles = onDisk.filter((path) => !exportedPaths.has(path)).length;

    const payload: BackupPayload = {
      payloadVersion: PAYLOAD_VERSION,
      createdAt: now().toISOString(),
      appVersion,
      schemaVersion,
      preferences,
      tables: {
        ...tables,
        attachments: keptAttachments,
        // A notification id is a handle into the OS scheduler of *this* device.
        // It means nothing anywhere else, so it is not carried; F7's scheduler
        // rebuilds the whole schedule after a restore.
        reminderRules: tables.reminderRules.map((rule) => ({ ...rule, notificationId: null })),
      },
      files,
    };

    onProgress?.({ phase: 'sealing', completed: 0, total });

    const [salt, nonce] = await Promise.all([randomBytes(SALT_BYTES), randomBytes(NONCE_BYTES)]);
    const container = sealContainer(
      password,
      [utf8ToBytes(JSON.stringify(payload)), ...attachmentFrames],
      { salt, nonce },
      iterations,
    );

    onProgress?.({ phase: 'writing', completed: 0, total });

    const fileName = exportFileName(now());
    const fileUri = await fileSystem.writeExport(fileName, container);

    return {
      fileUri,
      fileName,
      byteSize: container.length,
      itemCount: tables.items.length,
      attachmentCount: files.length,
      missingAttachments,
      orphanFiles,
    };
  } catch (cause) {
    throw toBackupError(cause, 'io');
  }
}
