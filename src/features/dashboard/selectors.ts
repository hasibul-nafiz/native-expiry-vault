import type { DocumentCategory, IsoDate, Item } from '@/db/models';

import { daysUntilExpiry, lifetimeElapsed } from '../expiry/status';

/**
 * Pure presentation logic for the dashboard. Nothing here touches the database
 * and nothing reads the clock — `today` is always passed in, so every function
 * is deterministic and testable.
 */

/**
 * Beyond this many days remaining, the countdown is rendered coarsely as years.
 *
 * Derived from the export itself, which shows 389 days as "389d left" but shows
 * roughly 1,600 days as "4+ years" — so the cutoff sits at two years, not one.
 */
export const COARSE_COUNTDOWN_DAYS = 730;

const DAYS_PER_YEAR = 365;

/** The countdown line on every record row: "18d left", "4+ years", "Expired 25d ago". */
export function daysLeftLabel(expiryDate: IsoDate, today: IsoDate): string {
  const remaining = daysUntilExpiry(expiryDate, today);

  if (remaining < 0) {
    const overdue = Math.abs(remaining);

    return `Expired ${overdue}d ago`;
  }

  if (remaining >= COARSE_COUNTDOWN_DAYS) {
    return `${Math.floor(remaining / DAYS_PER_YEAR)}+ years`;
  }

  return `${remaining}d left`;
}

/** "88% elapsed", or null when the item has no issue date to measure from. */
export function elapsedLabel(
  issueDate: IsoDate | null,
  expiryDate: IsoDate,
  today: IsoDate,
): string | null {
  const elapsed = lifetimeElapsed(issueDate, expiryDate, today);

  if (elapsed === null) {
    return null;
  }

  return `${Math.round(elapsed * 100)}% elapsed`;
}

/** 0-1 for the progress bar, or null when there is no issue date. */
export function elapsedFraction(
  issueDate: IsoDate | null,
  expiryDate: IsoDate,
  today: IsoDate,
): number | null {
  return lifetimeElapsed(issueDate, expiryDate, today);
}

/**
 * The "Urgent Renewal" scroller: already-expired items first, then the
 * soonest-expiring. Both inputs arrive from the repository already sorted by
 * expiry date ascending.
 */
export function selectUrgentItems(expired: readonly Item[], soon: readonly Item[]): Item[] {
  return [...expired, ...soon];
}

export interface CategoryFilter {
  /** `null` is the "All" chip. */
  category: DocumentCategory | null;
  label: string;
  count: number;
}

const categoryLabels: Record<DocumentCategory, string> = {
  passport: 'Passports',
  visa: 'Visas',
  health: 'Health',
  license: 'Licenses',
  warranty: 'Warranties',
  contract: 'Contracts',
  other: 'Other',
};

/**
 * The filter chip row: "All" first, then only the categories that actually have
 * items — an empty vault gets no chips rather than seven zeroes.
 */
export function buildCategoryFilters(
  countsByCategory: Partial<Record<DocumentCategory, number>>,
  total: number,
): CategoryFilter[] {
  if (total === 0) {
    return [];
  }

  const present = (Object.keys(categoryLabels) as DocumentCategory[])
    .filter((category) => (countsByCategory[category] ?? 0) > 0)
    .map((category) => ({
      category,
      label: categoryLabels[category],
      count: countsByCategory[category] ?? 0,
    }));

  return [{ category: null, label: 'All', count: total }, ...present];
}

export function categoryLabel(category: DocumentCategory): string {
  return categoryLabels[category];
}

/** The header greeting. Takes a Date because it is about the time, not the date. */
export function greetingFor(now: Date): string {
  const hour = now.getHours();

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 18) {
    return 'Good afternoon';
  }

  return 'Good evening';
}

/** "Residence Permit (18 days)" for the hero card's next-renewal line. */
export function nextRenewalLabel(item: Item, today: IsoDate): string {
  const remaining = daysUntilExpiry(item.expiryDate, today);

  if (remaining < 0) {
    return `${item.title} (expired)`;
  }

  return `${item.title} (${remaining} ${remaining === 1 ? 'day' : 'days'})`;
}
