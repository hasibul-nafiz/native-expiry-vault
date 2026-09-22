import { timelineBands, type TimelineBand } from '@/theme';

import { SOON_THRESHOLD_DAYS } from '../expiry';

/**
 * Which of the five month-header bands a group falls into.
 *
 * `TimelineBand` comes from the theme tokens rather than being redeclared here,
 * the same containment `DocumentStatus` has: the band model cannot drift from
 * the colours that render it.
 *
 * The rest of the app still has three statuses (safe/soon/expired) and that
 * model is unchanged — a band is a *presentation* of a whole month's urgency,
 * never a fourth status, and `documentStatus` still colours each card.
 *
 * The thresholds are derived from the export's own months rather than invented:
 * it labels 42 days "Action Required" and 71 days "Upcoming Review", so the
 * boundary between them falls between those two — which is exactly where
 * `SOON_THRESHOLD_DAYS` already sits. Its ~400-day month reads "Safe Window"
 * and its ~4.5-year month reads "Secure", placing the remaining two cuts at one
 * and three years.
 */
export type { TimelineBand };

/** Upper bound, in days remaining, of the "Action Required" band. */
export const ACTION_MAX_DAYS = SOON_THRESHOLD_DAYS;
/** Upper bound of "Upcoming Review". */
export const REVIEW_MAX_DAYS = 365;
/** Upper bound of "Safe Window"; beyond it a month is "Secure". */
export const SAFE_WINDOW_MAX_DAYS = 1095;

export { timelineBands };

/**
 * A month takes the tone of its most urgent item, so `minDaysRemaining` is the
 * smallest countdown in the group. Negative means something in the month has
 * already lapsed.
 */
export function monthBand(minDaysRemaining: number): TimelineBand {
  if (minDaysRemaining < 0) {
    return 'critical';
  }

  if (minDaysRemaining <= ACTION_MAX_DAYS) {
    return 'action';
  }

  if (minDaysRemaining <= REVIEW_MAX_DAYS) {
    return 'review';
  }

  return minDaysRemaining <= SAFE_WINDOW_MAX_DAYS ? 'safeWindow' : 'secure';
}
