import { z } from 'zod';

import { attachmentRoles, documentCategories } from '@/db';
import { compareDates, isIsoDate } from '@/features/expiry';

import { BackupError } from './errors';
import type { BackupPayload } from './types';

/**
 * Validation for an imported payload.
 *
 * Every rule here **mirrors a CHECK constraint in migration 001 or 002**, the
 * same discipline `addItemSchema` follows. The point is that nothing this
 * schema accepts can be rejected later by SQLite: a restore that fails halfway
 * through its transaction on a constraint violation would surface as an
 * unexplained `DatabaseError` after the user had already confirmed a
 * destructive action.
 *
 * It goes further than the table constraints in two places, both because
 * SQLite would otherwise be the thing to notice:
 *
 * - **Referential integrity.** Foreign keys are enforced on the connection, so
 *   an attachment naming an item that is not in the file would abort the
 *   restore mid-transaction rather than being reported as a bad file.
 * - **Uniqueness.** `reminder_rules` has a UNIQUE constraint the row shapes
 *   cannot express, and primary keys are unique by definition only until a
 *   hand-edited file says otherwise.
 *
 * The file is untrusted input. It arrived through a system picker and may have
 * been written by anything at all.
 */

/** Matches `date(col) IS col`: the same proleptic-Gregorian round-trip. */
const isoDate = z.string().refine(isIsoDate, { message: 'Not a calendar date.' });

/**
 * The audit-column format. Only `archived_at` carries this as a CHECK in the
 * schema, but every `*_at` column is written by `nowTimestamp()`, so the same
 * shape is required of all of them rather than letting a malformed one through
 * to a column that happens not to police it.
 */
const isoTimestamp = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'Not an ISO-8601 UTC timestamp.');

/** Matches `CHECK (length(trim(col)) > 0)`. */
const nonBlank = z.string().refine((value) => value.trim().length > 0, {
  message: 'Must not be blank.',
});

/**
 * Compares two dates, treating an already-invalid one as "not this rule's
 * problem".
 *
 * Zod 4 runs an object's refinements even when one of its fields has already
 * failed, so a cross-field rule can be handed a value the field schema just
 * rejected. `compareDates` throws on a malformed date, which would escape
 * validation as an `InvalidDateError` instead of being reported as a bad file.
 * The field-level failure is the accurate message in that case, so this rule
 * stands aside. Found by a test, not by inspection.
 */
function orderedOrUnknown(earlier: string | null, later: string): boolean {
  if (earlier === null || !isIsoDate(earlier) || !isIsoDate(later)) {
    return true;
  }

  return compareDates(earlier, later) <= 0;
}

/** Matches `CHECK (col GLOB '[A-Z][A-Z]')`. */
const countryCode = z.string().regex(/^[A-Z]{2}$/, 'Not an ISO 3166-1 alpha-2 code.');

/** Matches `CHECK (sha256 IS NULL OR sha256 GLOB '[0-9a-f]*')`. */
const lowerHex = z.string().regex(/^[0-9a-f]*$/, 'Not lowercase hex.');

const id = z.string().min(1);

const itemSchema = z
  .object({
    id,
    title: nonBlank,
    category: z.enum(documentCategories),
    issuer: z.string().nullable(),
    documentNumber: z.string().nullable(),
    country: countryCode.nullable(),
    issueDate: isoDate.nullable(),
    expiryDate: isoDate,
    renewedAt: isoDate.nullable(),
    isVital: z.boolean(),
    escalationEnabled: z.boolean(),
    ocrConfidence: z.number().min(0).max(1).nullable(),
    ocrRawText: z.string().nullable(),
    archivedAt: isoTimestamp.nullable(),
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
  })
  // Mirrors `CHECK (issue_date IS NULL OR issue_date <= expiry_date)`.
  .refine((item) => orderedOrUnknown(item.issueDate, item.expiryDate), {
    message: 'Issued after it expires.',
    path: ['issueDate'],
  });

const attachmentSchema = z.object({
  id,
  itemId: id,
  fileUri: nonBlank,
  fileName: nonBlank,
  mimeType: nonBlank,
  byteSize: z.number().int().min(0),
  role: z.enum(attachmentRoles),
  sortOrder: z.number().int(),
  sha256: lowerHex.nullable(),
  createdAt: isoTimestamp,
});

