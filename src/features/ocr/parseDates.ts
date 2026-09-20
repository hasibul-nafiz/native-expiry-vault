import type { IsoDate } from '@/db/models';
import { compareDates, isIsoDate, todayLocal } from '@/features/expiry';

/**
 * Finding dates in recognised text, and saying how sure we are.
 *
 * The hard problem is not recognising a date, it is that `03/04/2028` is two
 * different dates depending on where the document was printed, and nothing in
 * the text says which. This parser **never guesses**: an ambiguous reading is
 * returned once, flagged, carrying both dates, and the confirm screen makes the
 * user choose. Silently resolving it by device locale is exactly the bug that
 * sets a visa reminder nine months late.
 *
 * Pure, and `today` is passed rather than read so the century window and the
 * future-date bonus are testable at any point in time.
 */

export type DateFormatHint = 'dmy' | 'mdy' | 'ymd' | 'month-name' | 'mrz';

export interface DateCandidate {
  date: IsoDate;
  /** 0-1, our ranking. Never an OCR confidence — ML Kit does not report one. */
  score: number;
  /** The substring it was read from, so the confirm screen can show it. */
  source: string;
  format: DateFormatHint;
  /**
   * True when the same digits are a second valid date with day and month
   * swapped. The UI must offer both.
   */
  ambiguous: boolean;
  /** The other reading, when `ambiguous`. */
  alternative?: IsoDate;
}

/**
 * Years either side of today used to place a two-digit year.
 *
 * Asymmetric on purpose, and the same window the MRZ uses. A document is
 * issued to someone born up to eighty years ago and expires within a decade or
 * two, so `'95'` is 1995 and `'30'` is 2030. A symmetric window would read
 * `'95'` as 2095, which no document in this app will ever mean.
 */
const PAST_WINDOW_YEARS = 80;
const FUTURE_WINDOW_YEARS = 20;

/**
 * Labels that mark the field as an expiry, in the languages ICAO documents and
 * European residence permits are printed in. Matched case-insensitively
 * against the text around the date.
 */
const EXPIRY_LABELS = [
  'expiry',
  'expires',
  'expiration',
  'exp date',
  'date of expiry',
  'valid until',
  'valid till',
  'valid thru',
  'valid to',
  'good through',
  "date d'expiration",
  'expire le',
  "valable jusqu'au",
  'fecha de caducidad',
  'caduca',
  'valido hasta',
  'gultig bis',
  'gültig bis',
  'ablaufdatum',
  'scadenza',
  'vervaldatum',
];

/**
 * Labels that mark the field as something else. An issue date sitting next to
 * an expiry date is the commonest way to read the wrong one, so these push the
 * candidate down rather than merely failing to push it up.
 */
const OTHER_DATE_LABELS = [
  'issue',
  'issued',
  'date of birth',
  'birth',
  'dob',
  'born',
  'delivrance',
  'délivrance',
  'nacimiento',
  'geburt',
  'ausstellung',
];

const MONTH_NAMES: Readonly<Record<string, number>> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const MONTH_ALTERNATION = Object.keys(MONTH_NAMES).sort((a, b) => b.length - a.length).join('|');

/** `YYYY-MM-DD` and `YYYY/MM/DD`. Unambiguous: a four-digit year leads. */
const YMD_PATTERN = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g;

/**
 * A year group. Four digits are tried first: with `\d{2}` leading, `2030`
 * matches as `20` and leaves `30` behind, which is how `OCT 2030` was read as
 * the 20th of October 1930.
 */
const YEAR = String.raw`(\d{4}|\d{2})`;

/** At least one separator, so two adjacent numbers cannot merge into a date. */
const SEPARATOR = String.raw`[-/.,]?[\s]|[-/.,]\s?`;

/** `DD/MM/YYYY` or `MM/DD/YYYY`, two- or four-digit year. Order unknown. */
const NUMERIC_PATTERN = new RegExp(
  String.raw`\b(\d{1,2})[-/. ](\d{1,2})[-/. ]${YEAR}\b`,
  'g',
);

/** `28 OCT 2030`, `28-October-30`. */
const DAY_MONTH_YEAR_PATTERN = new RegExp(
  String.raw`\b(\d{1,2})(?:${SEPARATOR})(${MONTH_ALTERNATION})(?:${SEPARATOR})${YEAR}\b`,
  'gi',
);

/** `OCT 28 2030`, `October 28, 2030`. */
const MONTH_DAY_YEAR_PATTERN = new RegExp(
  String.raw`\b(${MONTH_ALTERNATION})(?:${SEPARATOR})(\d{1,2})(?:st|nd|rd|th)?(?:${SEPARATOR})${YEAR}\b`,
  'gi',
);

/** Base score per format, before the contextual adjustments below. */
const BASE_SCORE: Readonly<Record<DateFormatHint, number>> = {
  mrz: 0.95,
  'month-name': 0.6,
  ymd: 0.55,
  dmy: 0.4,
  mdy: 0.4,
};

const LABEL_BONUS = 0.3;
const OTHER_LABEL_PENALTY = 0.25;
const FUTURE_BONUS = 0.1;
const AMBIGUITY_PENALTY = 0.15;

/**
 * Resolves a two- or four-digit year. Two-digit years pick the century that
 * lands inside the window; four-digit years are taken as written.
 */
