import type { IsoDate } from '@/db/models';

import { formatIsoDate, toEpochDay } from './dates';

/**
 * The rolling "90 days in any 180" rule behind the vault-health screen's
 * "Schengen 90/180 Days" readout.
 */

export const SCHENGEN_WINDOW_DAYS = 180;
export const SCHENGEN_ALLOWANCE_DAYS = 90;

/** A period of presence. A null `exitDate` means the stay is still open. */
export interface StayPeriod {
  entryDate: IsoDate;
  exitDate: IsoDate | null;
}

export interface WindowUsage {
  /** Days of presence inside the window, counting entry and exit days. */
  used: number;
  /** Allowance still available, floored at zero. */
  remaining: number;
  allowance: number;
  windowStart: IsoDate;
  windowEnd: IsoDate;
}

/**
 * Days of presence in the `windowDays` window ending on `today` (inclusive).
 *
 * Presence is counted per calendar day rather than per stay, so overlapping or
 * duplicated stays cannot inflate the total — the rule counts days in the area,
 * and a day spent there twice is still one day. The window is at most a few
 * hundred entries, so a day-by-day tally is both exact and cheap.
 *
 * Both the entry and the exit day count as days of presence, which is how the
 * Schengen short-stay calculator treats them.
 */
export function daysUsedInWindow(
  stays: readonly StayPeriod[],
  today: IsoDate,
  windowDays: number = SCHENGEN_WINDOW_DAYS,
): number {
  if (!Number.isInteger(windowDays) || windowDays < 1) {
    throw new RangeError(`Window must be a positive whole number of days, got ${windowDays}.`);
  }

  const windowEnd = toEpochDay(today);
  const windowStart = windowEnd - (windowDays - 1);
  const present = new Set<number>();

  for (const stay of stays) {
    const entry = toEpochDay(stay.entryDate);
    // An open stay is presence up to and including today; a future entry has
    // not happened yet and is ignored by the clamp below.
    const exit = stay.exitDate === null ? windowEnd : toEpochDay(stay.exitDate);

    const from = Math.max(entry, windowStart);
    const to = Math.min(exit, windowEnd);

    for (let day = from; day <= to; day += 1) {
      present.add(day);
    }
  }

  return present.size;
}

export function schengenUsage(
  stays: readonly StayPeriod[],
  today: IsoDate,
  allowance: number = SCHENGEN_ALLOWANCE_DAYS,
  windowDays: number = SCHENGEN_WINDOW_DAYS,
): WindowUsage {
  const used = daysUsedInWindow(stays, today, windowDays);
  const windowEnd = toEpochDay(today);

  return {
    used,
    remaining: Math.max(0, allowance - used),
    allowance,
    windowStart: formatIsoDate(windowEnd - (windowDays - 1)),
    windowEnd: today,
  };
}
