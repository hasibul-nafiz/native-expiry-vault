import type { IsoDate } from '@/db/models';
import { isIsoDate, todayLocal } from '@/features/expiry';

/**
 * ICAO 9303 machine-readable zone parsing.
 *
 * The MRZ is the one part of a travel document designed to be read by a
 * machine, and the only part that can be *checked*: every field it carries is
 * followed by a 7-3-1 weighted check digit. That is what makes an MRZ expiry
 * date worth more than any date lifted out of the printed page — a `0` read as
 * an `O` fails arithmetic rather than silently becoming a wrong reminder.
 *
 * Pure: text in, fields out. No I/O, no clock beyond the century window.
 */

/** The three ICAO document formats, by line count and length. */
export type MrzType = 'TD1' | 'TD2' | 'TD3';

export type MrzField = 'documentNumber' | 'dateOfBirth' | 'expiryDate';

export interface MrzResult {
  type: MrzType;
  documentNumber: string | null;
  /** ISO 3166-1 alpha-2, mapped from the MRZ's alpha-3. Null when unmapped. */
  issuingCountry: string | null;
  /** The raw alpha-3 as printed, kept even when the mapping fails. */
  issuingCountryAlpha3: string | null;
  dateOfBirth: IsoDate | null;
  expiryDate: IsoDate | null;
  /** Which fields passed their check digit. */
  verified: Record<MrzField, boolean>;
  /** The lines exactly as they were matched, for the confirm screen. */
  lines: string[];
}

/**
 * The MRZ alphabet: A-Z, 0-9 and the filler `<`. Anything else on a line means
 * it is not an MRZ line, which is how printed text below the zone is rejected.
 */
const MRZ_LINE = /^[A-Z0-9<]+$/;

/** Line lengths per format. TD1 is three lines, TD2 and TD3 are two. */
const TD1_LENGTH = 30;
const TD2_LENGTH = 36;
const TD3_LENGTH = 44;

/**
 * Two-digit years in the MRZ carry no century. A date of birth is in the past
 * and an expiry date is in the near future, but the MRZ does not say which
 * field is which beyond position, so one window serves both: the century that
 * places the date inside it.
 */
const PAST_WINDOW_YEARS = 80;
const FUTURE_WINDOW_YEARS = 20;

/**
 * Alpha-3 to alpha-2, because `items.country` is constrained to two letters by
 * `CHECK (country GLOB '[A-Z][A-Z]')`. Covering every ISO code would be a
 * second data file to maintain; this covers the issuing authorities a document
 * in this app realistically carries, and an unmapped code yields null rather
 * than a constraint violation at save time.
 */
const ALPHA3_TO_ALPHA2: Readonly<Record<string, string>> = {
  ARE: 'AE', ARG: 'AR', AUS: 'AU', AUT: 'AT', BEL: 'BE', BGD: 'BD', BGR: 'BG',
  BRA: 'BR', CAN: 'CA', CHE: 'CH', CHL: 'CL', CHN: 'CN', COL: 'CO', CZE: 'CZ',
  DEU: 'DE', DNK: 'DK', EGY: 'EG', ESP: 'ES', EST: 'EE', FIN: 'FI', FRA: 'FR',
  GBR: 'GB', GRC: 'GR', HKG: 'HK', HRV: 'HR', HUN: 'HU', IDN: 'ID', IND: 'IN',
  IRL: 'IE', IRN: 'IR', ISL: 'IS', ISR: 'IL', ITA: 'IT', JPN: 'JP', KEN: 'KE',
  KOR: 'KR', LKA: 'LK', LTU: 'LT', LUX: 'LU', LVA: 'LV', MAR: 'MA', MEX: 'MX',
  MYS: 'MY', NGA: 'NG', NLD: 'NL', NOR: 'NO', NPL: 'NP', NZL: 'NZ', PAK: 'PK',
  PER: 'PE', PHL: 'PH', POL: 'PL', PRT: 'PT', QAT: 'QA', ROU: 'RO', RUS: 'RU',
  SAU: 'SA', SGP: 'SG', SVK: 'SK', SVN: 'SI', SWE: 'SE', THA: 'TH', TUR: 'TR',
  TWN: 'TW', UKR: 'UA', USA: 'US', VNM: 'VN', ZAF: 'ZA',
};

const CHECK_WEIGHTS = [7, 3, 1];

/**
 * The ICAO 9303 check digit: each character's value times a repeating 7-3-1
 * weight, summed modulo 10. Letters are their 1-based alphabet position plus
 * nine; the filler `<` is zero.
 */
export function mrzCheckDigit(value: string): number {
  let sum = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    let digit: number;

    if (character === '<') {
      digit = 0;
    } else if (character >= '0' && character <= '9') {
      digit = Number(character);
    } else if (character >= 'A' && character <= 'Z') {
      digit = character.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
    } else {
      // Outside the MRZ alphabet: the field cannot be checked, so fail it
      // rather than skipping the character and producing a plausible sum.
      return -1;
    }

    sum += digit * CHECK_WEIGHTS[index % CHECK_WEIGHTS.length];
  }

  return sum % 10;
}

function checkPasses(value: string, digit: string): boolean {
  if (!/^\d$/.test(digit)) {
    return false;
  }

  return mrzCheckDigit(value) === Number(digit);
}

/** Strips the MRZ filler from a field, leaving the value as issued. */
function unpad(value: string): string | null {
  const trimmed = value.replace(/</g, '').trim();

  return trimmed === '' ? null : trimmed;
}

/**
 * `YYMMDD` to a full date, choosing the century that lands inside the window
 * around today. Returns null for anything that is not a real calendar date, so
 * a misread `999999` is dropped rather than carried forward.
 */
