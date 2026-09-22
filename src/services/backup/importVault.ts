import { openContainer, type OpenedContainer } from './container';
import { BackupError, toBackupError } from './errors';
import { migrateBackupPayload } from './migrations';
import { parseBackupPayload } from './schema';
import { previewOf, type BackupPayload, type BackupPreview } from './types';

/**
 * Opening a `.evault` file: decrypt, migrate, validate, describe.
 *
 * Nothing here touches the database or the filesystem. Opening a backup and
 * restoring one are separate steps because the user has to see what is in the
 * file before agreeing to let it replace what they already have — and the
 * counts they need are inside the encrypted manifest, not in the plaintext
 * header, so there is no way to show them before this has run.
 *
 * The order is: decrypt, then migrate, then validate. Validation comes last
 * because an older payload is *supposed* to fail the current schema — that is
 * what the migration is for. Running the current schema first would reject
 * exactly the files the versioning exists to keep readable. What guards the
 * gap is that migrations take `Record<string, unknown>` and are written to
 * assume nothing, and that the result is fully validated before a single row
 * reaches SQLite.
 */

export interface OpenedBackup {
  payload: BackupPayload;
  preview: BackupPreview;
  /** Kept so restore can open the attachment frames one at a time. */
  container: OpenedContainer;
}

export function openBackup(bytes: Uint8Array, password: string): OpenedBackup {
  const container = openContainer(bytes, password);

  let decoded: unknown;

  try {
    decoded = JSON.parse(new TextDecoder().decode(container.manifest));
  } catch (cause) {
    // The frame authenticated, so the bytes are exactly what was written and
    // the password was right. Unreadable JSON here means the file was built
    // wrong, not damaged in transit.
    throw new BackupError('invalid-payload', 'The backup contents are not readable JSON.', cause);
  }

  const { payload: migrated, migrated: wasMigrated } = migrateBackupPayload(decoded);
  const payload = parseBackupPayload(migrated);

  if (payload.files.length !== container.attachmentFrameCount) {
    throw new BackupError(
      'corrupt',
      `The backup describes ${payload.files.length} attachments but carries ${container.attachmentFrameCount}.`,
    );
  }

  return { payload, preview: previewOf(payload, wasMigrated), container };
}

/** Reads the file and opens it. The one step that needs the filesystem. */
export async function openBackupFile(
  read: () => Promise<Uint8Array>,
  password: string,
): Promise<OpenedBackup> {
  let bytes: Uint8Array;

  try {
    bytes = await read();
  } catch (cause) {
    throw toBackupError(cause, 'io');
  }

  return openBackup(bytes, password);
}
