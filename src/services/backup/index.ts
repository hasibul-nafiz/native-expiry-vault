/**
 * Password-encrypted backup, export and restore.
 *
 * The one entry point into the feature. `format`, `crypto` and `container` are
 * pure byte work; `exportVault`, `importVault` and `restoreVault` compose them
 * with the database and the filesystem port.
 */

export { openContainer, sealContainer, type ContainerSecrets, type OpenedContainer } from './container';
export { deriveKey, PBKDF2_ITERATIONS } from './crypto';
export {
  backupErrorReasons,
  BackupError,
  isBackupError,
  type BackupErrorReason,
} from './errors';
export {
  exportFileName,
  exportVault,
  relativeAttachmentPath,
  type ExportOptions,
  type ExportProgress,
  type ExportResult,
} from './exportVault';
export { backupFileSystem, type BackupFileSystemPort } from './fileSystem';
export { FORMAT_VERSION, NONCE_BYTES, SALT_BYTES } from './format';
export { openBackup, openBackupFile, type OpenedBackup } from './importVault';
export {
  assertPayloadMigrationsAreWellFormed,
  migrateBackupPayload,
  payloadMigrations,
  type PayloadMigration,
} from './migrations';
export {
  MIN_PASSWORD_LENGTH,
  validateBackupPassword,
  validatePasswordConfirmation,
  type PasswordProblem,
  type PasswordValidation,
} from './password';
export {
  restoreVault,
  type RestoreOptions,
  type RestoreProgress,
  type RestoreResult,
} from './restoreVault';
export { parseBackupPayload } from './schema';
export { sharing, type SharingPort } from './share';
export {
  PAYLOAD_VERSION,
  previewOf,
  type BackupFileEntry,
  type BackupPayload,
  type BackupPreview,
  type BackupTables,
} from './types';
