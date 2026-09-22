import type {
  Attachment,
  IsoTimestamp,
  Item,
  ItemNote,
  ReminderRule,
  Renewal,
  RenewalTask,
  Tag,
  TravelStay,
} from '@/db';
import type { Preferences } from '@/settings/preferences';

/**
 * What a `.evault` file contains once decrypted.
 *
 * The rows are the domain shapes the repositories already return, not raw
 * database rows: a backup that encoded column names would break the moment a
 * migration renamed one, and the mapping between the two is already written
 * once per repository.
 */

/** The payload shape this build writes. Versioned separately from the container. */
export const PAYLOAD_VERSION = 1;

/**
 * One attachment's bytes, as described by the manifest.
 *
 * `relativePath` rather than the original `fileUri`, because the absolute path
 * contains the app's container id and is different on every device and after
 * every reinstall. The importer rebuilds the absolute URI from this.
 */
export interface BackupFileEntry {
  attachmentId: string;
  /** `<itemId>/<fileName>`, always relative, never escaping the root. */
  relativePath: string;
  byteSize: number;
  /** Hex SHA-256 of the plaintext bytes, checked after decryption. */
  sha256: string;
}

export interface BackupTables {
  items: Item[];
  attachments: Attachment[];
  reminderRules: ReminderRule[];
  itemNotes: ItemNote[];
  renewalTasks: RenewalTask[];
  renewals: Renewal[];
  tags: Tag[];
  itemTags: { itemId: string; tagId: string }[];
  travelStays: TravelStay[];
}

export interface BackupPayload {
  payloadVersion: number;
  createdAt: IsoTimestamp;
  /** The app version that wrote the file, for support and for the preview. */
  appVersion: string;
  /** `PRAGMA user_version` at export time. Informational; restore does not use it. */
  schemaVersion: number;
  /**
   * The user's settings. Not secret, and losing them on a restore to a new
   * phone would mean a vault that comes back in the wrong language.
   */
  preferences: Preferences | null;
  tables: BackupTables;
  /** In frame order: `files[i]` is attachment frame `i`. */
  files: BackupFileEntry[];
}

/** What the confirmation screen shows before anything is overwritten. */
export interface BackupPreview {
  createdAt: IsoTimestamp;
  appVersion: string;
  payloadVersion: number;
  itemCount: number;
  archivedItemCount: number;
  attachmentCount: number;
  attachmentBytes: number;
  reminderCount: number;
  /** True when the file was written by an older payload version and migrated. */
  migrated: boolean;
}

export function previewOf(payload: BackupPayload, migrated: boolean): BackupPreview {
  return {
    createdAt: payload.createdAt,
    appVersion: payload.appVersion,
    payloadVersion: payload.payloadVersion,
    itemCount: payload.tables.items.length,
    archivedItemCount: payload.tables.items.filter((item) => item.archivedAt !== null).length,
    attachmentCount: payload.files.length,
    attachmentBytes: payload.files.reduce((total, file) => total + file.byteSize, 0),
    reminderCount: payload.tables.reminderRules.length,
    migrated,
  };
}
