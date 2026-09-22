import {
  attemptsRemaining,
  FREE_ATTEMPTS,
  isLockedOut,
  lockoutForFailures,
  LOCKOUT_SCHEDULE_MS,
  NO_FAILURES,
  registerFailure,
  remainingLockoutMs,
  type AttemptState,
} from '../backoff';

const NOW = 1_700_000_000_000;

function failTimes(count: number, now = NOW): AttemptState {
  let state = NO_FAILURES;

  for (let index = 0; index < count; index += 1) {
    state = registerFailure(state, now);
  }

  return state;
}

describe('lockoutForFailures', () => {
  it('charges nothing for the free attempts', () => {
    for (let failures = 0; failures <= FREE_ATTEMPTS; failures += 1) {
      expect(lockoutForFailures(failures)).toBe(0);
    }
  });

  it('walks the schedule one rung per failure', () => {
    LOCKOUT_SCHEDULE_MS.forEach((expected, index) => {
      expect(lockoutForFailures(FREE_ATTEMPTS + index + 1)).toBe(expected);
    });
  });

  it('repeats the last rung rather than growing without bound', () => {
    const last = LOCKOUT_SCHEDULE_MS[LOCKOUT_SCHEDULE_MS.length - 1];

    expect(lockoutForFailures(FREE_ATTEMPTS + LOCKOUT_SCHEDULE_MS.length + 50)).toBe(last);
  });
});

describe('registerFailure', () => {
  it('counts the free attempts without imposing a wait', () => {
    const state = failTimes(FREE_ATTEMPTS);

    expect(state.failures).toBe(FREE_ATTEMPTS);
    expect(state.lockedUntil).toBeNull();
    expect(isLockedOut(state, NOW)).toBe(false);
  });

  it('imposes the first timeout on the attempt after those', () => {
    const state = failTimes(FREE_ATTEMPTS + 1);

    expect(state.lockedUntil).toBe(NOW + LOCKOUT_SCHEDULE_MS[0]);
    expect(remainingLockoutMs(state, NOW)).toBe(LOCKOUT_SCHEDULE_MS[0]);
  });

  it('escalates on each further failure', () => {
    const first = failTimes(FREE_ATTEMPTS + 1);
    const second = registerFailure(first, NOW);

    expect(remainingLockoutMs(second, NOW)).toBe(LOCKOUT_SCHEDULE_MS[1]);
  });
});

describe('remainingLockoutMs', () => {
  const state = failTimes(FREE_ATTEMPTS + 1);

  it('counts down as time passes', () => {
    expect(remainingLockoutMs(state, NOW + 10_000)).toBe(LOCKOUT_SCHEDULE_MS[0] - 10_000);
  });

  it('reaches zero exactly at the deadline', () => {
    expect(remainingLockoutMs(state, NOW + LOCKOUT_SCHEDULE_MS[0])).toBe(0);
    expect(isLockedOut(state, NOW + LOCKOUT_SCHEDULE_MS[0])).toBe(false);
  });

  it('never returns a negative wait', () => {
    expect(remainingLockoutMs(state, NOW + 10 * LOCKOUT_SCHEDULE_MS[0])).toBe(0);
  });

  it('is zero when no timeout is in force', () => {
    expect(remainingLockoutMs(NO_FAILURES, NOW)).toBe(0);
  });

  it('caps a clock wound backwards at the timeout that was imposed', () => {
    // A year earlier would otherwise read as a year still to wait.
    const yearBefore = NOW - 365 * 24 * 60 * 60 * 1000;

    expect(remainingLockoutMs(state, yearBefore)).toBe(LOCKOUT_SCHEDULE_MS[0]);
  });
});

describe('persistence across a restart', () => {
  it('keeps a timeout in force when the state is reloaded mid-wait', () => {
    // What secure-store hands back after a force-quit: the same object.
    const reloaded: AttemptState = JSON.parse(JSON.stringify(failTimes(FREE_ATTEMPTS + 2)));

    expect(isLockedOut(reloaded, NOW + 1000)).toBe(true);
    expect(remainingLockoutMs(reloaded, NOW + 1000)).toBe(LOCKOUT_SCHEDULE_MS[1] - 1000);
  });
});

describe('attemptsRemaining', () => {
  it('counts down from the free allowance', () => {
    expect(attemptsRemaining(NO_FAILURES)).toBe(FREE_ATTEMPTS);
    expect(attemptsRemaining(failTimes(3))).toBe(FREE_ATTEMPTS - 3);
  });

  it('floors at zero once they are spent', () => {
    expect(attemptsRemaining(failTimes(FREE_ATTEMPTS + 3))).toBe(0);
  });
});
