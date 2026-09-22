import { SOON_THRESHOLD_DAYS } from '@/features/expiry';

import {
  ACTION_MAX_DAYS,
  monthBand,
  REVIEW_MAX_DAYS,
  SAFE_WINDOW_MAX_DAYS,
  timelineBands,
} from '../bands';

describe('monthBand', () => {
  it.each([
    ['a month with a lapsed document', -1, 'critical'],
    ['a long-lapsed month', -400, 'critical'],
    ['a document expiring today', 0, 'action'],
    ['the last day of the action band', ACTION_MAX_DAYS, 'action'],
    ['the first day past it', ACTION_MAX_DAYS + 1, 'review'],
    ['the last day of the review band', REVIEW_MAX_DAYS, 'review'],
    ['the first day past it', REVIEW_MAX_DAYS + 1, 'safeWindow'],
    ['the last day of the safe window', SAFE_WINDOW_MAX_DAYS, 'safeWindow'],
    ['the first day past it', SAFE_WINDOW_MAX_DAYS + 1, 'secure'],
    ['a decade out', 3650, 'secure'],
  ] as const)('puts %s in the %s band', (_label, days, band) => {
    expect(monthBand(days)).toBe(band);
  });

  it('can return every declared band', () => {
    const produced = new Set([-1, 0, 100, 500, 2000].map((days) => monthBand(days)));

    expect(produced).toEqual(new Set(timelineBands));
  });

  /**
   * The export labels a 42-day month "Action Required" and a 71-day month
   * "Upcoming Review". If the boundary ever drifts outside that gap the bands
   * stop matching the design they were derived from.
   */
  it("keeps the action/review boundary between the export's own months", () => {
    expect(monthBand(42)).toBe('action');
    expect(monthBand(71)).toBe('review');
    expect(ACTION_MAX_DAYS).toBe(SOON_THRESHOLD_DAYS);
  });
});
