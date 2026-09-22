import { parseDates } from '../parseDates';

import {
  NO_DATE,
  UK_PASSPORT,
  US_INSURANCE_CARD,
  WARRANTY_RECEIPT,
} from './fixtures/recognisedText';

/**
 * The largest suite in F8, because this is where a wrong answer is silent.
 *
 * `today` is passed to every call rather than read from the clock, so the
 * century window and the future-date bonus assert the same thing in 2026 as
 * they will in 2030.
 */

const TODAY = '2026-09-20';

function datesIn(text: string): string[] {
  return parseDates(text, TODAY).map((candidate) => candidate.date);
}

function first(text: string) {
  return parseDates(text, TODAY)[0];
}

describe('parseDates formats', () => {
  it('reads an ISO date', () => {
    expect(first('Valid until 2030-10-28').date).toBe('2030-10-28');
    expect(first('Valid until 2030-10-28').format).toBe('ymd');
  });

  it('reads a day-first numeric date', () => {
    expect(first('Expires 28/10/2030').date).toBe('2030-10-28');
  });

  it('reads a month name after the day', () => {
    expect(first('Date of expiry 28 OCT 2030').date).toBe('2030-10-28');
    expect(first('Date of expiry 28 OCT 2030').format).toBe('month-name');
  });

  it('reads a month name before the day', () => {
    expect(first('Expires October 28, 2030').date).toBe('2030-10-28');
  });

  it('reads an ordinal day', () => {
    expect(first('Expires October 28th, 2030').date).toBe('2030-10-28');
  });

  it('reads the full month name', () => {
    expect(first('Valid until 28 October 2030').date).toBe('2030-10-28');
  });

  it('accepts dots and hyphens as separators', () => {
    expect(first('Gultig bis 31.10.2027').date).toBe('2027-10-31');
    expect(first('Expires 31-10-2027').date).toBe('2027-10-31');
  });
});

describe('parseDates ambiguity', () => {
  it('flags a numeric date that reads two ways, carrying both', () => {
    const candidate = first('Warranty until 04/03/2029');

    expect(candidate.ambiguous).toBe(true);
    expect(candidate.date).toBe('2029-03-04');
    expect(candidate.alternative).toBe('2029-04-03');
  });

  it('does not flag a date only one order can produce', () => {
    // 13 cannot be a month, so 13/04 is unambiguously the 13th of April.
    const candidate = first('Expires 13/04/2028');

    expect(candidate.ambiguous).toBe(false);
    expect(candidate.date).toBe('2028-04-13');
    expect(candidate.alternative).toBeUndefined();
  });

  it('does not flag a month name, which cannot be read two ways', () => {
    expect(first('Expires 04 March 2029').ambiguous).toBe(false);
  });

  it('does not flag an ISO date, whose year leads', () => {
    expect(first('Expires 2029-03-04').ambiguous).toBe(false);
  });

  it('ranks an ambiguous reading below an unambiguous one of the same kind', () => {
    const ambiguous = first('Expires 04/03/2029');
    const clear = first('Expires 13/04/2029');

    expect(ambiguous.score).toBeLessThan(clear.score);
  });

  it('treats a same-day-and-month date as unambiguous', () => {
    // 05/05 reads identically either way, so there is nothing to choose.
    expect(first('Expires 05/05/2029').ambiguous).toBe(false);
  });
});

describe('parseDates two-digit years', () => {
  it('reads a near-future two-digit year as this century', () => {
    expect(first('Expires 28/10/30').date).toBe('2030-10-28');
  });

  it('reads a past two-digit year as the previous century', () => {
    expect(first('Issued 01/06/95').date).toBe('1995-06-01');
  });

  it('places an out-of-window two-digit year in the past, not the future', () => {
    // The window is 80 years back and 20 forward, so '60' is 1960 rather than
    // 2060. No document this app tracks expires thirty-four years out.
    expect(first('Expires 28/10/60').date).toBe('1960-10-28');
  });
});

describe('parseDates validity', () => {
  it('drops a date that is not on the calendar', () => {
    expect(datesIn('Expires 2027-02-30')).toEqual([]);
    // Neither order works: April has no 31st, and there is no 31st month.
    expect(datesIn('Expires 31/04/2027')).toEqual([]);
  });

  it('drops an impossible month name day', () => {
    expect(datesIn('Expires 31 February 2027')).toEqual([]);
  });

  it('returns nothing rather than throwing for text with no date', () => {
    expect(parseDates(NO_DATE, TODAY)).toEqual([]);
    expect(parseDates('', TODAY)).toEqual([]);
    expect(parseDates('%%%% ???? ////', TODAY)).toEqual([]);
  });
});

describe('parseDates ranking', () => {
  it('puts a labelled date above an unlabelled one', () => {
    const text = 'Printed 01/02/2029\nDate of expiry 03/04/2030';

    expect(first(text).date).toBe('2030-04-03');
  });

  it('pushes an issue date below an expiry date', () => {
    const text = 'Date of issue 28 OCT 2020\nDate of expiry 28 OCT 2030';
    const [best] = parseDates(text, TODAY);

    expect(best.date).toBe('2030-10-28');
  });

  it('pushes a date of birth down even though it is unambiguous', () => {
    const text = 'Date of birth 01 JAN 1985\nExpires 28 OCT 2030';
    const birth = parseDates(text, TODAY).find((c) => c.date === '1985-01-01');
    const expiry = parseDates(text, TODAY).find((c) => c.date === '2030-10-28');

    expect(birth?.score).toBeLessThan(expiry?.score ?? 0);
  });

  it('prefers a month-name reading to a bare numeric one', () => {
    const named = first('28 OCT 2030');
    const numeric = first('28/10/2030');

    expect(named.score).toBeGreaterThan(numeric.score);
  });

  it('collapses a date found by two patterns into one candidate', () => {
    const candidates = parseDates('Expires 2030-10-28', TODAY);

    expect(candidates.filter((c) => c.date === '2030-10-28')).toHaveLength(1);
  });

  it('orders identical scores by date, so the same text always ranks the same', () => {
    const text = '28/10/2030 and 14/05/2030';
    const dates = datesIn(text);

    expect(dates).toEqual([...dates].sort());
  });

  it('keeps every score inside 0 to 1', () => {
    for (const candidate of parseDates(UK_PASSPORT, TODAY)) {
      expect(candidate.score).toBeGreaterThanOrEqual(0);
      expect(candidate.score).toBeLessThanOrEqual(1);
    }
  });

  it('reports the substring each candidate came from', () => {
    expect(first('Date of expiry 28 OCT 2030').source).toContain('28 OCT 2030');
  });
});

describe('parseDates against fixtures', () => {
  it('picks the expiry off a passport photo page', () => {
    expect(first(UK_PASSPORT).date).toBe('2030-10-28');
  });

  it('picks the expiry off a US insurance card, month first', () => {
    // 09/30/2027 can only be month-first: 30 is not a month.
    const candidate = first(US_INSURANCE_CARD);

    expect(candidate.date).toBe('2027-09-30');
    expect(candidate.ambiguous).toBe(false);
  });

  it('flags the warranty receipt, whose dates genuinely read two ways', () => {
    const candidate = first(WARRANTY_RECEIPT);

    expect(candidate.ambiguous).toBe(true);
    expect(candidate.date).toBe('2029-03-04');
    expect(candidate.alternative).toBe('2029-04-03');
  });
});
