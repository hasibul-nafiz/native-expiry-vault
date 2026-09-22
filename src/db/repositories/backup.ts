import type {
  Attachment,
  AttachmentRole,
  DocumentCategory,
  Item,
  ItemNote,
  ReminderRule,
  Renewal,
  RenewalTask,
  Tag,
  TravelStay,
} from '../models';
import type { Database } from '../types';

import { fromSqlBoolean, toSqlBoolean } from './shared';

/**
 * Whole-table reads and writes, for backup and restore only.
 *
 * Every other repository is scoped to what a screen asks for — one item, one
 * item's attachments, the rules due in a window. Backup is the one caller that
 * legitimately wants everything, including archived items, and giving it its
 * own module keeps that intent explicit rather than adding an `all` option to
 * eight existing functions that would then be reachable from a screen.
 *
 * As everywhere in `src/db`, the row-to-domain mapping is written out rather
 * than derived, so no caller has to guess at a shape.
 */

export interface ItemTagLink {
  itemId: string;
  tagId: string;
}

export interface AllTables {
  items: Item[];
  attachments: Attachment[];
  reminderRules: ReminderRule[];
  itemNotes: ItemNote[];
  renewalTasks: RenewalTask[];
  renewals: Renewal[];
  tags: Tag[];
  itemTags: ItemTagLink[];
  travelStays: TravelStay[];
}

/**
 * Parent-before-child, so every insert satisfies the foreign keys that are on
 * for the connection. Deletion walks it backwards.
 */
const TABLES_IN_DEPENDENCY_ORDER = [
  'items',
  'tags',
  'attachments',
  'reminder_rules',
  'item_notes',
  'renewal_tasks',
  'renewals',
  'item_tags',
  'travel_stays',
] as const;

