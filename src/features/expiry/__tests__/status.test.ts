import { addDays } from '../dates';
import {
  daysUntilExpiry,
  documentStatus,
  ESCALATION_THRESHOLD_DAYS,
  isEscalating,
  lifetimeElapsed,
  SOON_THRESHOLD_DAYS,
} from '../status';

const TODAY = '2026-09-20';

/** An expiry date exactly `days` from TODAY. */
function inDays(days: number): string {
  return addDays(TODAY, days);
}

describe('daysUntilExpiry', () => {
  it.each([
    ['expiring today', 0],
    ['expiring tomorrow', 1],
    ['expired yesterday', -1],
    ['far in the future', 1697],
  ])('counts %s', (_label, days) => {
    expect(daysUntilExpiry(inDays(days), TODAY)).toBe(days);
  });
});

describe('documentStatus', () => {
  it.each([
    ['expired by a year', -365, 'expired'],
    ['expired by a day', -1, 'expired'],
    ['expiring today', 0, 'soon'],
    ['expiring tomorrow', 1, 'soon'],
    ['one day inside the threshold', SOON_THRESHOLD_DAYS - 1, 'soon'],
    ['exactly on the threshold', SOON_THRESHOLD_DAYS, 'soon'],
    ['one day past the threshold', SOON_THRESHOLD_DAYS + 1, 'safe'],
    ['years away', 1697, 'safe'],
  ])('reports %s as %s', (_label, days, expected) => {
    expect(documentStatus(inDays(days), TODAY)).toBe(expected);
  });

  it('treats the expiry date itself as still valid', () => {
    // A passport is valid through the whole of its expiry date, so day 0 must
    // never read as expired.
    expect(documentStatus(TODAY, TODAY)).toBe('soon');
    expect(documentStatus(addDays(TODAY, -1), TODAY)).toBe('expired');
  });

  it('honours a custom threshold', () => {
    expect(documentStatus(inDays(45), TODAY, 30)).toBe('safe');
    expect(documentStatus(inDays(30), TODAY, 30)).toBe('soon');
    expect(documentStatus(inDays(45), TODAY, 90)).toBe('soon');
  });

  it('uses the threshold the dashboard states', () => {
    expect(SOON_THRESHOLD_DAYS).toBe(60);
  });

  it('never returns a value outside the theme status triad', () => {
    for (const days of [-500, -1, 0, 30, 60, 61, 5000]) {
      expect(['safe', 'soon', 'expired']).toContain(documentStatus(inDays(days), TODAY));
    }
  });
});

describe('isEscalating', () => {
  it.each([
    ['expired', -1, false],
    ['expiring today', 0, true],
    ['one day inside the window', ESCALATION_THRESHOLD_DAYS - 1, true],
    ['on the window edge', ESCALATION_THRESHOLD_DAYS, false],
    ['well outside', 60, false],
  ])('reports %s as %s', (_label, days, expected) => {
    expect(isEscalating(inDays(days), TODAY)).toBe(expected);
  });
});

describe('lifetimeElapsed', () => {
  it('returns null without an issue date', () => {
    expect(lifetimeElapsed(null, '2031-05-14', TODAY)).toBeNull();
  });

  it('reports the halfway point', () => {
    expect(lifetimeElapsed('2026-09-10', '2026-09-30', '2026-09-20')).toBeCloseTo(0.5, 10);
  });

  it('clamps before issue and after expiry', () => {
    expect(lifetimeElapsed('2026-09-10', '2026-09-30', '2026-09-01')).toBe(0);
    expect(lifetimeElapsed('2026-09-10', '2026-09-30', '2027-01-01')).toBe(1);
  });

  it('reports a fully elapsed lifetime when issue and expiry coincide', () => {
    expect(lifetimeElapsed('2026-09-20', '2026-09-20', TODAY)).toBe(1);
  });
});
