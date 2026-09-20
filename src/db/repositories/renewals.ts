import type { IsoDate, Renewal } from '../models';
import type { Database } from '../types';

import { newId, nowTimestamp, orNull } from './shared';

/**
 * Renewal history.
 *
 * Rows are written by `markItemRenewed`, inside the same transaction that moves
 * the item's expiry date — history that can disagree with the record it
 * describes is worse than no history at all.
 */

interface RenewalRow {
  id: string;
  item_id: string;
  previous_expiry_date: string;
  new_expiry_date: string;
  renewed_on: string;
  note: string | null;
  created_at: string;
}

const COLUMNS = 'id, item_id, previous_expiry_date, new_expiry_date, renewed_on, note, created_at';

function toRenewal(row: RenewalRow): Renewal {
  return {
    id: row.id,
    itemId: row.item_id,
    previousExpiryDate: row.previous_expiry_date,
    newExpiryDate: row.new_expiry_date,
    renewedOn: row.renewed_on,
    note: row.note,
    createdAt: row.created_at,
  };
}

export interface NewRenewal {
  itemId: string;
  previousExpiryDate: IsoDate;
  newExpiryDate: IsoDate;
  renewedOn: IsoDate;
  note?: string | null;
}

/**
 * Records one renewal. Called from inside `markItemRenewed`'s transaction, so
 * it deliberately opens no transaction of its own.
 */
export async function recordRenewal(db: Database, input: NewRenewal): Promise<Renewal> {
  const id = newId();

  await db.runAsync(`INSERT INTO renewals (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
    id,
    input.itemId,
    input.previousExpiryDate,
    input.newExpiryDate,
    input.renewedOn,
    orNull(input.note),
    nowTimestamp(),
  ]);

  const created = await getRenewal(db, id);

  if (created === null) {
    throw new Error(`Renewal ${id} disappeared immediately after insert.`);
  }

  return created;
}

export async function getRenewal(db: Database, id: string): Promise<Renewal | null> {
  const row = await db.getFirstAsync<RenewalRow>(`SELECT ${COLUMNS} FROM renewals WHERE id = ?`, [
    id,
  ]);

  return row === null ? null : toRenewal(row);
}

/** Most recent first, which is the order the history section reads in. */
export async function listRenewals(db: Database, itemId: string): Promise<Renewal[]> {
  const rows = await db.getAllAsync<RenewalRow>(
    `SELECT ${COLUMNS} FROM renewals WHERE item_id = ? ORDER BY renewed_on DESC, created_at DESC`,
    [itemId],
  );

  return rows.map(toRenewal);
}

export async function countRenewals(db: Database, itemId: string): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM renewals WHERE item_id = ?',
    [itemId],
  );

  return row?.count ?? 0;
}
