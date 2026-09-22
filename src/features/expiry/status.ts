import type { IsoDate } from '@/db/models';
import type { DocumentStatus } from '@/theme';

import { addDays, daysBetween } from './dates';

/**
 * The expiry status rule the whole app computes from.
 *
 * `DocumentStatus` is reused from the theme tokens rather than redeclared, so
 * the status model and the colours that render it cannot drift apart.
 */

/**
 * Days before expiry at which an item becomes `soon`.
 *
 * 60 is the only numeric threshold the Stitch export actually states: the
 * dashboard's status tile reads "Review / < 60 Days".
 */
export const SOON_THRESHOLD_DAYS = 60;

/** Days remaining below which reminders escalate to daily ("< 14 days"). */
export const ESCALATION_THRESHOLD_DAYS = 14;

/**
 * Whole days from `today` until `expiryDate`. Negative once expired, so
 * `-3` reads as "expired three days ago".
 */
export function daysUntilExpiry(expiryDate: IsoDate, today: IsoDate): number {
  return daysBetween(today, expiryDate);
}

/**
 * A document is valid through the whole of its expiry date, so day 0 is `soon`,
 * not `expired`.
 */
export function documentStatus(
  expiryDate: IsoDate,
  today: IsoDate,
  soonThresholdDays: number = SOON_THRESHOLD_DAYS,
): DocumentStatus {
  const remaining = daysUntilExpiry(expiryDate, today);

  if (remaining < 0) {
    return 'expired';
  }

  return remaining <= soonThresholdDays ? 'soon' : 'safe';
}

/**
 * The two date boundaries that split items into safe / soon / expired.
 *
 * Repositories take this instead of computing dates themselves: because
 * `YYYY-MM-DD` sorts lexicographically, SQL can express the same three bands
 * with plain string comparisons against an index, while the arithmetic that
 * produced the boundaries stays here, in one tested place.
 */
export interface StatusWindow {
  today: IsoDate;
  /** The last date still counted as `soon`; anything later is `safe`. */
  soonEnd: IsoDate;
}

export function statusWindow(
  today: IsoDate,
  soonThresholdDays: number = SOON_THRESHOLD_DAYS,
): StatusWindow {
  return { today, soonEnd: addDays(today, soonThresholdDays) };
}

/** True while an item is close enough to expiry to warrant daily alerts. */
export function isEscalating(
  expiryDate: IsoDate,
  today: IsoDate,
  thresholdDays: number = ESCALATION_THRESHOLD_DAYS,
): boolean {
  const remaining = daysUntilExpiry(expiryDate, today);

  return remaining >= 0 && remaining < thresholdDays;
}

/**
 * How much of a document's life has elapsed, 0-1, for the "% elapsed" and
 * "Lifetime Elapsed" readouts. Null when the issue date is unknown, since the
 * proportion is undefined without a start.
 */
export function lifetimeElapsed(
  issueDate: IsoDate | null,
  expiryDate: IsoDate,
  today: IsoDate,
): number | null {
  if (issueDate === null) {
    return null;
  }

  const total = daysBetween(issueDate, expiryDate);

  if (total <= 0) {
    // Issued on or after expiry: nothing left to elapse into.
    return 1;
  }

  const used = daysBetween(issueDate, today);

  return Math.min(1, Math.max(0, used / total));
}
