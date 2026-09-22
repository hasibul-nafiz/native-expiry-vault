import { documentCategories } from '@/db/models';

import { addItemSchema, stepFields, stepNumbers, TITLE_MAX_LENGTH } from '../schema';

/**
 * These rules exist to mirror migration 001's CHECK constraints, so the pairing
 * is asserted explicitly: anything the schema accepts, SQLite must also accept.
 */

function values(overrides: Record<string, unknown> = {}) {
  return {
    category: 'passport',
    title: 'US Passport',
    expiryDate: '2031-05-14',
    reminderOffsets: [180, 30],
    escalationEnabled: true,
    attachments: [],
    ...overrides,
  };
}

function errorFor(input: Record<string, unknown>, path: string): string | undefined {
  const result = addItemSchema.safeParse(input);

  if (result.success) {
    return undefined;
  }

  return result.error.issues.find((issue) => issue.path.join('.') === path)?.message;
}

describe('a valid document', () => {
  it('accepts the minimum fields', () => {
    expect(addItemSchema.safeParse(values()).success).toBe(true);
  });

  it('accepts every optional field', () => {
    const result = addItemSchema.safeParse(
      values({
        issuer: 'Dept of State',
        documentNumber: 'P492019',
        country: 'US',
        issueDate: '2021-05-14',
      }),
    );

    expect(result.success).toBe(true);
  });

  it('trims text and drops blank optionals', () => {
    const result = addItemSchema.parse(values({ title: '  US Passport  ', issuer: '   ' }));

    expect(result.title).toBe('US Passport');
    expect(result.issuer).toBeUndefined();
  });

  it('uppercases the country code', () => {
    expect(addItemSchema.parse(values({ country: 'de' })).country).toBe('DE');
  });
});

describe('title', () => {
  it.each([
    ['empty', ''],
    ['whitespace only', '     '],
  ])('rejects a %s title, like the length(trim()) constraint', (_label, title) => {
    expect(errorFor(values({ title }), 'title')).toBe('Give the document a name.');
  });

  it('accepts exactly the maximum length', () => {
    expect(addItemSchema.safeParse(values({ title: 'a'.repeat(TITLE_MAX_LENGTH) })).success).toBe(
      true,
    );
  });

  it('rejects one character over', () => {
    expect(errorFor(values({ title: 'a'.repeat(TITLE_MAX_LENGTH + 1) }), 'title')).toMatch(
      /under 120 characters/,
    );
  });
});

describe('category', () => {
  it.each(documentCategories)('accepts %s', (category) => {
    expect(addItemSchema.safeParse(values({ category })).success).toBe(true);
  });

  it('rejects anything outside the constrained set', () => {
    expect(errorFor(values({ category: 'spaceship' }), 'category')).toBeDefined();
  });
});

describe('dates', () => {
  it.each(['2026-09-20', '2024-02-29', '1900-01-01'])('accepts the real date %s', (expiryDate) => {
    expect(addItemSchema.safeParse(values({ expiryDate })).success).toBe(true);
  });

  it.each([
    ['30 February', '2026-02-30'],
    ['29 February in a non-leap year', '2023-02-29'],
    ['month 13', '2026-13-01'],
    ['a single-digit month', '2026-9-01'],
    ['a timestamp', '2026-09-20T00:00:00.000Z'],
    ['free text', 'next year'],
    ['empty', ''],
  ])('rejects %s, like the date CHECK', (_label, expiryDate) => {
    expect(errorFor(values({ expiryDate }), 'expiryDate')).toBe('Enter a valid date.');
  });

  it('requires an expiry date', () => {
    const input = values();
    delete (input as Record<string, unknown>).expiryDate;

    expect(addItemSchema.safeParse(input).success).toBe(false);
  });

  it('allows a past expiry date rather than treating it as an error', () => {
    // Users legitimately add already-lapsed documents; the dashboard has an
    // Expired band for exactly this.
    expect(addItemSchema.safeParse(values({ expiryDate: '2020-01-01' })).success).toBe(true);
  });

  it('rejects an issue date after the expiry date, like the cross-column CHECK', () => {
    expect(
      errorFor(values({ issueDate: '2031-05-15', expiryDate: '2031-05-14' }), 'issueDate'),
    ).toBe('The issue date cannot be after the expiry date.');
  });

  it('allows an issue date equal to the expiry date', () => {
    expect(
      addItemSchema.safeParse(values({ issueDate: '2031-05-14', expiryDate: '2031-05-14' }))
        .success,
    ).toBe(true);
  });
});

describe('country', () => {
  it.each(['de', 'DE', 'us'])('accepts the two-letter code %s', (country) => {
    expect(addItemSchema.safeParse(values({ country })).success).toBe(true);
  });

  it.each([
    ['three letters', 'DEU'],
    ['one letter', 'D'],
    ['digits', '12'],
  ])('rejects %s, like the country GLOB', (_label, country) => {
    expect(errorFor(values({ country }), 'country')).toMatch(/two-letter country code/);
  });

  it('treats an empty country as absent', () => {
    expect(addItemSchema.parse(values({ country: '' })).country).toBeUndefined();
  });
});

describe('reminders', () => {
  it('accepts no reminders at all', () => {
    expect(addItemSchema.safeParse(values({ reminderOffsets: [] })).success).toBe(true);
  });

  it.each([
    ['a negative offset', [-1]],
    ['a fractional offset', [1.5]],
  ])('rejects %s, like the offset_days CHECK', (_label, reminderOffsets) => {
    expect(addItemSchema.safeParse(values({ reminderOffsets })).success).toBe(false);
  });
});

describe('step field mapping', () => {
  it('covers all four steps', () => {
    expect(stepNumbers).toEqual([1, 2, 3, 4]);
    expect(Object.keys(stepFields)).toHaveLength(4);
  });

  it('assigns every validated field to exactly one step', () => {
    const assigned = stepNumbers.flatMap((step) => [...stepFields[step]]);

    expect(new Set(assigned).size).toBe(assigned.length);
    expect(assigned).toContain('category');
    expect(assigned).toContain('expiryDate');
  });
});
