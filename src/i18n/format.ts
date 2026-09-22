import type { IsoDate } from '@/db/models';
import type { SupportedLocale } from '@/settings/preferences';

/**
 * Locale-aware formatting for dates, numbers and times.
 *
 * Before F11 every date reached the user as a raw `YYYY-MM-DD` string. These
 * replace that everywhere.
 *
 * Numbers are pinned to Latin digits with the `-u-nu-latn` extension. Bengali's
 * default numbering system is `beng`, so `Intl` would otherwise render counts,
 * scores and years as ১২৩. Two reasons not to: a screen mixing Bengali digits
 * from `Intl` with Latin digits from any raw interpolation looks broken, and
 * every numeric assertion in the suite would become locale-dependent. Logged as
 * a deliberate choice, not an oversight.
 */

const LATIN_DIGITS = '-u-nu-latn';

function withLatinDigits(locale: SupportedLocale): string {
  return `${locale}${LATIN_DIGITS}`;
}

/**
 * `Intl` needs a `Date`. An `IsoDate` is a calendar date with no timezone, so it
 * is anchored at midday UTC — far enough from either boundary that no offset can
 * shift the rendered day, the same trick F5 uses at the date-picker boundary.
 */
function toDate(date: IsoDate): Date {
  return new Date(`${date}T12:00:00Z`);
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  const cached = dateFormatters.get(key);

  if (cached !== undefined) {
    return cached;
  }

  // Constructing an Intl formatter is comparatively expensive and these are
  // called once per row; the set of shapes is small and fixed.
  const formatter = new Intl.DateTimeFormat(withLatinDigits(locale), {
    timeZone: 'UTC',
    ...options,
  });

  dateFormatters.set(key, formatter);

  return formatter;
}

/** "14 May 2031" — the default for a date shown on its own. */
export function formatDate(date: IsoDate, locale: SupportedLocale): string {
  return dateFormatter(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    toDate(date),
  );
}

/** "14 May 2031" in full, for detail screens where space allows. */
export function formatDateLong(date: IsoDate, locale: SupportedLocale): string {
  return dateFormatter(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    toDate(date),
  );
}

/** "MAY 2031" for the timeline's month headers, replacing F10's English array. */
export function formatMonthHeading(year: number, month: number, locale: SupportedLocale): string {
  const date = new Date(Date.UTC(year, month - 1, 15, 12));

  return dateFormatter(locale, { month: 'short', year: 'numeric' }).format(date).toUpperCase();
}

/** "09:00" — the reminder delivery time. Hour-only, so minutes are always zero. */
export function formatHour(hour: number, locale: SupportedLocale): string {
  const date = new Date(Date.UTC(2000, 0, 1, hour, 0));

  return dateFormatter(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

const numberFormatters = new Map<string, Intl.NumberFormat>();

export function formatNumber(value: number, locale: SupportedLocale): string {
  const cached = numberFormatters.get(locale);

  if (cached !== undefined) {
    return cached.format(value);
  }

  const formatter = new Intl.NumberFormat(withLatinDigits(locale));
  numberFormatters.set(locale, formatter);

  return formatter.format(value);
}

/** Test seam: the caches outlive a single test otherwise. */
export function clearFormatterCaches(): void {
  dateFormatters.clear();
  numberFormatters.clear();
}
