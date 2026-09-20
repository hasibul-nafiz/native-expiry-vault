import {
  addDays,
  atLocalTime,
  compareDates,
  daysBetween,
  formatIsoDate,
  InvalidDateError,
  isIsoDate,
  maxDate,
  minDate,
  toEpochDay,
  todayLocal,
} from '../dates';

describe('isIsoDate', () => {
  it.each(['1970-01-01', '2026-09-20', '2024-02-29', '2000-02-29', '1900-03-01', '2999-12-31'])(
    'accepts %s',
    (value) => {
      expect(isIsoDate(value)).toBe(true);
    },
  );

  it.each([
    ['a single-digit month', '2026-9-20'],
    ['a single-digit day', '2026-09-2'],
    ['no separators', '20260920'],
    ['a timestamp', '2026-09-20T00:00:00.000Z'],
    ['an empty string', ''],
    ['free text', 'yesterday'],
    ['month 13', '2026-13-01'],
    ['month 00', '2026-00-01'],
    ['day 00', '2026-09-00'],
    ['day 31 of a 30-day month', '2026-09-31'],
    ['30 February', '2026-02-30'],
    ['29 February in a non-leap year', '2023-02-29'],
    ['29 February in a non-leap century', '1900-02-29'],
  ])('rejects %s', (_label, value) => {
    expect(isIsoDate(value)).toBe(false);
  });
});

describe('toEpochDay / formatIsoDate', () => {
  it.each([
    ['1970-01-01', 0],
    ['1970-01-02', 1],
    ['1969-12-31', -1],
    ['2000-01-01', 10957],
  ])('maps %s to epoch day %i', (date, epochDay) => {
    expect(toEpochDay(date)).toBe(epochDay);
    expect(formatIsoDate(epochDay)).toBe(date);
  });

  it('round-trips every day across two leap-cycle boundaries', () => {
    // 1899-12-01 to 1901-01-31 and 2023-12-01 to 2025-01-31 cover a non-leap
    // century, an ordinary year and a leap year.
    for (const start of ['1899-12-01', '2023-12-01']) {
      const from = toEpochDay(start);

      for (let offset = 0; offset < 430; offset += 1) {
        const formatted = formatIsoDate(from + offset);
        expect(isIsoDate(formatted)).toBe(true);
        expect(toEpochDay(formatted)).toBe(from + offset);
      }
    }
  });

  it('throws on an invalid date rather than guessing', () => {
    expect(() => toEpochDay('2026-02-30')).toThrow(InvalidDateError);
    expect(() => toEpochDay('nonsense')).toThrow(/not a valid YYYY-MM-DD date/);
  });
});

describe('daysBetween', () => {
  it.each([
    ['the same day', '2026-09-20', '2026-09-20', 0],
    ['consecutive days', '2026-09-20', '2026-09-21', 1],
    ['a backwards span', '2026-09-21', '2026-09-20', -1],
    ['across a month boundary', '2026-01-31', '2026-02-01', 1],
    ['across a year boundary', '2025-12-31', '2026-01-01', 1],
    ['across 29 February in a leap year', '2024-02-28', '2024-03-01', 2],
    ['across 28 February in a non-leap year', '2023-02-28', '2023-03-01', 1],
    ['a full leap year', '2024-01-01', '2025-01-01', 366],
    ['a full ordinary year', '2023-01-01', '2024-01-01', 365],
  ])('counts %s', (_label, from, to, expected) => {
    expect(daysBetween(from, to)).toBe(expected);
  });

  it('is antisymmetric', () => {
    expect(daysBetween('2026-09-20', '2031-05-14')).toBe(-daysBetween('2031-05-14', '2026-09-20'));
  });
});

describe('timezone independence', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  /**
   * The point of the whole module: the same two calendar dates must be the same
   * number of days apart regardless of where the device is. UTC+14 and UTC-11
   * are the extremes of the inhabited range, 25 hours apart.
   */
  it.each(['UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Asia/Kathmandu'])(
    'computes the same span in %s',
    (timezone) => {
      process.env.TZ = timezone;

      expect(daysBetween('2026-09-20', '2031-05-14')).toBe(1697);
      expect(addDays('2026-09-20', 1)).toBe('2026-09-21');
      expect(toEpochDay('2026-09-20')).toBe(20716);
    },
  );
});

describe('addDays', () => {
  it.each([
    ['2026-09-20', 1, '2026-09-21'],
    ['2026-09-20', -1, '2026-09-19'],
    ['2026-09-20', 0, '2026-09-20'],
    ['2026-01-31', 1, '2026-02-01'],
    ['2024-02-28', 1, '2024-02-29'],
    ['2023-02-28', 1, '2023-03-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2031-05-14', -180, '2030-11-15'],
  ])('adds %i days to %s', (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });
});

