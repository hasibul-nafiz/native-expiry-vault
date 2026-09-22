import type { Item } from '@/db/models';
import { addDays } from '@/features/expiry';

import { countsByRange, filterByRange, isInRange, NEXT_RANGE_DAYS } from '../filters';

const TODAY = '2026-09-20';

function inDays(days: number): string {
  return addDays(TODAY, days);
}

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 'id-1',
    title: 'Passport',
    category: 'passport',
    issuer: null,
    documentNumber: null,
    country: null,
    issueDate: null,
    expiryDate: '2031-05-14',
    renewedAt: null,
    isVital: false,
    escalationEnabled: true,
    ocrConfidence: null,
    ocrRawText: null,
    archivedAt: null,
    createdAt: '2026-09-20T09:00:00.000Z',
    updatedAt: '2026-09-20T09:00:00.000Z',
    ...overrides,
  };
}

describe('isInRange', () => {
  it('accepts everything for the All chip', () => {
    expect(isInRange(inDays(-500), TODAY, 'all')).toBe(true);
    expect(isInRange(inDays(5000), TODAY, 'all')).toBe(true);
  });

  describe('next30', () => {
    it.each([
      ['the boundary day', NEXT_RANGE_DAYS, true],
      ['the day past it', NEXT_RANGE_DAYS + 1, false],
      ['today', 0, true],
    ] as const)('includes %s: %s', (_label, days, expected) => {
      expect(isInRange(inDays(days), TODAY, 'next30')).toBe(expected);
    });

    it('includes overdue items, which are the most urgent thing it can show', () => {
      expect(isInRange(inDays(-12), TODAY, 'next30')).toBe(true);
    });
  });

  describe('thisYear', () => {
    it('matches on calendar year, not a rolling window', () => {
      expect(isInRange('2026-12-31', TODAY, 'thisYear')).toBe(true);
      expect(isInRange('2027-01-01', TODAY, 'thisYear')).toBe(false);
    });

    it('includes a date earlier this year that has already lapsed', () => {
      expect(isInRange('2026-01-05', TODAY, 'thisYear')).toBe(true);
    });
  });

  describe('later', () => {
    it('starts at next January', () => {
      expect(isInRange('2026-12-31', TODAY, 'later')).toBe(false);
      expect(isInRange('2027-01-01', TODAY, 'later')).toBe(true);
    });

    it('excludes years already past', () => {
      expect(isInRange('2025-06-01', TODAY, 'later')).toBe(false);
    });
  });

  it('splits every item into exactly one of thisYear or later, or neither', () => {
    // The two chips must never both claim the same item.
    for (const date of ['2025-01-01', '2026-09-20', '2026-12-31', '2027-01-01']) {
      const matches = [isInRange(date, TODAY, 'thisYear'), isInRange(date, TODAY, 'later')].filter(
        Boolean,
      );

      expect(matches.length).toBeLessThanOrEqual(1);
    }
  });
});

describe('filterByRange', () => {
  const items = [
    item({ id: 'lapsed', expiryDate: '2026-03-01' }),
    item({ id: 'urgent', expiryDate: inDays(10) }),
    item({ id: 'thisYear', expiryDate: '2026-12-20' }),
    item({ id: 'nextYear', expiryDate: '2027-04-01' }),
  ];

  it.each([
    ['all', ['lapsed', 'urgent', 'thisYear', 'nextYear']],
    ['next30', ['lapsed', 'urgent']],
    ['thisYear', ['lapsed', 'urgent', 'thisYear']],
    ['later', ['nextYear']],
  ] as const)('%s selects the right items', (range, expected) => {
    expect(filterByRange(items, TODAY, range).map((entry) => entry.id)).toEqual(expected);
  });

  it('preserves the order it was given', () => {
    const reversed = [...items].reverse();

    expect(filterByRange(reversed, TODAY, 'all').map((entry) => entry.id)).toEqual(
      reversed.map((entry) => entry.id),
    );
  });
});

describe('countsByRange', () => {
  it('counts each chip over the same list the feed renders', () => {
    const items = [
      item({ id: 'lapsed', expiryDate: '2026-03-01' }),
      item({ id: 'urgent', expiryDate: inDays(10) }),
      item({ id: 'thisYear', expiryDate: '2026-12-20' }),
      item({ id: 'nextYear', expiryDate: '2027-04-01' }),
    ];

    expect(countsByRange(items, TODAY)).toEqual({
      all: 4,
      next30: 2,
      thisYear: 3,
      later: 1,
    });
  });

  it('is all zeroes for an empty vault', () => {
    expect(countsByRange([], TODAY)).toEqual({ all: 0, next30: 0, thisYear: 0, later: 0 });
  });

  it('agrees with filterByRange for every chip', () => {
    const items = [
      item({ id: 'a', expiryDate: inDays(-3) }),
      item({ id: 'b', expiryDate: inDays(15) }),
      item({ id: 'c', expiryDate: inDays(400) }),
    ];
    const counts = countsByRange(items, TODAY);

    for (const range of ['all', 'next30', 'thisYear', 'later'] as const) {
      expect(counts[range]).toBe(filterByRange(items, TODAY, range).length);
    }
  });
});
