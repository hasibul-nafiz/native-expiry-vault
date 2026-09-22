import { openEncryptedDatabase } from './adapters/expoSqlite';
import type { Database } from './types';

/**
 * The public surface of the data layer. Nothing outside `src/db` imports
 * `expo-sqlite`, a raw row type, or a SQL string.
 */

let connection: Promise<Database> | null = null;

/**
 * Opens the encrypted database once per app session and reuses it thereafter.
 *
 * The promise itself is memoised, not its result, so two callers racing on
 * startup share one connection rather than opening two. A failed open is not
 * cached, so a later attempt can retry.
 */
export function getDatabase(): Promise<Database> {
  if (connection === null) {
    connection = openEncryptedDatabase().catch((error: unknown) => {
      connection = null;
      throw error;
    });
  }

  return connection;
}

/** Closes the connection and forgets it. Used when locking the app (F9). */
export async function closeDatabase(): Promise<void> {
  if (connection === null) {
    return;
  }

  const db = await connection;
  connection = null;
  await db.closeAsync();
}

export { DATABASE_NAME } from './adapters/expoSqlite';
export { DatabaseError } from './errors';
export { getSchemaVersion, LATEST_SCHEMA_VERSION, migrate, MigrationError } from './migrate';
export { DatabaseKeyError, deleteDatabaseKey, getOrCreateDatabaseKey } from './key';

export type { Database, Migration, RunResult, SqlParam } from './types';
export {
  attachmentRoles,
  documentCategories,
  type Attachment,
  type AttachmentRole,
  type DocumentCategory,
  type IsoDate,
  type IsoTimestamp,
  type Item,
  type ItemNote,
  type ItemUpdate,
  type NewAttachment,
  type NewItem,
  type ReminderRule,
  type Renewal,
  type RenewalTask,
  type Tag,
  type TravelStay,
} from './models';

export * as attachmentsRepository from './repositories/attachments';
export * as backupRepository from './repositories/backup';
export type { AllTables, ItemTagLink } from './repositories/backup';
export * as itemNotesRepository from './repositories/itemNotes';
export * as itemsRepository from './repositories/items';
export * as reminderRulesRepository from './repositories/reminderRules';
export * as renewalsRepository from './repositories/renewals';
export * as renewalTasksRepository from './repositories/renewalTasks';
export * as tagsRepository from './repositories/tags';
export * as travelStaysRepository from './repositories/travelStays';
