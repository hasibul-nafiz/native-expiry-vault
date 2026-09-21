import type { IconName } from '@/components';
import type { BiometricKind } from '@/services/biometrics';

import { FREE_ATTEMPTS, type AttemptState } from './backoff';
import type { PinProblem } from './pin';

/**
 * Every user-facing string the lock renders, in one file.
 *
 * Inline English, like F3 through F8 — the i18n layer arrives at F11, and
 * keeping the copy in one module is what makes that extraction a single file
 * rather than a sweep through six components.
 */

/**
 * Apple's marks are the only correct name for the thing on iOS, and users look
 * for them. Android's sensors have no such universal name, so the copy stays
 * generic rather than guessing at a vendor's.
 */
export function biometricLabel(kind: BiometricKind): string {
  switch (kind) {
    case 'faceId':
      return 'Face ID';
    case 'touchId':
      return 'Touch ID';
    case 'face':
      return 'face unlock';
    case 'fingerprint':
      return 'your fingerprint';
    case 'iris':
      return 'iris unlock';
    case 'none':
      return 'biometrics';
  }
}

export function biometricIcon(kind: BiometricKind): IconName {
  return kind === 'faceId' || kind === 'face' ? 'biometricFace' : 'biometricFingerprint';
}

export function pinProblemMessage(problem: PinProblem): string {
  switch (problem) {
    case 'length':
      return 'Your PIN must be 6 digits.';
    case 'digits':
      return 'Your PIN can only contain digits.';
    case 'weak':
      return 'That PIN is too easy to guess. Avoid repeats and runs like 111111 or 123456.';
  }
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** "1 minute 30 seconds", rounded up so the countdown never shows a stale 0. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return plural(seconds, 'second');
  }

  if (seconds === 0) {
    return plural(minutes, 'minute');
  }

  return `${plural(minutes, 'minute')} ${plural(seconds, 'second')}`;
}

export function lockoutMessage(remainingMs: number): string {
  return `Too many attempts. Try again in ${formatDuration(remainingMs)}.`;
}

/**
 * Warns only once the attempts are nearly spent. Counting down from five on the
 * first mistype reads as an accusation; staying quiet until the last two is the
 * point at which the information is actually useful.
 */
export function wrongPinMessage(attempts: AttemptState): string {
  const left = Math.max(FREE_ATTEMPTS - attempts.failures, 0);

  if (left > 0 && left <= 2) {
    return `Incorrect PIN. ${plural(left, 'attempt')} left before a timeout.`;
  }

  return 'Incorrect PIN.';
}
