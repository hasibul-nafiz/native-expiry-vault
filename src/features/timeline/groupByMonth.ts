import type { IsoDate, Item } from '@/db/models';

import { compareDates, daysUntilExpiry } from '../expiry';

import { monthBand, type TimelineBand } from './bands';

/**
 * The timeline feed: every active item grouped into the calendar month it
 * expires in, oldest first.
 *
 * Already-expired items keep their own (past) month rather than being collapsed
 * into an "overdue" bucket, which is what puts the lapsed documents at the top
 * of the feed where the export draws them.
 */

export interface MonthGroup {
  /** `YYYY-MM`. Sorts lexicographically, which is why it doubles as the sort key. */
  key: string;
  year: number;
  /** 1-12. */
  month: number;
  band: TimelineBand;
  /** The smallest countdown in the group; negative once something has lapsed. */
  minDaysRemaining: number;
  items: Item[];
}

function monthKeyOf(date: IsoDate): string {
  return date.slice(0, 7);
}

/**
 * @param items Active items in any order; grouping does not assume the caller
 * sorted them.
 */
export function groupByMonth(items: readonly Item[], today: IsoDate): MonthGroup[] {
  const groups = new Map<string, Item[]>();

  for (const item of items) {
    // Validates the date as a side effect: an unparseable expiry throws here
    // rather than silently forming a group nothing can render.
    daysUntilExpiry(item.expiryDate, today);

    const key = monthKeyOf(item.expiryDate);
    const existing = groups.get(key);

    if (existing === undefined) {
      groups.set(key, [item]);
    } else {
      existing.push(item);
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, groupItems]) => {
      const sorted = [...groupItems].sort(
        (a, b) => compareDates(a.expiryDate, b.expiryDate) || a.title.localeCompare(b.title),
      );
      const minDaysRemaining = Math.min(
        ...sorted.map((item) => daysUntilExpiry(item.expiryDate, today)),
      );

      return {
        key,
        year: Number(key.slice(0, 4)),
        month: Number(key.slice(5, 7)),
        band: monthBand(minDaysRemaining),
        minDaysRemaining,
        items: sorted,
      };
    });
}

/**
 * The same groups, shaped for a `SectionList`.
 *
 * `SectionList` insists the rows live under `data`, so the feed's sections are
 * a `MonthGroup` with its `items` aliased rather than a second structure — the
 * grouping rules stay in one place and the screen cannot drift from them.
 */
export interface MonthSection extends MonthGroup {
  data: Item[];
}

export function toSections(groups: readonly MonthGroup[]): MonthSection[] {
  return groups.map((group) => ({ ...group, data: group.items }));
}