const reminderRuleSchema = z.object({
  id,
  itemId: id,
  offsetDays: z.number().int().min(0),
  enabled: z.boolean(),
  fireDate: isoDate,
  deliveredAt: isoTimestamp.nullable(),
  /**
   * Always null in a backup. A notification id is a handle to an object in the
   * OS scheduler of the device that wrote the file; carrying it to another
   * device would mean storing a cancellation handle for someone else's
   * notification. The scheduler rebuilds from scratch after a restore.
   */
  notificationId: z.null(),
  createdAt: isoTimestamp,
});

const itemNoteSchema = z.object({
  id,
  itemId: id,
  title: nonBlank,
  body: z.string(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
});

const renewalTaskSchema = z.object({
  id,
  itemId: id,
  title: nonBlank,
  detail: z.string().nullable(),
  dueDate: isoDate.nullable(),
  done: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
});

const renewalSchema = z.object({
  id,
  itemId: id,
  previousExpiryDate: isoDate,
  newExpiryDate: isoDate,
  renewedOn: isoDate,
  note: z.string().nullable(),
  createdAt: isoTimestamp,
});

const tagSchema = z.object({
  id,
  label: nonBlank,
  color: z.string().nullable(),
  createdAt: isoTimestamp,
});

const travelStaySchema = z
  .object({
    id,
    area: nonBlank,
    entryDate: isoDate,
    exitDate: isoDate.nullable(),
    note: z.string().nullable(),
    createdAt: isoTimestamp,
  })
  // Mirrors `CHECK (exit_date IS NULL OR exit_date >= entry_date)`.
  .refine((stay) => orderedOrUnknown(stay.entryDate, stay.exitDate ?? stay.entryDate), {
    message: 'Left before arriving.',
    path: ['exitDate'],
  });

/**
 * A path inside the attachments root, and nothing else.
 *
 * An absolute path, a Windows drive letter, a backslash or any `..` segment
 * would let a crafted file write outside the directory the importer owns. The
 * check is here, in validation, as well as in the writer — a traversal caught
 * before a single byte is staged is better than one caught during the write.
 */
const relativePath = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.startsWith('/') &&
      !value.includes('\\') &&
      !/^[A-Za-z]:/.test(value) &&
      !value.split('/').some((segment) => segment === '..' || segment === '.' || segment === ''),
    { message: 'Not a safe relative path.' },
  );

const fileEntrySchema = z.object({
  attachmentId: id,
  relativePath,
  byteSize: z.number().int().min(0),
  sha256: z.string().regex(/^[0-9a-f]{64}$/, 'Not a SHA-256 digest.'),
});

const preferencesSchema = z
  .object({
    theme: z.string(),
    language: z.string(),
    reminderHour: z.number(),
    autoLockDelayMs: z.number(),
    biometricUnlock: z.boolean(),
  })
  .nullable();

const tablesSchema = z.object({
  items: z.array(itemSchema),
  attachments: z.array(attachmentSchema),
  reminderRules: z.array(reminderRuleSchema),
  itemNotes: z.array(itemNoteSchema),
  renewalTasks: z.array(renewalTaskSchema),
  renewals: z.array(renewalSchema),
  tags: z.array(tagSchema),
  itemTags: z.array(z.object({ itemId: id, tagId: id })),
  travelStays: z.array(travelStaySchema),
});

function duplicatesOf(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }

    seen.add(value);
  }

  return [...duplicates];
}

