import { mrzCheckDigit, mrzDate, parseMrz } from '../parseMrz';

import {
  FRENCH_PERMIT,
  GERMAN_ID,
  NO_DATE,
  UK_PASSPORT,
  UK_PASSPORT_MISREAD,
  US_INSURANCE_CARD,
} from './fixtures/recognisedText';

/**
 * The MRZ is the only field on a document that can be checked rather than
 * trusted, so most of what is asserted here is the check digit doing its job.
 */

const TODAY = '2026-09-20';

describe('mrzCheckDigit', () => {
  it('weights characters 7-3-1 and sums modulo 10', () => {
    // The ICAO 9303 worked example: document number D23145890, check digit 7.
    expect(mrzCheckDigit('D23145890')).toBe(7);
  });

  it('treats the filler as zero', () => {
    expect(mrzCheckDigit('<<<<<<')).toBe(0);
  });

  it('values letters as their alphabet position plus nine', () => {
    expect(mrzCheckDigit('A')).toBe(0);
    expect(mrzCheckDigit('Z')).toBe(5);
  });

  it('refuses a character outside the MRZ alphabet rather than skipping it', () => {
    // -1 can never equal a digit, so the field fails its check instead of
    // quietly producing a plausible sum from the remaining characters.
    expect(mrzCheckDigit('12-456')).toBe(-1);
  });
});

describe('mrzDate', () => {
  it('reads YYMMDD', () => {
    expect(mrzDate('301028', TODAY)).toBe('2030-10-28');
  });

  it('places a past two-digit year in the previous century', () => {
    expect(mrzDate('850101', TODAY)).toBe('1985-01-01');
  });

  it('rejects a date that is not on the calendar', () => {
    expect(mrzDate('270230', TODAY)).toBeNull();
    expect(mrzDate('999999', TODAY)).toBeNull();
  });

  it('rejects anything that is not six digits', () => {
    expect(mrzDate('3O1028', TODAY)).toBeNull();
    expect(mrzDate('30102', TODAY)).toBeNull();
  });
});

describe('parseMrz', () => {
  it('reads a TD3 passport, verifying every field', () => {
    const result = parseMrz(UK_PASSPORT, TODAY);

    expect(result).not.toBeNull();
    expect(result?.type).toBe('TD3');
    expect(result?.documentNumber).toBe('P4920191');
    expect(result?.expiryDate).toBe('2030-10-28');
    expect(result?.dateOfBirth).toBe('1985-01-01');
    expect(result?.issuingCountry).toBe('GB');
    expect(result?.verified).toEqual({
      documentNumber: true,
      dateOfBirth: true,
      expiryDate: true,
    });
  });

  it('reads a TD1 identity card', () => {
    const result = parseMrz(GERMAN_ID, TODAY);

    expect(result?.type).toBe('TD1');
    expect(result?.documentNumber).toBe('T22000129');
    expect(result?.expiryDate).toBe('2027-10-31');
    expect(result?.issuingCountry).toBe('DE');
    expect(result?.verified.expiryDate).toBe(true);
  });

  it('reads a TD2 residence permit', () => {
    const result = parseMrz(FRENCH_PERMIT, TODAY);

    expect(result?.type).toBe('TD2');
    expect(result?.documentNumber).toBe('D23145890');
    expect(result?.expiryDate).toBe('2029-05-12');
    expect(result?.issuingCountry).toBe('FR');
    expect(result?.verified.expiryDate).toBe(true);
  });

  it('keeps a misread field but fails its check digit', () => {
    const result = parseMrz(UK_PASSPORT_MISREAD, TODAY);

    // `3O1028` is not six digits, so no date is produced — and the check digit
    // fails too. Either alone would be enough to stop it being trusted.
    expect(result?.expiryDate).toBeNull();
    expect(result?.verified.expiryDate).toBe(false);
    // The rest of the zone is intact and still usable.
    expect(result?.documentNumber).toBe('P4920191');
    expect(result?.verified.documentNumber).toBe(true);
  });

  it('reports an unmapped issuing authority as null, keeping the alpha-3', () => {
    // UTO is ICAO's specimen "Utopia" code and has no ISO alpha-2. Returning
    // null keeps `CHECK (country GLOB '[A-Z][A-Z]')` satisfiable.
    const specimen = [
      'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
      'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
    ].join('\n');

    const result = parseMrz(specimen, TODAY);

    expect(result?.issuingCountry).toBeNull();
    expect(result?.issuingCountryAlpha3).toBe('UTO');
  });

  it('finds the zone among the printed text around it', () => {
    // The fixture has ten lines of printed fields before the MRZ.
    expect(parseMrz(UK_PASSPORT, TODAY)?.lines).toHaveLength(2);
  });

  it('tolerates spaces the recognition inserted into the zone', () => {
    const spaced = UK_PASSPORT.replace('P4920191<7GBR', 'P4920191<7 GBR');

    expect(parseMrz(spaced, TODAY)?.expiryDate).toBe('2030-10-28');
  });

  it('returns null for a document with no zone', () => {
    expect(parseMrz(US_INSURANCE_CARD, TODAY)).toBeNull();
    expect(parseMrz(NO_DATE, TODAY)).toBeNull();
    expect(parseMrz('', TODAY)).toBeNull();
  });

  it('returns null when only one line of a passport zone was read', () => {
    const truncated = 'P<GBRSMITH<<JOHN<ROBERT<<<<<<<<<<<<<<<<<<<<<';

    expect(parseMrz(truncated, TODAY)).toBeNull();
  });

  it('ignores a line of the right length that is not MRZ text', () => {
    const decoy = `${'Customer service opening hours ten am!'.slice(0, 44)}\n${'x'.repeat(44)}`;

    expect(parseMrz(decoy, TODAY)).toBeNull();
  });
});
