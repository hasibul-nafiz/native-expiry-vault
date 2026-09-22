import type { StayPeriod } from '@/features/expiry/travel';

import type { IsoDate, TravelStay } from '../models';
import type { Database, SqlParam } from '../types';

import { newId, nowTimestamp, orNull } from './shared';

/** The travel ledger behind the vault-health screen's rolling 90/180 counter. */

interface TravelStayRow {
  id: string;
  area: string;
  entry_date: string;
  exit_date: string | null;
  note: string | null;
  created_at: string;
}

const COLUMNS = 'id, area, entry_date, exit_date, note, created_at';

function toTravelStay(row: TravelStayRow): TravelStay {
  return {
    id: row.id,
    area: row.area,
    entryDate: row.entry_date,
    exitDate: row.exit_date,
    note: row.note,
    createdAt: row.created_at,
  };
}

export interface NewTravelStay {
  entryDate: IsoDate;
  exitDate?: IsoDate | null;
  area?: string;
  note?: string | null;
}

export async function createTravelStay(db: Database, input: NewTravelStay): Promise<TravelStay> {
  const id = newId();

  await db.runAsync(`INSERT INTO travel_stays (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)`, [
    id,
    input.area ?? 'schengen',
    input.entryDate,
    orNull(input.exitDate),
    orNull(input.note),
    nowTimestamp(),
  ]);

  const created = await getTravelStay(db, id);

  if (created === null) {
    throw new Error(`Travel stay ${id} disappeared immediately after insert.`);
  }

  return created;
}

export async function getTravelStay(db: Database, id: string): Promise<TravelStay | null> {
  const row = await db.getFirstAsync<TravelStayRow>(
    `SELECT ${COLUMNS} FROM travel_stays WHERE id = ?`,
    [id],
  );

  return row === null ? null : toTravelStay(row);
}

export async function listTravelStays(db: Database, area?: string): Promise<TravelStay[]> {
  const where = area === undefined ? '' : ' WHERE area = ?';
  const params: SqlParam[] = area === undefined ? [] : [area];
  const rows = await db.getAllAsync<TravelStayRow>(
    `SELECT ${COLUMNS} FROM travel_stays${where} ORDER BY entry_date ASC`,
    params,
  );

  return rows.map(toTravelStay);
}

/**
 * Only the fields the 90/180 calculation needs, in the shape it expects, so the
 * caller does not have to reshape rows before computing usage.
 */
export async function listStayPeriods(db: Database, area = 'schengen'): Promise<StayPeriod[]> {
  const rows = await db.getAllAsync<{
    entry_date: string;
    exit_date: string | null;
  }>('SELECT entry_date, exit_date FROM travel_stays WHERE area = ? ORDER BY entry_date ASC', [
    area,
  ]);

  return rows.map((row) => ({
    entryDate: row.entry_date,
    exitDate: row.exit_date,
  }));
}

export async function closeTravelStay(
  db: Database,
  id: string,
  exitDate: IsoDate,
): Promise<TravelStay | null> {
  await db.runAsync('UPDATE travel_stays SET exit_date = ? WHERE id = ?', [exitDate, id]);

  return getTravelStay(db, id);
}

export async function deleteTravelStay(db: Database, id: string): Promise<boolean> {
  const { changes } = await db.runAsync('DELETE FROM travel_stays WHERE id = ?', [id]);

  return changes > 0;
}
