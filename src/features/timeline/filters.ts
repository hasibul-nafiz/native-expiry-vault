import type { IsoDate, Item } from '@/db/models';

import { daysUntilExpiry } from '../expiry';

/**
 * The four filter chips above the feed.
 *
 * Every range is resolved against `today` rather than hardcoded: the export's
 * third and fourth chips read "This Year" and "2026+", which are only correct
 * in the year it was drawn.
 *
 * Filtering happens in JS over the already-fetched items, not as a second
 * query — the same rule F4 applied to the dashboard, so a chip's count and the
 * feed it filters cannot disagree across a midnight boundary.
 */

export type TimelineRange = 'all' | 'next30' | 'thisYear' | 'later';

export const timelineRanges: readonly TimelineRange[] = ['all', 'next30', 'thisYear', 'later'];

/** Days remaining at or below which an item falls in the "Next 30 Days" chip. */
export const NEXT_RANGE_DAYS = 30;

function yearOf(date: IsoDate): number {
  return Number(date.slice(0, 4));
}

export function isInRange(expiryDate: IsoDate, today: IsoDate, range: TimelineRange): boolean {
  switch (range) {
    case 'all':
      return true;
    case 'next30':
      // Overdue items are included: they are the most urgent thing the chip can
      // surface, and excluding them would have "Next 30 Days" hide a lapsed
      // document while showing one that expires in four weeks.
      return daysUntilExpiry(expiryDate, today) <= NEXT_RANGE_DAYS;
    case 'thisYear':
      return yearOf(expiryDate) === yearOf(today);
    case 'later':
      return yearOf(expiryDate) > yearOf(today);
  }
}

export function filterByRange(
  items: readonly Item[],
  today: IsoDate,
  range: TimelineRange,
): Item[] {
  return items.filter((item) => isInRange(item.expiryDate, today, range));
}

/** The number on each chip. Ranges overlap, so these do not sum to `all`. */
export function countsByRange(
  items: readonly Item[],
  today: IsoDate,
): Record<TimelineRange, number> {
  return {
    all: items.length,
    next30: filterByRange(items, today, 'next30').length,
    thisYear: filterByRange(items, today, 'thisYear').length,
    later: filterByRange(items, today, 'later').length,
  };
}
