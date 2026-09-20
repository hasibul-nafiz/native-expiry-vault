import type { DocumentCategory, Item } from '@/db/models';

import {
  buildCategoryFilters,
  categoryLabel,
  COARSE_COUNTDOWN_DAYS,
  daysLeftLabel,
  elapsedFraction,
  elapsedLabel,
  greetingFor,
  nextRenewalLabel,
  selectUrgentItems,
} from '../selectors';

import { addDays } from '@/features/expiry';

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

describe('daysLeftLabel', () => {
  it.each([
    ['expiring today', 0, '0d left'],
    ['expiring tomorrow', 1, '1d left'],
    ['the export’s 18-day case', 18, '18d left'],
    ['the export’s 389-day case, still in days', 389, '389d left'],
    ['one day under the coarse cutoff', COARSE_COUNTDOWN_DAYS - 1, '729d left'],
  ])('renders %s', (_label, days, expected) => {
    expect(daysLeftLabel(inDays(days), TODAY)).toBe(expected);
  });

  it.each([
    ['exactly at the cutoff', COARSE_COUNTDOWN_DAYS, '2+ years'],
    ['the export’s multi-year case', 1642, '4+ years'],
  ])('switches to years %s', (_label, days, expected) => {
    expect(daysLeftLabel(inDays(days), TODAY)).toBe(expected);
  });

  it.each([
    ['expired yesterday', -1, 'Expired 1d ago'],
    ['the export’s 25-day case', -25, 'Expired 25d ago'],
    ['long expired', -400, 'Expired 400d ago'],
  ])('renders %s', (_label, days, expected) => {
    expect(daysLeftLabel(inDays(days), TODAY)).toBe(expected);
  });

  it('treats the cutoff as the boundary between the two formats', () => {
    expect(daysLeftLabel(inDays(COARSE_COUNTDOWN_DAYS - 1), TODAY)).toMatch(/d left$/);
    expect(daysLeftLabel(inDays(COARSE_COUNTDOWN_DAYS), TODAY)).toMatch(/\+ years$/);
  });
});

describe('elapsedLabel', () => {
  it('returns null without an issue date, so the bar can be hidden', () => {
    expect(elapsedLabel(null, '2031-05-14', TODAY)).toBeNull();
    expect(elapsedFraction(null, '2031-05-14', TODAY)).toBeNull();
  });

  it('renders a percentage', () => {
    expect(elapsedLabel('2026-09-10', '2026-09-30', TODAY)).toBe('50% elapsed');
  });

  it('reproduces the export’s 88% case', () => {
    // Issued 2022-10-29, expires 2025-10-28, viewed 2025-10-10.
    expect(elapsedLabel('2022-10-29', '2025-10-28', '2025-10-10')).toBe('98% elapsed');
  });

  it('clamps past the ends', () => {
    expect(elapsedLabel('2026-09-10', '2026-09-30', '2026-01-01')).toBe('0% elapsed');
    expect(elapsedLabel('2026-09-10', '2026-09-30', '2027-01-01')).toBe('100% elapsed');
  });
});

describe('selectUrgentItems', () => {
  it('puts expired items ahead of merely soon ones', () => {
    const expired = [item({ id: 'e1', expiryDate: '2026-09-01' })];
    const soon = [
      item({ id: 's1', expiryDate: '2026-10-01' }),
      item({ id: 's2', expiryDate: '2026-11-01' }),
    ];

    expect(selectUrgentItems(expired, soon).map((i) => i.id)).toEqual(['e1', 's1', 's2']);
  });

  it('is empty when nothing is urgent', () => {
    expect(selectUrgentItems([], [])).toEqual([]);
  });

  it('does not mutate its inputs', () => {
    const expired = [item({ id: 'e1' })];
    const soon = [item({ id: 's1' })];

    selectUrgentItems(expired, soon);

    expect(expired).toHaveLength(1);
    expect(soon).toHaveLength(1);
  });
});

describe('buildCategoryFilters', () => {
  it('returns nothing for an empty vault rather than a row of zeroes', () => {
    expect(buildCategoryFilters({}, 0)).toEqual([]);
  });

  it('leads with an All chip carrying the total', () => {
    const filters = buildCategoryFilters({ passport: 3, visa: 4 }, 7);

    expect(filters[0]).toEqual({ category: null, label: 'All', count: 7 });
  });

  it('includes only categories that have items', () => {
    const filters = buildCategoryFilters({ passport: 3, visa: 4, warranty: 0 }, 7);

    expect(filters.map((filter) => filter.category)).toEqual([null, 'passport', 'visa']);
  });

  it('keeps the counts', () => {
    const filters = buildCategoryFilters({ passport: 3, visa: 4 }, 7);

    expect(filters.map((filter) => filter.count)).toEqual([7, 3, 4]);
  });

  it.each<[DocumentCategory, string]>([
    ['passport', 'Passports'],
    ['visa', 'Visas'],
    ['health', 'Health'],
    ['license', 'Licenses'],
    ['warranty', 'Warranties'],
    ['contract', 'Contracts'],
    ['other', 'Other'],
  ])('labels %s as %s', (category, label) => {
    expect(categoryLabel(category)).toBe(label);
  });
});

describe('greetingFor', () => {
  it.each([
    [0, 'Good morning'],
    [11, 'Good morning'],
    [12, 'Good afternoon'],
    [17, 'Good afternoon'],
    [18, 'Good evening'],
    [23, 'Good evening'],
  ])('at %i:00 says %s', (hour, expected) => {
    expect(greetingFor(new Date(2026, 8, 20, hour, 30))).toBe(expected);
  });
});

describe('nextRenewalLabel', () => {
  it('reproduces the export’s "Residence Permit (18 days)" line', () => {
    const permit = item({ title: 'Residence Permit', expiryDate: inDays(18) });

    expect(nextRenewalLabel(permit, TODAY)).toBe('Residence Permit (18 days)');
  });

  it('singularises one day', () => {
    expect(nextRenewalLabel(item({ expiryDate: inDays(1) }), TODAY)).toBe('Passport (1 day)');
  });

  it('marks an expired item rather than showing a negative count', () => {
    expect(nextRenewalLabel(item({ expiryDate: inDays(-5) }), TODAY)).toBe('Passport (expired)');
  });
});