export async function readAllTables(db: Database): Promise<AllTables> {
  const items = await db.getAllAsync<{
    id: string;
    title: string;
    category: DocumentCategory;
    issuer: string | null;
    document_number: string | null;
    country: string | null;
    issue_date: string | null;
    expiry_date: string;
    renewed_at: string | null;
    is_vital: number;
    escalation_enabled: number;
    ocr_confidence: number | null;
    ocr_raw_text: string | null;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, title, category, issuer, document_number, country, issue_date, expiry_date,
            renewed_at, is_vital, escalation_enabled, ocr_confidence, ocr_raw_text, archived_at,
            created_at, updated_at
     FROM items ORDER BY created_at ASC, id ASC`,
  );

  const attachments = await db.getAllAsync<{
    id: string;
    item_id: string;
    file_uri: string;
    file_name: string;
    mime_type: string;
    byte_size: number;
    role: AttachmentRole;
    sort_order: number;
    sha256: string | null;
    created_at: string;
  }>(
    `SELECT id, item_id, file_uri, file_name, mime_type, byte_size, role, sort_order, sha256,
            created_at
     FROM attachments ORDER BY item_id ASC, sort_order ASC, id ASC`,
  );

  const reminderRules = await db.getAllAsync<{
    id: string;
    item_id: string;
    offset_days: number;
    enabled: number;
    fire_date: string;
    delivered_at: string | null;
    notification_id: string | null;
    created_at: string;
  }>(
    `SELECT id, item_id, offset_days, enabled, fire_date, delivered_at, notification_id, created_at
     FROM reminder_rules ORDER BY item_id ASC, offset_days ASC`,
  );

  const itemNotes = await db.getAllAsync<{
    id: string;
    item_id: string;
    title: string;
    body: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, item_id, title, body, created_at, updated_at
     FROM item_notes ORDER BY item_id ASC, created_at ASC, id ASC`,
  );

  const renewalTasks = await db.getAllAsync<{
    id: string;
    item_id: string;
    title: string;
    detail: string | null;
    due_date: string | null;
    done: number;
    sort_order: number;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, item_id, title, detail, due_date, done, sort_order, created_at, updated_at
     FROM renewal_tasks ORDER BY item_id ASC, sort_order ASC, id ASC`,
  );

  const renewals = await db.getAllAsync<{
    id: string;
    item_id: string;
    previous_expiry_date: string;
    new_expiry_date: string;
    renewed_on: string;
    note: string | null;
    created_at: string;
  }>(
    `SELECT id, item_id, previous_expiry_date, new_expiry_date, renewed_on, note, created_at
     FROM renewals ORDER BY item_id ASC, renewed_on ASC, id ASC`,
  );

  const tags = await db.getAllAsync<{
    id: string;
    label: string;
    color: string | null;
    created_at: string;
  }>('SELECT id, label, color, created_at FROM tags ORDER BY label ASC');

  const itemTags = await db.getAllAsync<{ item_id: string; tag_id: string }>(
    'SELECT item_id, tag_id FROM item_tags ORDER BY item_id ASC, tag_id ASC',
  );

  const travelStays = await db.getAllAsync<{
    id: string;
    area: string;
    entry_date: string;
    exit_date: string | null;
    note: string | null;
    created_at: string;
  }>(
    `SELECT id, area, entry_date, exit_date, note, created_at
     FROM travel_stays ORDER BY area ASC, entry_date ASC, id ASC`,
  );

  return {
    items: items.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      issuer: row.issuer,
      documentNumber: row.document_number,
      country: row.country,
      issueDate: row.issue_date,
      expiryDate: row.expiry_date,
      renewedAt: row.renewed_at,
      isVital: fromSqlBoolean(row.is_vital),
      escalationEnabled: fromSqlBoolean(row.escalation_enabled),
      ocrConfidence: row.ocr_confidence,
      ocrRawText: row.ocr_raw_text,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    attachments: attachments.map((row) => ({
      id: row.id,
      itemId: row.item_id,
      fileUri: row.file_uri,
      fileName: row.file_name,
      mimeType: row.mime_type,
      byteSize: row.byte_size,
      role: row.role,
      sortOrder: row.sort_order,
      sha256: row.sha256,
      createdAt: row.created_at,
    })),
    reminderRules: reminderRules.map((row) => ({
      id: row.id,
      itemId: row.item_id,
      offsetDays: row.offset_days,
      enabled: fromSqlBoolean(row.enabled),
      fireDate: row.fire_date,
      deliveredAt: row.delivered_at,
      notificationId: row.notification_id,
      createdAt: row.created_at,
    })),
    itemNotes: itemNotes.map((row) => ({
      id: row.id,
      itemId: row.item_id,
      title: row.title,
      body: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    renewalTasks: renewalTasks.map((row) => ({
      id: row.id,
      itemId: row.item_id,
      title: row.title,
      detail: row.detail,
      dueDate: row.due_date,
      done: fromSqlBoolean(row.done),
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    renewals: renewals.map((row) => ({
      id: row.id,
      itemId: row.item_id,
      previousExpiryDate: row.previous_expiry_date,
      newExpiryDate: row.new_expiry_date,
      renewedOn: row.renewed_on,
      note: row.note,
      createdAt: row.created_at,
    })),
    tags: tags.map((row) => ({
      id: row.id,
      label: row.label,
      color: row.color,
      createdAt: row.created_at,
    })),
    itemTags: itemTags.map((row) => ({ itemId: row.item_id, tagId: row.tag_id })),
    travelStays: travelStays.map((row) => ({
      id: row.id,
      area: row.area,
      entryDate: row.entry_date,
      exitDate: row.exit_date,
      note: row.note,
      createdAt: row.created_at,
    })),
  };
}

/**
 * Empties every table and writes these rows in their place.
 *
 * It deliberately opens **no transaction of its own**. The caller wraps this
 * together with everything else a restore has to get right, so a failure
 * anywhere — including one thrown by SQLite on the last insert — leaves the
 * existing vault exactly as it was.
 *
 * Ids, timestamps and every other value come from the file as given: a restore
 * reproduces a vault, it does not create new records. That is what makes a
 * round trip comparable row for row.
 */
export async function replaceAllTables(db: Database, tables: AllTables): Promise<void> {
  for (const table of [...TABLES_IN_DEPENDENCY_ORDER].reverse()) {
    await db.execAsync(`DELETE FROM ${table}`);
  }

  for (const item of tables.items) {
    await db.runAsync(
      `INSERT INTO items (id, title, category, issuer, document_number, country, issue_date,
                          expiry_date, renewed_at, is_vital, escalation_enabled, ocr_confidence,
                          ocr_raw_text, archived_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.title,
        item.category,
        item.issuer,
        item.documentNumber,
        item.country,
        item.issueDate,
        item.expiryDate,
        item.renewedAt,
        toSqlBoolean(item.isVital),
        toSqlBoolean(item.escalationEnabled),
        item.ocrConfidence,
        item.ocrRawText,
        item.archivedAt,
        item.createdAt,
        item.updatedAt,
      ],
    );
  }

  for (const tag of tables.tags) {
    await db.runAsync('INSERT INTO tags (id, label, color, created_at) VALUES (?, ?, ?, ?)', [
      tag.id,
      tag.label,
      tag.color,
      tag.createdAt,
    ]);
  }

  for (const attachment of tables.attachments) {
    await db.runAsync(
      `INSERT INTO attachments (id, item_id, file_uri, file_name, mime_type, byte_size, role,
                                sort_order, sha256, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attachment.id,
        attachment.itemId,
        attachment.fileUri,
        attachment.fileName,
        attachment.mimeType,
        attachment.byteSize,
        attachment.role,
        attachment.sortOrder,
        attachment.sha256,
        attachment.createdAt,
      ],
    );
  }

  for (const rule of tables.reminderRules) {
    await db.runAsync(
      `INSERT INTO reminder_rules (id, item_id, offset_days, enabled, fire_date, delivered_at,
                                   notification_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rule.id,
        rule.itemId,
        rule.offsetDays,
        toSqlBoolean(rule.enabled),
        rule.fireDate,
        rule.deliveredAt,
        rule.notificationId,
        rule.createdAt,
      ],
    );
  }

  for (const note of tables.itemNotes) {
    await db.runAsync(
      `INSERT INTO item_notes (id, item_id, title, body, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [note.id, note.itemId, note.title, note.body, note.createdAt, note.updatedAt],
    );
  }

  for (const task of tables.renewalTasks) {
    await db.runAsync(
      `INSERT INTO renewal_tasks (id, item_id, title, detail, due_date, done, sort_order,
                                  created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.itemId,
        task.title,
        task.detail,
        task.dueDate,
        toSqlBoolean(task.done),
        task.sortOrder,
        task.createdAt,
        task.updatedAt,
      ],
    );
  }

  for (const renewal of tables.renewals) {
    await db.runAsync(
      `INSERT INTO renewals (id, item_id, previous_expiry_date, new_expiry_date, renewed_on, note,
                             created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        renewal.id,
        renewal.itemId,
        renewal.previousExpiryDate,
        renewal.newExpiryDate,
        renewal.renewedOn,
        renewal.note,
        renewal.createdAt,
      ],
    );
  }

  for (const link of tables.itemTags) {
    await db.runAsync('INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)', [
      link.itemId,
      link.tagId,
    ]);
  }

  for (const stay of tables.travelStays) {
    await db.runAsync(
      `INSERT INTO travel_stays (id, area, entry_date, exit_date, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [stay.id, stay.area, stay.entryDate, stay.exitDate, stay.note, stay.createdAt],
    );
  }
}
