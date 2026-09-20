/**
 * Domain shapes returned by the repositories. These are what the rest of the app
 * imports; nothing outside `src/db` sees a raw database row.
 *
 * Two distinct date shapes are used deliberately so they can never be confused:
 * - `IsoDate`      `YYYY-MM-DD`, a calendar date with no time and no timezone.
 * - `IsoTimestamp` full ISO-8601 UTC, used only for audit columns (`*_at`).
 */

/** A calendar date, `YYYY-MM-DD`. Enforced by CHECK constraints in the schema. */
export type IsoDate = string;

/** An instant, ISO-8601 UTC (`2026-09-20T09:41:00.000Z`). */
export type IsoTimestamp = string;

/**
 * Stable category keys. The Stitch export shows six presets plus a scanner
 * dropdown; the display labels are i18n keys resolved at render time (F11), so
 * only the key is persisted.
 */
export const documentCategories = [
  'passport',
  'visa',
  'health',
  'license',
  'warranty',
  'contract',
  'other',
] as const;

export type DocumentCategory = (typeof documentCategories)[number];

/** Which face of a physical document an attachment shows. */
export const attachmentRoles = ['front', 'back', 'other'] as const;
export type AttachmentRole = (typeof attachmentRoles)[number];

export interface Item {
  id: string;
  title: string;
  category: DocumentCategory;
  issuer: string | null;
  /** Stored as entered; masked at render time, never logged. */
  documentNumber: string | null;
  /** ISO 3166-1 alpha-2, uppercase. */
  country: string | null;
  issueDate: IsoDate | null;
  expiryDate: IsoDate;
  /** Set by `markRenewed`; the date the document was last renewed. */
  renewedAt: IsoDate | null;
  /** Include in the emergency dossier export (F12). */
  isVital: boolean;
  /** Daily alerts once inside the escalation window. */
  escalationEnabled: boolean;
  /** 0-1, from the OCR pass that created the item (F8). */
  ocrConfidence: number | null;
  /** Raw recognised text (e.g. the MRZ lines) kept for re-parsing. */
  ocrRawText: string | null;
  /** Null while active. Archived items are hidden from the vault, not deleted. */
  archivedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

/**
 * One past renewal. Append-only: `items.renewed_at` holds only the most recent,
 * so this is what makes the history recoverable.
 */
export interface Renewal {
  id: string;
  itemId: string;
  previousExpiryDate: IsoDate;
  newExpiryDate: IsoDate;
  /** The day the renewal was recorded. */
  renewedOn: IsoDate;
  note: string | null;
  createdAt: IsoTimestamp;
}

/** Everything a caller supplies to create an item; the rest is derived. */
export interface NewItem {
  title: string;
  category: DocumentCategory;
  expiryDate: IsoDate;
  issuer?: string | null;
  documentNumber?: string | null;
  country?: string | null;
  issueDate?: IsoDate | null;
  isVital?: boolean;
  escalationEnabled?: boolean;
  ocrConfidence?: number | null;
  ocrRawText?: string | null;
}

export type ItemUpdate = Partial<Omit<NewItem, 'category'>> & {
  category?: DocumentCategory;
};

export interface Attachment {
  id: string;
  itemId: string;
  /** File URI inside the app's document directory. The bytes are not in the DB. */
  fileUri: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  role: AttachmentRole;
  sortOrder: number;
  /** Hex SHA-256 of the file, for the integrity check shown on item detail. */
  sha256: string | null;
  createdAt: IsoTimestamp;
}

export interface NewAttachment {
  itemId: string;
  fileUri: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  role?: AttachmentRole;
  sortOrder?: number;
  sha256?: string | null;
}

export interface ReminderRule {
  id: string;
  itemId: string;
  /** Days before `expiryDate` this reminder fires. */
  offsetDays: number;
  enabled: boolean;
  /** Denormalised `expiryDate - offsetDays`, so F7 can range-scan an index. */
  fireDate: IsoDate;
  deliveredAt: IsoTimestamp | null;
  /** Handle returned by expo-notifications, so a rule can be cancelled (F7). */
  notificationId: string | null;
  createdAt: IsoTimestamp;
}

export interface ItemNote {
  id: string;
  itemId: string;
  title: string;
  body: string;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface RenewalTask {
  id: string;
  itemId: string;
  title: string;
  detail: string | null;
  dueDate: IsoDate | null;
  done: boolean;
  sortOrder: number;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface Tag {
  id: string;
  label: string;
  /** Free-form colour token key chosen in settings; null means the default hue. */
  color: string | null;
  createdAt: IsoTimestamp;
}

/**
 * One period spent inside a visa area, for the rolling 90/180 counter on the
 * vault-health screen. A null `exitDate` means the stay is still open.
 */
export interface TravelStay {
  id: string;
  area: string;
  entryDate: IsoDate;
  exitDate: IsoDate | null;
  note: string | null;
  createdAt: IsoTimestamp;
}
