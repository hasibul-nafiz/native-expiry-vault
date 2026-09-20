import type { Attachment, AttachmentRole, NewAttachment } from '../models';
import type { Database } from '../types';

import { newId, nowTimestamp, orNull } from './shared';

/**
 * Attachment metadata only. The file bytes live in the app's document directory,
 * not in the database — which also means SQLCipher does not cover them; the
 * files themselves are encrypted separately (F8/F12).
 */

interface AttachmentRow {
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
}

const COLUMNS =
  'id, item_id, file_uri, file_name, mime_type, byte_size, role, sort_order, sha256, created_at';

function toAttachment(row: AttachmentRow): Attachment {
  return {
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
  };
}

export async function createAttachment(db: Database, input: NewAttachment): Promise<Attachment> {
  const id = newId();

  await db.runAsync(`INSERT INTO attachments (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id,
    input.itemId,
    input.fileUri,
    input.fileName,
    input.mimeType,
    input.byteSize,
    input.role ?? 'other',
    input.sortOrder ?? 0,
    orNull(input.sha256),
    nowTimestamp(),
  ]);

  const created = await getAttachment(db, id);

  if (created === null) {
    throw new Error(`Attachment ${id} disappeared immediately after insert.`);
  }

  return created;
}

export async function getAttachment(db: Database, id: string): Promise<Attachment | null> {
  const row = await db.getFirstAsync<AttachmentRow>(
    `SELECT ${COLUMNS} FROM attachments WHERE id = ?`,
    [id],
  );

  return row === null ? null : toAttachment(row);
}

export async function listAttachmentsForItem(db: Database, itemId: string): Promise<Attachment[]> {
  const rows = await db.getAllAsync<AttachmentRow>(
    `SELECT ${COLUMNS} FROM attachments WHERE item_id = ? ORDER BY sort_order ASC, created_at ASC`,
    [itemId],
  );

  return rows.map(toAttachment);
}

export async function deleteAttachment(db: Database, id: string): Promise<boolean> {
  const { changes } = await db.runAsync('DELETE FROM attachments WHERE id = ?', [id]);

  return changes > 0;
}

/** Total bytes held for one item, for the storage figures on item detail. */
export async function sumAttachmentBytes(db: Database, itemId: string): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(byte_size) AS total FROM attachments WHERE item_id = ?',
    [itemId],
  );

  return row?.total ?? 0;
}
