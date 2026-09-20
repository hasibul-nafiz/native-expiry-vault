import { z } from 'zod';

import { documentCategories } from '@/db/models';
import { compareDates, isIsoDate } from '@/features/expiry';

/**
 * Validation for the add-item form.
 *
 * Every rule here **mirrors a CHECK constraint in migration 001** rather than
 * inventing a parallel set. The point is that anything the form accepts, SQLite
 * also accepts — a mismatch would surface as an unexplained `DatabaseError` at
 * save time instead of an inline field error.
 *
 * Date validity in particular goes through `isIsoDate`, the same
 * proleptic-Gregorian round-trip the `date(col) IS col` constraint performs, so
 * 2026-02-30 and 2023-02-29 are rejected here exactly as they are by the schema.
 *
 * The export has no `<form>`, no `required`, and no validation of any kind, so
 * all of this is designed rather than ported.
 */

/** Matches `CHECK (length(trim(title)) > 0)`; the cap is a UI decision. */
export const TITLE_MAX_LENGTH = 120;
export const ISSUER_MAX_LENGTH = 120;
export const DOCUMENT_NUMBER_MAX_LENGTH = 64;
export const NOTE_MAX_LENGTH = 2000;

const isoDateField = z
  .string()
  .refine((value) => isIsoDate(value), { message: 'Enter a valid date.' });

/** Trimmed, and empty strings become undefined so blank optionals stay null. */
function optionalText(maxLength: number, tooLong: string) {
  return z
    .string()
    .trim()
    .max(maxLength, tooLong)
    .transform((value) => (value === '' ? undefined : value))
    .optional();
}

export const addItemSchema = z
  .object({
    category: z.enum(documentCategories),

    title: z
      .string()
      .trim()
      .min(1, 'Give the document a name.')
      .max(TITLE_MAX_LENGTH, `Keep the name under ${TITLE_MAX_LENGTH} characters.`),

    issuer: optionalText(
      ISSUER_MAX_LENGTH,
      `Keep the issuer under ${ISSUER_MAX_LENGTH} characters.`,
    ),

    documentNumber: optionalText(
      DOCUMENT_NUMBER_MAX_LENGTH,
      `Keep the number under ${DOCUMENT_NUMBER_MAX_LENGTH} characters.`,
    ),

    // Mirrors `CHECK (country GLOB '[A-Z][A-Z]')`.
    country: z
      .string()
      .trim()
      .transform((value) => (value === '' ? undefined : value.toUpperCase()))
      .optional()
      .refine((value) => value === undefined || /^[A-Z]{2}$/.test(value), {
        message: 'Use a two-letter country code, such as DE.',
      }),

    issueDate: isoDateField.optional(),

    expiryDate: isoDateField,

    /** Days before expiry. Empty is allowed — a user may want no reminders. */
    reminderOffsets: z
      .array(z.number().int().nonnegative())
      .max(10, 'That is more reminders than this document needs.'),

    escalationEnabled: z.boolean(),

    attachments: z.array(
      z.object({
        uri: z.string().min(1),
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
        byteSize: z.number().int().nonnegative(),
      }),
    ),

    /**
     * Set only when the expiry date came from a scan (F8), and written to
     * `items.ocr_raw_text` / `items.ocr_confidence`.
     *
     * Part of the form rather than separate state so that stepping backwards
     * through the wizard does not lose it. `confidence` is the date parser's
     * own ranking: ML Kit reports no confidence of any kind.
     */
    ocr: z
      .object({
        rawText: z.string(),
        confidence: z.number().min(0).max(1),
      })
      .optional(),
  })
  // Mirrors `CHECK (issue_date IS NULL OR issue_date <= expiry_date)`.
  .refine(
    (value) =>
      value.issueDate === undefined || compareDates(value.issueDate, value.expiryDate) <= 0,
    { message: 'The issue date cannot be after the expiry date.', path: ['issueDate'] },
  );

export type AddItemFormValues = z.input<typeof addItemSchema>;
export type AddItemValues = z.output<typeof addItemSchema>;
export type PickedAttachment = AddItemValues['attachments'][number];

/**
 * Which fields each wizard step owns, so advancing can validate just that step.
 * The export gates nothing — `goToStep()` lets you jump straight to the end.
 */
export const stepFields = {
  1: ['category'],
  2: ['attachments'],
  3: ['title', 'issuer', 'documentNumber', 'country', 'issueDate', 'expiryDate'],
  4: ['reminderOffsets', 'escalationEnabled'],
} as const satisfies Record<number, readonly (keyof AddItemFormValues)[]>;

export type StepNumber = keyof typeof stepFields;
export const stepNumbers: readonly StepNumber[] = [1, 2, 3, 4];

/** Verbatim from the export's `stepNames` array. */
export const stepNames: Record<StepNumber, string> = {
  1: 'Category',
  2: 'Capture',
  3: 'Verify',
  4: 'Reminders',
};