describe('comparison helpers', () => {
  it('orders dates', () => {
    expect(compareDates('2026-09-20', '2026-09-21')).toBe(-1);
    expect(compareDates('2026-09-21', '2026-09-20')).toBe(1);
    expect(compareDates('2026-09-20', '2026-09-20')).toBe(0);
  });

  it('sorts correctly when used as a comparator', () => {
    const dates = ['2031-05-14', '2025-10-28', '2026-09-20'];

    expect([...dates].sort(compareDates)).toEqual(['2025-10-28', '2026-09-20', '2031-05-14']);
  });

  it('picks the earlier and later date', () => {
    expect(minDate('2026-09-20', '2025-10-28')).toBe('2025-10-28');
    expect(maxDate('2026-09-20', '2025-10-28')).toBe('2026-09-20');
  });
});

describe('todayLocal', () => {
  it('reads the local calendar date, not the UTC one', () => {
    // 2026-09-20T23:30 local is already the 21st in UTC+2, but the user's
    // calendar still says the 20th.
    const localEvening = new Date(2026, 8, 20, 23, 30, 0);

    expect(todayLocal(localEvening)).toBe('2026-09-20');
  });

  it('pads single-digit months and days', () => {
    expect(todayLocal(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05');
  });

  it('returns a value the rest of the module accepts', () => {
    expect(isIsoDate(todayLocal())).toBe(true);
  });
});

/**
 * These rely on the suite's pinned timezone (`America/New_York`, set in
 * `jest.config.js`). It is DST-observing and not UTC, which is what makes the
 * transitions below real.
 */
describe('atLocalTime', () => {
  it('builds the requested wall-clock time', () => {
    expect(atLocalTime('2026-09-20', 9)).toEqual(new Date(2026, 8, 20, 9, 0, 0, 0));
    expect(atLocalTime('2026-09-20', 18, 30)).toEqual(new Date(2026, 8, 20, 18, 30, 0, 0));
  });

  it('defaults to the top of the hour', () => {
    expect(atLocalTime('2026-09-20', 9)).toEqual(atLocalTime('2026-09-20', 9, 0));
  });

  /**
   * The reason the function exists. Deriving the instant arithmetically — a UTC
   * midnight plus nine hours — drifts by the offset and by an extra hour across
   * a transition. These assert the wall clock is what survives.
   */
  describe('across a DST transition', () => {
    it('keeps 09:00 local on both sides of the spring forward', () => {
      // 2026-03-08 is the US spring forward: the 7th is EST, the 8th is EDT.
      const before = atLocalTime('2026-03-07', 9);
      const after = atLocalTime('2026-03-08', 9);

      expect(before.getHours()).toBe(9);
      expect(after.getHours()).toBe(9);
      expect(before.getTimezoneOffset()).toBe(300);
      expect(after.getTimezoneOffset()).toBe(240);
      // Consecutive 09:00s, but only 23 real hours apart.
      expect(after.getTime() - before.getTime()).toBe(23 * 60 * 60 * 1000);
    });

    it('keeps 09:00 local on both sides of the fall back', () => {
      const before = atLocalTime('2026-10-31', 9);
      const after = atLocalTime('2026-11-01', 9);

      expect(before.getHours()).toBe(9);
      expect(after.getHours()).toBe(9);
      // 25 real hours, the mirror of the spring case.
      expect(after.getTime() - before.getTime()).toBe(25 * 60 * 60 * 1000);
    });

    it('differs from the naive UTC-midnight-plus-hours derivation', () => {
      const correct = atLocalTime('2026-03-08', 9);
      const naive = new Date(Date.UTC(2026, 2, 8) + 9 * 60 * 60 * 1000);

      expect(naive.getHours()).not.toBe(9);
      expect(correct.getTime()).not.toBe(naive.getTime());
    });
  });

  it.each(['2026-01-15', '2026-06-15', '2026-03-08', '2026-11-01', '2024-02-29'])(
    'reads 09:00 on the requested day for %s',
    (date) => {
      const fireAt = atLocalTime(date, 9);

      expect(todayLocal(fireAt)).toBe(date);
      expect(fireAt.getHours()).toBe(9);
      expect(fireAt.getMinutes()).toBe(0);
    },
  );

  it.each([-1, 24, 9.5, Number.NaN])('rejects the invalid hour %p', (hour) => {
    expect(() => atLocalTime('2026-09-20', hour)).toThrow(RangeError);
  });

  it.each([-1, 60, 30.5])('rejects the invalid minute %p', (minute) => {
    expect(() => atLocalTime('2026-09-20', 9, minute)).toThrow(RangeError);
  });

  it('rejects a malformed date', () => {
    expect(() => atLocalTime('20-09-2026', 9)).toThrow(InvalidDateError);
  });
});
