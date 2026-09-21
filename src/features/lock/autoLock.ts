import type { AppStateStatus } from 'react-native';

/**
 * When leaving the app should re-lock it, and when the content should be
 * hidden.
 *
 * These are two different questions about the same `AppState` and answering
 * them with one predicate is the bug this module exists to avoid.
 */

/**
 * Locking the instant the app is backgrounded is hostile: switching to Mail to
 * copy a policy number and coming straight back would cost a re-auth. A minute
 * covers that and still locks a phone put down on a table.
 *
 * F11 makes it configurable; until then it is one constant.
 */
export const DEFAULT_GRACE_MS = 60_000;

export interface ResumeDecision {
  backgroundedAt: number | null;
  now: number;
  graceMs: number;
}

export function shouldLockOnResume({ backgroundedAt, now, graceMs }: ResumeDecision): boolean {
  if (backgroundedAt === null) {
    return false;
  }

  const elapsed = now - backgroundedAt;

  // A negative elapsed means the clock moved backwards while the app was away.
  // The safe reading of "I cannot tell how long that was" is to lock.
  if (elapsed < 0) {
    return true;
  }

  return elapsed >= graceMs;
}

/**
 * Only a true background start the grace timer.
 *
 * iOS reports `inactive` for the app switcher peek, Control Centre, an incoming
 * call — and for the Face ID sheet itself. Starting the timer there would have
 * the biometric prompt re-lock the app that the prompt is unlocking.
 */
export function startsGracePeriod(status: AppStateStatus): boolean {
  return status === 'background';
}

/**
 * The shield, by contrast, must be up for `inactive` too: that is exactly when
 * iOS takes the snapshot it shows in the app switcher.
 */
export function shouldShieldContent(status: AppStateStatus): boolean {
  return status !== 'active';
}
