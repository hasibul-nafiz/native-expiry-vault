import type { Tag } from '../models';
import type { Database } from '../types';

import { newId, nowTimestamp, orNull } from './shared';

/** Custom tags and their item associations. */

interface TagRow {
  id: string;
  label: string;
  color: string | null;
  created_at: string;
}

const COLUMNS = 'id, label, color, created_at';

function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    label: row.label,
    color: row.color,
    createdAt: row.created_at,
  };
}

export async function createTag(
  db: Database,
  label: string,
  color: string | null = null,
): Promise<Tag> {
  const id = newId();

  await db.runAsync(`INSERT INTO tags (${COLUMNS}) VALUES (?, ?, ?, ?)`, [
    id,
    label,
    orNull(color),
    nowTimestamp(),
  ]);

  const created = await getTag(db, id);

  if (created === null) {
    throw new Error(`Tag ${id} disappeared immediately after insert.`);
  }

  return created;
}

export async function getTag(db: Database, id: string): Promise<Tag | null> {
  const row = await db.getFirstAsync<TagRow>(`SELECT ${COLUMNS} FROM tags WHERE id = ?`, [id]);

  return row === null ? null : toTag(row);
}

export async function listTags(db: Database): Promise<Tag[]> {
  const rows = await db.getAllAsync<TagRow>(`SELECT ${COLUMNS} FROM tags ORDER BY label ASC`);

  return rows.map(toTag);
}

export async function deleteTag(db: Database, id: string): Promise<boolean> {
  const { changes } = await db.runAsync('DELETE FROM tags WHERE id = ?', [id]);

  return changes > 0;
}

/** Idempotent: tagging an item twice is not an error. */
export async function addTagToItem(db: Database, itemId: string, tagId: string): Promise<void> {
  await db.runAsync('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)', [
    itemId,
    tagId,
  ]);
}

export async function removeTagFromItem(
  db: Database,
  itemId: string,
  tagId: string,
): Promise<boolean> {
  const { changes } = await db.runAsync('DELETE FROM item_tags WHERE item_id = ? AND tag_id = ?', [
    itemId,
    tagId,
  ]);

  return changes > 0;
}

export async function listTagsForItem(db: Database, itemId: string): Promise<Tag[]> {
  const rows = await db.getAllAsync<TagRow>(
    `SELECT ${COLUMNS.split(', ')
      .map((column) => `tags.${column}`)
      .join(', ')}
     FROM tags
     JOIN item_tags ON item_tags.tag_id = tags.id
     WHERE item_tags.item_id = ?
     ORDER BY tags.label ASC`,
    [itemId],
  );

  return rows.map(toTag);
}
