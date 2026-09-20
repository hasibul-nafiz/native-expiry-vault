import type { ItemNote } from '../models';
import type { Database } from '../types';

import { newId, nowTimestamp } from './shared';

/** Titled secure notes, as the item-detail screen's "Secure Notes" section shows. */

interface ItemNoteRow {
  id: string;
  item_id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

const COLUMNS = 'id, item_id, title, body, created_at, updated_at';

function toItemNote(row: ItemNoteRow): ItemNote {
  return {
    id: row.id,
    itemId: row.item_id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createItemNote(
  db: Database,
  itemId: string,
  title: string,
  body: string,
): Promise<ItemNote> {
  const id = newId();
  const timestamp = nowTimestamp();

  await db.runAsync(`INSERT INTO item_notes (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)`, [
    id,
    itemId,
    title,
    body,
    timestamp,
    timestamp,
  ]);

  const created = await getItemNote(db, id);

  if (created === null) {
    throw new Error(`Note ${id} disappeared immediately after insert.`);
  }

  return created;
}

export async function getItemNote(db: Database, id: string): Promise<ItemNote | null> {
  const row = await db.getFirstAsync<ItemNoteRow>(
    `SELECT ${COLUMNS} FROM item_notes WHERE id = ?`,
    [id],
  );

  return row === null ? null : toItemNote(row);
}

export async function listItemNotes(db: Database, itemId: string): Promise<ItemNote[]> {
  const rows = await db.getAllAsync<ItemNoteRow>(
    `SELECT ${COLUMNS} FROM item_notes WHERE item_id = ? ORDER BY created_at ASC`,
    [itemId],
  );

  return rows.map(toItemNote);
}

export async function updateItemNote(
  db: Database,
  id: string,
  changes: { title?: string; body?: string },
): Promise<ItemNote | null> {
  const assignments: string[] = [];
  const params: string[] = [];

  if (changes.title !== undefined) {
    assignments.push('title = ?');
    params.push(changes.title);
  }

  if (changes.body !== undefined) {
    assignments.push('body = ?');
    params.push(changes.body);
  }

  if (assignments.length === 0) {
    return getItemNote(db, id);
  }

  assignments.push('updated_at = ?');
  params.push(nowTimestamp());

  await db.runAsync(`UPDATE item_notes SET ${assignments.join(', ')} WHERE id = ?`, [
    ...params,
    id,
  ]);

  return getItemNote(db, id);
}

export async function deleteItemNote(db: Database, id: string): Promise<boolean> {
  const { changes } = await db.runAsync('DELETE FROM item_notes WHERE id = ?', [id]);

  return changes > 0;
}
