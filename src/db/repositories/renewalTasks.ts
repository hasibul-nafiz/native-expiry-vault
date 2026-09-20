import type { IsoDate, RenewalTask } from '../models';
import type { Database, SqlParam } from '../types';

import { fromSqlBoolean, newId, nowTimestamp, orNull, toSqlBoolean } from './shared';

/** The item-detail "Renewal Roadmap" checklist. */

interface RenewalTaskRow {
  id: string;
  item_id: string;
  title: string;
  detail: string | null;
  due_date: string | null;
  done: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const COLUMNS = 'id, item_id, title, detail, due_date, done, sort_order, created_at, updated_at';

function toRenewalTask(row: RenewalTaskRow): RenewalTask {
  return {
    id: row.id,
    itemId: row.item_id,
    title: row.title,
    detail: row.detail,
    dueDate: row.due_date,
    done: fromSqlBoolean(row.done),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface NewRenewalTask {
  itemId: string;
  title: string;
  detail?: string | null;
  dueDate?: IsoDate | null;
  done?: boolean;
  sortOrder?: number;
}

export async function createRenewalTask(db: Database, input: NewRenewalTask): Promise<RenewalTask> {
  const id = newId();
  const timestamp = nowTimestamp();

  await db.runAsync(`INSERT INTO renewal_tasks (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id,
    input.itemId,
    input.title,
    orNull(input.detail),
    orNull(input.dueDate),
    toSqlBoolean(input.done ?? false),
    input.sortOrder ?? 0,
    timestamp,
    timestamp,
  ]);

  const created = await getRenewalTask(db, id);

  if (created === null) {
    throw new Error(`Renewal task ${id} disappeared immediately after insert.`);
  }

  return created;
}

export async function getRenewalTask(db: Database, id: string): Promise<RenewalTask | null> {
  const row = await db.getFirstAsync<RenewalTaskRow>(
    `SELECT ${COLUMNS} FROM renewal_tasks WHERE id = ?`,
    [id],
  );

  return row === null ? null : toRenewalTask(row);
}

export async function listRenewalTasks(db: Database, itemId: string): Promise<RenewalTask[]> {
  const rows = await db.getAllAsync<RenewalTaskRow>(
    `SELECT ${COLUMNS} FROM renewal_tasks WHERE item_id = ? ORDER BY sort_order ASC, created_at ASC`,
    [itemId],
  );

  return rows.map(toRenewalTask);
}

export async function updateRenewalTask(
  db: Database,
  id: string,
  changes: Partial<Omit<NewRenewalTask, 'itemId'>>,
): Promise<RenewalTask | null> {
  const assignments: string[] = [];
  const params: SqlParam[] = [];

  if (changes.title !== undefined) {
    assignments.push('title = ?');
    params.push(changes.title);
  }

  if (changes.detail !== undefined) {
    assignments.push('detail = ?');
    params.push(orNull(changes.detail));
  }

  if (changes.dueDate !== undefined) {
    assignments.push('due_date = ?');
    params.push(orNull(changes.dueDate));
  }

  if (changes.done !== undefined) {
    assignments.push('done = ?');
    params.push(toSqlBoolean(changes.done));
  }

  if (changes.sortOrder !== undefined) {
    assignments.push('sort_order = ?');
    params.push(changes.sortOrder);
  }

  if (assignments.length === 0) {
    return getRenewalTask(db, id);
  }

  assignments.push('updated_at = ?');
  params.push(nowTimestamp());

  await db.runAsync(`UPDATE renewal_tasks SET ${assignments.join(', ')} WHERE id = ?`, [
    ...params,
    id,
  ]);

  return getRenewalTask(db, id);
}

export async function deleteRenewalTask(db: Database, id: string): Promise<boolean> {
  const { changes } = await db.runAsync('DELETE FROM renewal_tasks WHERE id = ?', [id]);

  return changes > 0;
}

/** The "2 of 4 Ready" progress readout on item detail. */
export async function countRenewalTasks(
  db: Database,
  itemId: string,
): Promise<{ done: number; total: number }> {
  const row = await db.getFirstAsync<{ done: number | null; total: number }>(
    'SELECT SUM(done) AS done, COUNT(*) AS total FROM renewal_tasks WHERE item_id = ?',
    [itemId],
  );

  return { done: row?.done ?? 0, total: row?.total ?? 0 };
}