function resolveYear(raw: string, today: IsoDate): number | null {
  if (raw.length === 4) {
    return Number(raw);
  }

  const currentYear = Number(today.slice(0, 4));
  const currentCentury = Math.floor(currentYear / 100) * 100;
  const short = Number(raw);

  for (const year of [currentCentury + short, currentCentury - 100 + short]) {
    if (year >= currentYear - PAST_WINDOW_YEARS && year <= currentYear + FUTURE_WINDOW_YEARS) {
      return year;
    }
  }

  return null;
}

/** Builds an ISO date only when the fields form a real calendar date. */
function toIso(year: number | null, month: number, day: number): IsoDate | null {
  if (year === null) {
    return null;
  }

  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return isIsoDate(iso) ? iso : null;
}

function hasLabel(context: string, labels: readonly string[]): boolean {
  return labels.some((label) => context.includes(label));
}

/**
 * The line a match sits on, lowercased, for label proximity.
 *
 * Deliberately not a character window either side: recognition puts each
 * printed field on its own line, and a window wide enough to catch the label
 * on one line is wide enough to catch the *next* field's label too. That is
 * what made a receipt's purchase date inherit the warranty date's "valid
 * until" and outrank it.
 */
function lineAround(text: string, index: number): string {
  const start = text.lastIndexOf('\n', index) + 1;
  const end = text.indexOf('\n', index);

  return text.slice(start, end === -1 ? text.length : end).toLowerCase();
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

interface RawMatch {
  date: IsoDate;
  alternative?: IsoDate;
  source: string;
  index: number;
  format: DateFormatHint;
}

function collectYmd(text: string, today: IsoDate): RawMatch[] {
  const matches: RawMatch[] = [];

  for (const match of text.matchAll(YMD_PATTERN)) {
    const date = toIso(resolveYear(match[1], today), Number(match[2]), Number(match[3]));

    if (date !== null) {
      matches.push({ date, source: match[0], index: match.index, format: 'ymd' });
    }
  }

  return matches;
}

function collectNumeric(text: string, today: IsoDate): RawMatch[] {
  const matches: RawMatch[] = [];

  for (const match of text.matchAll(NUMERIC_PATTERN)) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = resolveYear(match[3], today);

    // Both orders are attempted; whichever produce real dates survive.
    const dayFirst = toIso(year, second, first);
    const monthFirst = toIso(year, first, second);

    if (dayFirst !== null && monthFirst !== null && dayFirst !== monthFirst) {
      // Genuinely ambiguous. Day-first is listed as the primary reading only
      // because it has to be listed somehow — `ambiguous` is what matters, and
      // the UI shows both.
      matches.push({
        date: dayFirst,
        alternative: monthFirst,
        source: match[0],
        index: match.index,
        format: 'dmy',
      });
      continue;
    }

    if (dayFirst !== null) {
      matches.push({ date: dayFirst, source: match[0], index: match.index, format: 'dmy' });
      continue;
    }

    if (monthFirst !== null) {
      // Only one order is a real date — 13/04 can only be the 13th of April.
      matches.push({ date: monthFirst, source: match[0], index: match.index, format: 'mdy' });
    }
  }

  return matches;
}

function collectMonthName(text: string, today: IsoDate): RawMatch[] {
  const matches: RawMatch[] = [];

  for (const match of text.matchAll(DAY_MONTH_YEAR_PATTERN)) {
    const month = MONTH_NAMES[match[2].toLowerCase()];
    const date = toIso(resolveYear(match[3], today), month, Number(match[1]));

    if (date !== null) {
      matches.push({ date, source: match[0], index: match.index, format: 'month-name' });
    }
  }

  for (const match of text.matchAll(MONTH_DAY_YEAR_PATTERN)) {
    const month = MONTH_NAMES[match[1].toLowerCase()];
    const date = toIso(resolveYear(match[3], today), month, Number(match[2]));

    if (date !== null) {
      matches.push({ date, source: match[0], index: match.index, format: 'month-name' });
    }
  }

  return matches;
}

/**
 * Scores every date in `text` and returns them best first.
 *
 * Empty for text with no date in it, which is the ordinary result for a blurred
 * frame and must not be an error.
 */
export function parseDates(text: string, today: IsoDate = todayLocal()): DateCandidate[] {
  const raw = [
    ...collectYmd(text, today),
    ...collectNumeric(text, today),
    ...collectMonthName(text, today),
  ];

  const candidates = new Map<string, DateCandidate>();

  for (const match of raw) {
    const context = lineAround(text, match.index);
    const ambiguous = match.alternative !== undefined;

    let score = BASE_SCORE[match.format];

    if (hasLabel(context, EXPIRY_LABELS)) {
      score += LABEL_BONUS;
    } else if (hasLabel(context, OTHER_DATE_LABELS)) {
      score -= OTHER_LABEL_PENALTY;
    }

    if (compareDates(match.date, today) > 0) {
      score += FUTURE_BONUS;
    }

    if (ambiguous) {
      score -= AMBIGUITY_PENALTY;
    }

    const candidate: DateCandidate = {
      date: match.date,
      score: clamp(score),
      source: match.source,
      format: match.format,
      ambiguous,
      ...(match.alternative === undefined ? {} : { alternative: match.alternative }),
    };

    // The same date read twice — a `YYYY-MM-DD` that also matches the numeric
    // pattern, say — is one candidate, keeping the better-scoring reading.
    const existing = candidates.get(candidate.date);

    if (existing === undefined || candidate.score > existing.score) {
      candidates.set(candidate.date, candidate);
    }
  }

  // Ties break on the date itself, so the same text always ranks identically.
  return [...candidates.values()].sort((a, b) =>
    a.score === b.score ? compareDates(a.date, b.date) : b.score - a.score,
  );
}
