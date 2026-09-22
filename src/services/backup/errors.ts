/**
 * Every way a backup can fail, as one typed error.
 *
 * The reasons are distinguishable on purpose: they have different remedies, and
 * "something went wrong" is the least useful thing to tell someone holding the
 * only copy of their vault. Each reason maps to one i18n key, so the UI never
 * renders a raw message.
 *
 * A `BackupError` never carries the password, a derived key, or any decrypted
 * content. `cause` is kept for the developer, never rendered.
 */

export const backupErrorReasons = [
  /** Not an ExpiryVault backup at all — wrong magic, or far too short. */
  'unsupported-format',
  /** An ExpiryVault backup written by a newer app than this one. */
  'unsupported-version',
  /** Authentication failed on the first frame: almost always a wrong password. */
  'wrong-password',
  /** Structurally damaged, or authentication failed after the password worked. */
  'corrupt',
  /** Decrypted and authentic, but the contents are not a vault this app accepts. */
  'invalid-payload',
  /** The filesystem, the picker or the share sheet failed. */
  'io',
] as const;

export type BackupErrorReason = (typeof backupErrorReasons)[number];

export class BackupError extends Error {
  constructor(
    readonly reason: BackupErrorReason,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

export function isBackupError(value: unknown): value is BackupError {
  return value instanceof BackupError;
}

/**
 * Normalises anything thrown below this layer into a `BackupError`.
 *
 * An error that is already a `BackupError` keeps its reason — the inner layer
 * knew more about what failed than the caller does.
 */
export function toBackupError(cause: unknown, fallback: BackupErrorReason): BackupError {
  if (isBackupError(cause)) {
    return cause;
  }

  const message = cause instanceof Error ? cause.message : String(cause);

  return new BackupError(fallback, message, cause);
}
