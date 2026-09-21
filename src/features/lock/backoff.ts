/**
 * What a wrong PIN costs.
 *
 * The state is persisted, not held in memory: a counter that resets when the
 * app is force-quit is not a delay, it is a formality. `lockStorage` writes it
 * to secure-store beside the PIN record; everything here is pure.
 *
 * There is no wipe-after-N-attempts. The vault is the user's only copy of this
 * data — destroying it because someone mistyped six digits nine times is a
 * larger loss than the attack it would prevent.
 */

export interface AttemptState {
  failures: number;
  /** Epoch ms the lockout ends, or null when none is in force. */
  lockedUntil: number | null;
  /** How long the current lockout was for. Guards a clock moved backwards. */
  lockoutMs: number;
}

export const NO_FAILURES: AttemptState = { failures: 0, lockedUntil: null, lockoutMs: 0 };

/** Attempts allowed before the first lockout. Enough to absorb a fat-fingered keypad. */
export const FREE_ATTEMPTS = 5;

/** Applied in order once the free attempts are spent; the last value repeats. */
export const LOCKOUT_SCHEDULE_MS = [30_000, 60_000, 300_000, 900_000, 1_800_000] as const;

export function lockoutForFailures(failures: number): number {
  const step = failures - FREE_ATTEMPTS;

  if (step < 1) {
    return 0;
  }

  return LOCKOUT_SCHEDULE_MS[Math.min(step, LOCKOUT_SCHEDULE_MS.length) - 1];
}

export function registerFailure(state: AttemptState, now: number): AttemptState {
  const failures = state.failures + 1;
  const lockoutMs = lockoutForFailures(failures);

  if (lockoutMs === 0) {
    return { failures, lockedUntil: null, lockoutMs: 0 };
  }

  return { failures, lockedUntil: now + lockoutMs, lockoutMs };
}

/**
 * Milliseconds still to wait, or 0.
 *
 * The clamp to `lockoutMs` is the clock-tamper guard. Winding the clock back
 * makes `lockedUntil - now` arbitrarily large, which would strand the user
 * behind a lockout of years; capping it at the duration that was actually
 * imposed means the worst a backwards clock can do is restart the wait.
 *
 * Winding it *forward* still skips the lockout. That cannot be fixed without a
 * monotonic clock the platform does not offer, and it is logged rather than
 * pretended away.
 */
export function remainingLockoutMs(state: AttemptState, now: number): number {
  if (state.lockedUntil === null) {
    return 0;
  }

  return Math.min(Math.max(state.lockedUntil - now, 0), state.lockoutMs);
}

export function isLockedOut(state: AttemptState, now: number): boolean {
  return remainingLockoutMs(state, now) > 0;
}

/** Attempts left before the next lockout, once one has elapsed. */
export function attemptsRemaining(state: AttemptState): number {
  return Math.max(FREE_ATTEMPTS - state.failures, 0);
}
