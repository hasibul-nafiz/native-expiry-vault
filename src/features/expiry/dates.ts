import type { IsoDate } from '@/db/models';

/**
 * Date-only arithmetic with no timezone semantics.
 *
 * An expiry date is a calendar date, not an instant: a passport expiring on
 * 2031-05-14 expires on that date everywhere on earth. Converting through
 * `Date` would attach a timezone and introduce off-by-one-day drift whenever the
 * device is east or west of UTC. So every function here works on the integer
 * fields of a `YYYY-MM-DD` string, and `Date` appears in exactly one place:
 * `todayLocal`, the boundary where the device's calendar date is read.
 */

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days between 1970-01-01 and 0000-03-01, the epoch shift used below. */
const DAYS_FROM_CIVIL_EPOCH_SHIFT = 719468;
/** Days in a 400-year Gregorian era. */
const DAYS_PER_ERA = 146097;

export class InvalidDateError extends Error {
  constructor(readonly value: string) {
    super(`"${value}" is not a valid YYYY-MM-DD date.`);
    this.name = 'InvalidDateError';
  }
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

/**
 * Howard Hinnant's days_from_civil: a proleptic Gregorian calendar to epoch-day
 * conversion using only integer arithmetic. Assumes the fields are in range;
 * `toEpochDay` validates by round-tripping the result.
 */
function daysFromCivil(year: number, month: number, day: number): number {
  const shiftedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(shiftedYear / 400);
  const yearOfEra = shiftedYear - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;

  return era * DAYS_PER_ERA + dayOfEra - DAYS_FROM_CIVIL_EPOCH_SHIFT;
}

/** The inverse, civil_from_days. */
function civilFromDays(epochDay: number): {
  year: number;
  month: number;
  day: number;
} {
  const shifted = epochDay + DAYS_FROM_CIVIL_EPOCH_SHIFT;
  const era = Math.floor(shifted / DAYS_PER_ERA);
  const dayOfEra = shifted - era * DAYS_PER_ERA;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365,
  );
  const year = yearOfEra + era * 400;
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthPrime = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthPrime + 2) / 5) + 1;
  const month = monthPrime + (monthPrime < 10 ? 3 : -9);

  return { year: year + (month <= 2 ? 1 : 0), month, day };
}

/** True when `value` is a real calendar date in `YYYY-MM-DD` form. */
export function isIsoDate(value: string): value is IsoDate {
  const match = ISO_DATE_PATTERN.exec(value);

  if (match === null) {
    return false;
  }

  const [, year, month, day] = match;

  // Round-tripping is the validity check: 2026-02-30 and 2023-02-29 convert to
  // an epoch day that formats back as a different date.
  return formatIsoDate(daysFromCivil(Number(year), Number(month), Number(day))) === value;
}

function assertIsoDate(value: string): asserts value is IsoDate {
  if (!isIsoDate(value)) {
    throw new InvalidDateError(value);
  }
}

/** Days since 1970-01-01. Negative for earlier dates. */
export function toEpochDay(date: IsoDate): number {
  assertIsoDate(date);
  const [, year, month, day] = ISO_DATE_PATTERN.exec(date) as RegExpExecArray;

  return daysFromCivil(Number(year), Number(month), Number(day));
}

/** The inverse of `toEpochDay`. */
export function formatIsoDate(epochDay: number): IsoDate {
  const { year, month, day } = civilFromDays(epochDay);

  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** Whole days from `from` to `to`. Positive when `to` is later. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toEpochDay(to) - toEpochDay(from);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return formatIsoDate(toEpochDay(date) + days);
}

/** -1, 0 or 1, so it can be handed straight to `Array.prototype.sort`. */
export function compareDates(a: IsoDate, b: IsoDate): number {
  const difference = toEpochDay(a) - toEpochDay(b);

  return difference === 0 ? 0 : difference < 0 ? -1 : 1;
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return compareDates(a, b) <= 0 ? a : b;
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return compareDates(a, b) >= 0 ? a : b;
}

/**
 * The device's current calendar date, in its local timezone.
 *
 * This is the only impure function in the module and the only place `Date` is
 * read. Everything downstream takes `today` as an explicit argument, which keeps
 * the rest of the app's expiry logic pure and testable. Local (not UTC) getters
 * are used deliberately: a user in Auckland at 09:00 on the 21st should see the
 * 21st, not UTC's 20th.
 */
export function todayLocal(now: Date = new Date()): IsoDate {
  return toIsoDateLocal(now);
}

/**
 * Reads a `Date`'s *local* calendar date. The boundary for anything that hands
 * us a `Date`, such as a native date picker: the user picked a day on a
 * calendar, and that day must survive regardless of the device's offset.
 */
export function toIsoDateLocal(date: Date): IsoDate {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}

/**
 * The inverse, for handing a calendar date back to a native picker. Anchored at
 * midday so a DST transition cannot shift it onto the neighbouring day.
 */
export function fromIsoDateLocal(date: IsoDate): Date {
  return atLocalTime(date, 12, 0);
}

/**
 * The instant at `hour:minute` local time on `date`.
 *
 * The multi-argument `Date` constructor is used deliberately: it resolves the
 * wall-clock time against whatever offset is in force on that specific day, so
 * 09:00 stays 09:00 either side of a DST transition. Deriving the same instant
 * arithmetically — a UTC midnight plus `hour * 3600 * 1000` — lands an hour out
 * for half the year, which is the bug this function exists to make impossible.
 */
export function atLocalTime(date: IsoDate, hour: number, minute = 0): Date {
  const [, year, month, day] = ISO_DATE_PATTERN.exec(date) ?? [];

  if (year === undefined || month === undefined || day === undefined) {
    throw new InvalidDateError(date);
  }

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`Hour must be an integer from 0 to 23, got ${hour}.`);
  }

  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new RangeError(`Minute must be an integer from 0 to 59, got ${minute}.`);
  }

  return new Date(Number(year), Number(month) - 1, Number(day), hour, minute, 0, 0);
}
