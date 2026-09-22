import type { TFunction } from 'i18next';

import type { IconName } from '@/components';
import type { BiometricKind } from '@/services/biometrics';

import { FREE_ATTEMPTS, type AttemptState } from './backoff';
import type { PinProblem } from './pin';

/**
 * Translation-key helpers for the lock.
 *
 * These used to hold the English copy directly; F11 moved the strings into
 * `src/i18n/locales` and left the *rules* here — which attempt count warrants a
 * warning, how a duration is broken into minutes and seconds — because those
 * are logic, not copy, and are worth testing independently of language.
 */

/**
 * Apple's marks are the only correct name for the thing on iOS, and users look
 * for them, so they are not translated. Android's sensors have no such
 * universal name, so those keys carry generic copy that is.
 */
export function biometricLabelKey(kind: BiometricKind): string {
  switch (kind) {
    case 'faceId':
      return 'lock.biometricFaceId';
    case 'touchId':
      return 'lock.biometricTouchId';
    case 'face':
      return 'lock.biometricFace';
    case 'fingerprint':
      return 'lock.biometricFingerprint';
    case 'iris':
      return 'lock.biometricIris';
    case 'none':
      return 'lock.biometricGeneric';
  }
}

export function biometricIcon(kind: BiometricKind): IconName {
  return kind === 'faceId' || kind === 'face' ? 'biometricFace' : 'biometricFingerprint';
}

export function pinProblemKey(problem: PinProblem): string {
  switch (problem) {
    case 'length':
      return 'lock.pinLength';
    case 'digits':
      return 'lock.pinDigits';
    case 'weak':
      return 'lock.pinWeak';
  }
}

/** "1 minute 30 seconds", rounded up so the countdown never shows a stale 0. */
export function formatDuration(ms: number, t: TFunction): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return t('lock.seconds', { count: seconds });
  }

  if (seconds === 0) {
    return t('lock.minutes', { count: minutes });
  }

  return t('lock.durationCombined', {
    minutes: t('lock.minutes', { count: minutes }),
    seconds: t('lock.seconds', { count: seconds }),
  });
}

export function lockoutMessage(remainingMs: number, t: TFunction): string {
  return t('lock.lockout', { duration: formatDuration(remainingMs, t) });
}

/**
 * Warns only once the attempts are nearly spent. Counting down from five on the
 * first mistype reads as an accusation; staying quiet until the last two is the
 * point at which the information is actually useful.
 */
export function wrongPinMessage(attempts: AttemptState, t: TFunction): string {
  const left = Math.max(FREE_ATTEMPTS - attempts.failures, 0);

  if (left > 0 && left <= 2) {
    return t('lock.incorrectPinAttempts', { count: left });
  }

  return t('lock.incorrectPin');
}
