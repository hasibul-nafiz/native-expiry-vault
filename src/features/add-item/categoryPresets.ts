import { documentCategories, type DocumentCategory } from '@/db/models';
import type { IconName } from '@/components';

/**
 * The six category cards from the add-item flow, plus the reminder offsets each
 * one pre-selects.
 *
 * The export ties a category to a reminder preset **only through subtitle
 * prose** — there is no data attribute, no value, and `selectCategory()` never
 * records the choice anywhere. So the offsets below are derived from that copy
 * and are the one invented mapping in this feature:
 *
 * - `6-mo airline rule` -> six months out, because many countries refuse entry
 *   on a passport with under six months validity.
 * - `Schengen / Status` and `IDP & Local` -> three months, the usual consulate
 *   and licence renewal lead time.
 * - `Global coverage` -> two months, matching the dashboard's own 60-day
 *   "Review" band.
 * - `Hardware claims` -> one month; a warranty claim needs little lead time.
 * - `Apartment / Rent` -> three months, the common notice period on a lease.
 */

export interface CategoryPreset {
  category: DocumentCategory;
  /** Verbatim from the export. */
  title: string;
  /** Verbatim from the export. */
  subtitle: string;
  icon: IconName;
  /** Days before expiry, longest first. */
  offsets: readonly number[];
}

export const categoryPresets: readonly CategoryPreset[] = [
  {
    category: 'passport',
    title: 'Passport / ID',
    subtitle: '6-mo airline rule',
    icon: 'passport',
    offsets: [180, 90, 30, 7],
  },
  {
    category: 'visa',
    title: 'Visa & Permit',
    subtitle: 'Schengen / Status',
    icon: 'visa',
    offsets: [90, 30, 7],
  },
  {
    category: 'health',
    title: 'Health & Travel',
    subtitle: 'Global coverage',
    icon: 'health',
    offsets: [60, 30, 7],
  },
  {
    category: 'license',
    title: "Driver's License",
    subtitle: 'IDP & Local',
    icon: 'licence',
    offsets: [90, 30, 7],
  },
  {
    category: 'warranty',
    title: 'Warranty / Tech',
    subtitle: 'Hardware claims',
    icon: 'warranty',
    offsets: [30, 7],
  },
  {
    category: 'contract',
    title: 'Lease & Contract',
    subtitle: 'Apartment / Rent',
    icon: 'identity',
    offsets: [90, 60, 30],
  },
  {
    /**
     * Not in the export, which offers only six cards — but the schema allows a
     * seventh category, and a document that fits none of the six needs a home.
     */
    category: 'other',
    title: 'Other',
    subtitle: 'Anything else',
    icon: 'document',
    offsets: [30, 7],
  },
];

const byCategory = new Map(categoryPresets.map((preset) => [preset.category, preset]));

export function presetFor(category: DocumentCategory): CategoryPreset {
  const preset = byCategory.get(category);

  if (preset === undefined) {
    throw new Error(`No preset defined for category "${category}".`);
  }

  return preset;
}

export function defaultOffsetsFor(category: DocumentCategory): readonly number[] {
  return presetFor(category).offsets;
}

/** Every category in the schema has a preset; asserted in the tests. */
export const coveredCategories: readonly DocumentCategory[] = documentCategories;
