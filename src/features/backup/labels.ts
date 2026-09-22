import type { TFunction } from 'i18next';

import { formatNumber } from '@/i18n';
import type { BackupErrorReason, PasswordProblem } from '@/services/backup';
import type { SupportedLocale } from '@/settings/preferences';

/**
 * The copy rules for the backup screen.
 *
 * As with `lock/labels.ts` and `timeline/labels.ts`, the *rules* live here and
 * the words live in `src/i18n/locales`. Which failure deserves which message,
 * and where a byte count stops being kilobytes, are decisions worth testing
 * independently of the language they are rendered in.
 */

/**
 * One message per failure. The reasons exist precisely because they have
 * different remedies — "try a different password" and "this file is damaged"
 * send someone to different places, and guessing between them is how a person
 * retypes a correct passphrase ten times.
 */
const errorKeys: Record<BackupErrorReason, string> = {
  'unsupported-format': 'backup.errorNotABackup',
  'unsupported-version': 'backup.errorNewerVersion',
  'wrong-password': 'backup.errorWrongPassword',
  corrupt: 'backup.errorCorrupt',
  'invalid-payload': 'backup.errorInvalidPayload',
  io: 'backup.errorIo',
};

export function backupErrorKey(reason: BackupErrorReason): string {
  return errorKeys[reason];
}

const passwordProblemKeys: Record<PasswordProblem, string> = {
  'too-short': 'backup.passwordTooShort',
  'too-long': 'backup.passwordTooLong',
  'single-character': 'backup.passwordSingleCharacter',
  mismatch: 'backup.passwordMismatch',
};

export function passwordProblemKey(problem: PasswordProblem): string {
  return passwordProblemKeys[problem];
}

const KILOBYTE = 1024;

/**
 * A file size a person can read at a glance.
 *
 * Binary units, because that is what both platforms' file browsers show, and
 * one decimal place above a megabyte so a 4.2MB backup does not round to "4MB"
 * next to a 4.8MB one. The number goes through `Intl` like every other number
 * in the app, so a Bengali reader gets the separator their locale uses and
 * still gets Latin digits.
 */
export function formatBytes(bytes: number, locale: SupportedLocale, t: TFunction): string {
  if (bytes < KILOBYTE) {
    return t('backup.bytes', { size: formatNumber(bytes, locale) });
  }

  const kilobytes = bytes / KILOBYTE;

  if (kilobytes < KILOBYTE) {
    return t('backup.kilobytes', { size: formatNumber(Math.round(kilobytes), locale) });
  }

  const megabytes = kilobytes / KILOBYTE;

  return t('backup.megabytes', {
    size: formatNumber(Math.round(megabytes * 10) / 10, locale),
  });
}

/**
 * What the export produced, in one line.
 *
 * The counts that are zero are left out rather than rendered as "0 skipped":
 * the ordinary case is that nothing was skipped, and a line listing two zeroes
 * reads like a warning when it is the opposite.
 */
export function exportSummary(
  result: { itemCount: number; attachmentCount: number; missingAttachments: number },
  t: TFunction,
): string {
  const parts = [
    t('backup.summaryItems', { count: result.itemCount }),
    t('backup.summaryAttachments', { count: result.attachmentCount }),
  ];

  if (result.missingAttachments > 0) {
    parts.push(t('backup.summaryMissing', { count: result.missingAttachments }));
  }

  return parts.join(t('common.listSeparator'));
}
