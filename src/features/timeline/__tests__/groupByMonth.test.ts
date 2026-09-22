import type { Item } from '@/db/models';
import { addDays, InvalidDateError } from '@/features/expiry';

import { groupByMonth } from '../groupByMonth';

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

describe('groupByMonth', () => {
  it('returns nothing for an empty vault', () => {
    expect(groupByMonth([], TODAY)).toEqual([]);
  });

  it('groups items expiring in the same month together', () => {
    const groups = groupByMonth(
      [item({ id: 'a', expiryDate: '2026-10-03' }), item({ id: 'b', expiryDate: '2026-10-28' })],
      TODAY,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: '2026-10', year: 2026, month: 10 });
    expect(groups[0].items.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('separates the same month in different years', () => {
    const groups = groupByMonth(
      [
        item({ id: 'later', expiryDate: '2027-10-03' }),
        item({ id: 'sooner', expiryDate: '2026-10-03' }),
      ],
      TODAY,
    );

    expect(groups.map((group) => group.key)).toEqual(['2026-10', '2027-10']);
  });

  it('orders months ascending across a year boundary', () => {
    const groups = groupByMonth(
      [
        item({ id: 'jan', expiryDate: '2027-01-15' }),
        item({ id: 'dec', expiryDate: '2026-12-15' }),
        item({ id: 'feb', expiryDate: '2027-02-15' }),
      ],
      TODAY,
    );

    expect(groups.map((group) => group.key)).toEqual(['2026-12', '2027-01', '2027-02']);
  });

  it('puts already-expired months first, in their own month', () => {
    const groups = groupByMonth(
      [
        item({ id: 'future', expiryDate: inDays(40) }),
        item({ id: 'lapsed', expiryDate: '2026-08-11' }),
      ],
      TODAY,
    );

    expect(groups[0]).toMatchObject({ key: '2026-08', band: 'critical' });
    expect(groups[0].items.map((entry) => entry.id)).toEqual(['lapsed']);
  });

  it('sorts items inside a month by expiry date', () => {
    const groups = groupByMonth(
      [
        item({ id: 'late', expiryDate: '2026-11-29' }),
        item({ id: 'early', expiryDate: '2026-11-02' }),
        item({ id: 'middle', expiryDate: '2026-11-14' }),
      ],
      TODAY,
    );

    expect(groups[0].items.map((entry) => entry.id)).toEqual(['early', 'middle', 'late']);
  });

  it('breaks a same-day tie by title so the order is stable', () => {
    const groups = groupByMonth(
      [
        item({ id: 'v', title: 'Visa', expiryDate: '2026-11-02' }),
        item({ id: 'a', title: 'AppleCare', expiryDate: '2026-11-02' }),
      ],
      TODAY,
    );

    expect(groups[0].items.map((entry) => entry.title)).toEqual(['AppleCare', 'Visa']);
  });

  it('does not mutate the array it is given', () => {
    const items = [
      item({ id: 'late', expiryDate: '2026-11-29' }),
      item({ id: 'early', expiryDate: '2026-11-02' }),
    ];

    groupByMonth(items, TODAY);

    expect(items.map((entry) => entry.id)).toEqual(['late', 'early']);
  });

  describe('minDaysRemaining', () => {
    it('takes the most urgent item in the month', () => {
      const groups = groupByMonth(
        [
          item({ id: 'later', expiryDate: inDays(50) }),
          item({ id: 'sooner', expiryDate: inDays(35) }),
        ],
        TODAY,
      );

      expect(groups[0].minDaysRemaining).toBe(35);
    });

    it('is negative when anything in the month has lapsed', () => {
      const groups = groupByMonth([item({ expiryDate: inDays(-5) })], TODAY);

      expect(groups[0].minDaysRemaining).toBe(-5);
    });

    /**
     * A month holding both a lapsed and a comfortable document is a critical
     * month — the worst item sets the tone, which is how the export draws its
     * OCT 2025 group.
     */
    it('lets one lapsed document make the whole month critical', () => {
      const groups = groupByMonth(
        [
          item({ id: 'lapsed', expiryDate: '2026-09-08' }),
          item({ id: 'fine', expiryDate: '2026-09-30' }),
        ],
        TODAY,
      );

      expect(groups[0].band).toBe('critical');
    });
  });

  it('bands each month independently', () => {
    const groups = groupByMonth(
      [
        item({ id: 'a', expiryDate: inDays(-2) }),
        item({ id: 'b', expiryDate: inDays(30) }),
        item({ id: 'c', expiryDate: inDays(200) }),
        item({ id: 'd', expiryDate: inDays(500) }),
        item({ id: 'e', expiryDate: inDays(1500) }),
      ],
      TODAY,
    );

    expect(groups.map((group) => group.band)).toEqual([
      'critical',
      'action',
      'review',
      'safeWindow',
      'secure',
    ]);
  });

  it('rejects an unparseable expiry date rather than forming a dead group', () => {
    expect(() => groupByMonth([item({ expiryDate: '2026-02-30' })], TODAY)).toThrow(
      InvalidDateError,
    );
  });
});