export const backupPayloadSchema = z
  .object({
    payloadVersion: z.number().int().min(1),
    createdAt: isoTimestamp,
    appVersion: z.string(),
    schemaVersion: z.number().int().min(0),
    preferences: preferencesSchema,
    tables: tablesSchema,
    files: z.array(fileEntrySchema),
  })
  .superRefine((payload, context) => {
    const { tables, files } = payload;
    const itemIds = new Set(tables.items.map((item) => item.id));
    const tagIds = new Set(tables.tags.map((tag) => tag.id));
    const attachmentIds = new Set(tables.attachments.map((attachment) => attachment.id));

    function requireParent(
      rows: readonly { itemId: string }[],
      table: string,
      known: ReadonlySet<string> = itemIds,
    ): void {
      rows.forEach((row, index) => {
        if (!known.has(row.itemId)) {
          context.addIssue({
            code: 'custom',
            path: ['tables', table, index, 'itemId'],
            message: `References item ${row.itemId}, which is not in this backup.`,
          });
        }
      });
    }

    requireParent(tables.attachments, 'attachments');
    requireParent(tables.reminderRules, 'reminderRules');
    requireParent(tables.itemNotes, 'itemNotes');
    requireParent(tables.renewalTasks, 'renewalTasks');
    requireParent(tables.renewals, 'renewals');
    requireParent(tables.itemTags, 'itemTags');

    tables.itemTags.forEach((link, index) => {
      if (!tagIds.has(link.tagId)) {
        context.addIssue({
          code: 'custom',
          path: ['tables', 'itemTags', index, 'tagId'],
          message: `References tag ${link.tagId}, which is not in this backup.`,
        });
      }
    });

    // Primary keys. Unique by definition in a database; a file can say anything.
    const uniqueness: [string, string[]][] = [
      ['items', tables.items.map((row) => row.id)],
      ['attachments', tables.attachments.map((row) => row.id)],
      ['reminderRules', tables.reminderRules.map((row) => row.id)],
      ['itemNotes', tables.itemNotes.map((row) => row.id)],
      ['renewalTasks', tables.renewalTasks.map((row) => row.id)],
      ['renewals', tables.renewals.map((row) => row.id)],
      ['tags', tables.tags.map((row) => row.id)],
      ['travelStays', tables.travelStays.map((row) => row.id)],
    ];

    for (const [table, ids] of uniqueness) {
      for (const duplicate of duplicatesOf(ids)) {
        context.addIssue({
          code: 'custom',
          path: ['tables', table],
          message: `Duplicate id ${duplicate}.`,
        });
      }
    }

    // `UNIQUE (label)` on tags.
    for (const duplicate of duplicatesOf(tables.tags.map((tag) => tag.label))) {
      context.addIssue({
        code: 'custom',
        path: ['tables', 'tags'],
        message: `Duplicate tag label ${duplicate}.`,
      });
    }

    // `UNIQUE (item_id, offset_days)` on reminder_rules.
    for (const duplicate of duplicatesOf(
      tables.reminderRules.map((rule) => `${rule.itemId}:${rule.offsetDays}`),
    )) {
      context.addIssue({
        code: 'custom',
        path: ['tables', 'reminderRules'],
        message: `Duplicate reminder offset ${duplicate}.`,
      });
    }

    // `PRIMARY KEY (item_id, tag_id)` on item_tags.
    for (const duplicate of duplicatesOf(
      tables.itemTags.map((link) => `${link.itemId}:${link.tagId}`),
    )) {
      context.addIssue({
        code: 'custom',
        path: ['tables', 'itemTags'],
        message: `Duplicate item/tag pair ${duplicate}.`,
      });
    }

    // The manifest and the attachment table have to describe the same set, or
    // the frames and the rows are about different files.
    files.forEach((file, index) => {
      if (!attachmentIds.has(file.attachmentId)) {
        context.addIssue({
          code: 'custom',
          path: ['files', index, 'attachmentId'],
          message: `Describes attachment ${file.attachmentId}, which is not in this backup.`,
        });
      }
    });

    for (const duplicate of duplicatesOf(files.map((file) => file.attachmentId))) {
      context.addIssue({
        code: 'custom',
        path: ['files'],
        message: `Attachment ${duplicate} is described twice.`,
      });
    }

    for (const duplicate of duplicatesOf(files.map((file) => file.relativePath))) {
      context.addIssue({
        code: 'custom',
        path: ['files'],
        message: `Two attachments claim the path ${duplicate}.`,
      });
    }

    if (files.length !== tables.attachments.length) {
      context.addIssue({
        code: 'custom',
        path: ['files'],
        message: `The backup holds ${tables.attachments.length} attachment rows but ${files.length} files.`,
      });
    }
  });

/**
 * Validates a decoded payload, or throws a `BackupError` the UI can render.
 *
 * Zod's issue list is kept in the message for the developer; only the first few
 * paths are included, because a file that fails in a thousand places is not
 * better explained by a thousand lines.
 */
export function parseBackupPayload(raw: unknown): BackupPayload {
  const result = backupPayloadSchema.safeParse(raw);

  if (!result.success) {
    const summary = result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');

    throw new BackupError(
      'invalid-payload',
      `The backup opened but its contents are not valid: ${summary}`,
      result.error,
    );
  }

  return result.data as BackupPayload;
}