export function mrzDate(value: string, today: IsoDate): IsoDate | null {
  if (!/^\d{6}$/.test(value)) {
    return null;
  }

  const year = Number(value.slice(0, 2));
  const month = value.slice(2, 4);
  const day = value.slice(4, 6);
  const currentYear = Number(today.slice(0, 4));
  const currentCentury = Math.floor(currentYear / 100) * 100;

  for (const candidateYear of [currentCentury + year, currentCentury - 100 + year]) {
    if (
      candidateYear < currentYear - PAST_WINDOW_YEARS ||
      candidateYear > currentYear + FUTURE_WINDOW_YEARS
    ) {
      continue;
    }

    const iso = `${String(candidateYear).padStart(4, '0')}-${month}-${day}`;

    if (isIsoDate(iso)) {
      return iso;
    }
  }

  return null;
}

/**
 * Pulls candidate MRZ lines out of whatever the OCR returned.
 *
 * Recognition of a passport's photo page returns the printed fields and the
 * zone together, in no guaranteed order, so the lines are found by shape —
 * MRZ alphabet only, at one of the three known lengths — rather than by
 * position. Spaces are stripped first because OCR frequently splits the zone's
 * filler runs.
 */
function candidateLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, '').toUpperCase())
    .filter(
      (line) =>
        MRZ_LINE.test(line) &&
        (line.length === TD1_LENGTH || line.length === TD2_LENGTH || line.length === TD3_LENGTH),
    );
}

/** Consecutive lines of the same length, which is what a zone looks like. */
function runOfLength(lines: readonly string[], length: number, count: number): string[] | null {
  let run: string[] = [];

  for (const line of lines) {
    run = line.length === length ? [...run, line] : [];

    if (run.length === count) {
      return run;
    }
  }

  return null;
}

/**
 * TD3 (passport) and TD2: the second line carries every field this app wants.
 *
 * ```
 * P<GBRSMITH<<JOHN<<<<<<<<<<<<<<<<<<<<<<<<<<<<
 * P4920191<4GBR8501012M3010284<<<<<<<<<<<<<<04
 * ^docNo   ^cd  ^nat ^dob  ^cd^sex^exp  ^cd
 * ```
 */
function parseTd2OrTd3(lines: string[], type: 'TD2' | 'TD3', today: IsoDate): MrzResult {
  const second = lines[1];
  const documentNumber = second.slice(0, 9);
  const documentCheck = second.slice(9, 10);
  const alpha3 = unpad(second.slice(10, 13));
  const birth = second.slice(13, 19);
  const birthCheck = second.slice(19, 20);
  const expiry = second.slice(21, 27);
  const expiryCheck = second.slice(27, 28);

  return {
    type,
    documentNumber: unpad(documentNumber),
    issuingCountryAlpha3: alpha3,
    issuingCountry: alpha3 === null ? null : (ALPHA3_TO_ALPHA2[alpha3] ?? null),
    dateOfBirth: mrzDate(birth, today),
    expiryDate: mrzDate(expiry, today),
    verified: {
      documentNumber: checkPasses(documentNumber, documentCheck),
      dateOfBirth: checkPasses(birth, birthCheck),
      expiryDate: checkPasses(expiry, expiryCheck),
    },
    lines,
  };
}

/**
 * TD1 (ID cards): three 30-character lines. The document number sits on the
 * first line and the dates on the second.
 *
 * ```
 * I<UTOD231458907<<<<<<<<<<<<<<<
 * 7408122F1204159UTO<<<<<<<<<<<6
 * ^dob  ^cd^sex^exp ^cd^nat
 * ```
 */
function parseTd1(lines: string[], today: IsoDate): MrzResult {
  const [first, second] = lines;
  const documentNumber = first.slice(5, 14);
  const documentCheck = first.slice(14, 15);
  const birth = second.slice(0, 6);
  const birthCheck = second.slice(6, 7);
  const expiry = second.slice(8, 14);
  const expiryCheck = second.slice(14, 15);
  const alpha3 = unpad(second.slice(15, 18));

  return {
    type: 'TD1',
    documentNumber: unpad(documentNumber),
    issuingCountryAlpha3: alpha3,
    issuingCountry: alpha3 === null ? null : (ALPHA3_TO_ALPHA2[alpha3] ?? null),
    dateOfBirth: mrzDate(birth, today),
    expiryDate: mrzDate(expiry, today),
    verified: {
      documentNumber: checkPasses(documentNumber, documentCheck),
      dateOfBirth: checkPasses(birth, birthCheck),
      expiryDate: checkPasses(expiry, expiryCheck),
    },
    lines,
  };
}

/**
 * Finds and reads the first machine-readable zone in `text`.
 *
 * Returns null when there is none — a utility bill or a warranty card has no
 * MRZ, and that is the ordinary case, not an error. A failed check digit does
 * **not** discard the field: the value is still the best reading available and
 * the caller decides how much to trust it, which is why `verified` is reported
 * per field rather than collapsed into a boolean.
 */
export function parseMrz(text: string, today: IsoDate = todayLocal()): MrzResult | null {
  const lines = candidateLines(text);

  const td3 = runOfLength(lines, TD3_LENGTH, 2);

  if (td3 !== null) {
    return parseTd2OrTd3(td3, 'TD3', today);
  }

  const td1 = runOfLength(lines, TD1_LENGTH, 3);

  if (td1 !== null) {
    return parseTd1(td1, today);
  }

  const td2 = runOfLength(lines, TD2_LENGTH, 2);

  if (td2 !== null) {
    return parseTd2OrTd3(td2, 'TD2', today);
  }

  return null;
}
