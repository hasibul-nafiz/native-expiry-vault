import {
  DEFAULT_GRACE_MS,
  shouldLockOnResume,
  shouldShieldContent,
  startsGracePeriod,
} from '../autoLock';

const NOW = 1_700_000_000_000;

describe('shouldLockOnResume', () => {
  it('does not lock when the app was never backgrounded', () => {
    expect(shouldLockOnResume({ backgroundedAt: null, now: NOW, graceMs: DEFAULT_GRACE_MS })).toBe(
      false,
    );
  });

  it('does not lock inside the grace period', () => {
    expect(
      shouldLockOnResume({
        backgroundedAt: NOW - (DEFAULT_GRACE_MS - 1),
        now: NOW,
        graceMs: DEFAULT_GRACE_MS,
      }),
    ).toBe(false);
  });

  it('locks exactly at the grace period', () => {
    expect(
      shouldLockOnResume({
        backgroundedAt: NOW - DEFAULT_GRACE_MS,
        now: NOW,
        graceMs: DEFAULT_GRACE_MS,
      }),
    ).toBe(true);
  });

  it('locks well past it', () => {
    expect(
      shouldLockOnResume({ backgroundedAt: NOW - 60 * 60 * 1000, now: NOW, graceMs: DEFAULT_GRACE_MS }),
    ).toBe(true);
  });

  it('locks when the clock moved backwards while the app was away', () => {
    // Elapsed reads negative, so how long the app was away is unknowable.
    expect(
      shouldLockOnResume({ backgroundedAt: NOW + 5000, now: NOW, graceMs: DEFAULT_GRACE_MS }),
    ).toBe(true);
  });

  it('honours a zero grace period as lock-immediately', () => {
    expect(shouldLockOnResume({ backgroundedAt: NOW, now: NOW, graceMs: 0 })).toBe(true);
  });
});

describe('startsGracePeriod', () => {
  it('starts on a true background', () => {
    expect(startsGracePeriod('background')).toBe(true);
  });

  it.each(['active', 'inactive', 'unknown', 'extension'] as const)(
    'does not start on %s',
    (status) => {
      // `inactive` is the one that matters: iOS reports it for the app switcher
      // peek, Control Centre and — the bug this prevents — the biometric sheet
      // that is in the middle of unlocking the vault.
      expect(startsGracePeriod(status)).toBe(false);
    },
  );
});

describe('shouldShieldContent', () => {
  it('is down only while the app is in the foreground', () => {
    expect(shouldShieldContent('active')).toBe(false);
  });

  it.each(['inactive', 'background', 'unknown', 'extension'] as const)(
    'is up for %s',
    (status) => {
      // `inactive` must shield even though it must not start the grace timer:
      // that is exactly when iOS takes the app-switcher snapshot.
      expect(shouldShieldContent(status)).toBe(true);
    },
  );
});
