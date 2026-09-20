import { fireDateFor } from '@/features/expiry/reminders';
import type { StatusWindow } from '@/features/expiry/status';
import type { DocumentStatus } from '@/theme';

import type { DocumentCategory, IsoDate, Item, ItemUpdate, NewItem } from '../models';
import type { Database, SqlParam } from '../types';

import { recordRenewal } from './renewals';
import { fromSqlBoolean, newId, nowTimestamp, orNull, toSqlBoolean } from './shared';

/**
 * The items repository.
 *
 * This module is allowed one dependency on `src/features/expiry` — the pure date
 * helpers. They have no database dependency of their own, so the direction stays
 * one-way, and keeping date arithmetic there means the data layer and the UI can
 * never disagree about what "60 days before expiry" means.
 */

interface ItemRow {
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
}

const COLUMNS =
  'id, title, category, issuer, document_number, country, issue_date, expiry_date, renewed_at, ' +
  'is_vital, escalation_enabled, ocr_confidence, ocr_raw_text, archived_at, created_at, updated_at';

/** Columns supplied on insert; `archived_at` starts null and is set by archiving. */
const INSERT_COLUMNS =
  'id, title, category, issuer, document_number, country, issue_date, expiry_date, renewed_at, ' +
  'is_vital, escalation_enabled, ocr_confidence, ocr_raw_text, created_at, updated_at';

/**
 * Archived items are hidden from the vault everywhere by default.
 *
 * This is expressed as an explicit option on every read rather than a silent
 * global filter, so each call site states what it wants and a future query
 * cannot accidentally forget the distinction.
 */
const ACTIVE_ONLY = 'archived_at IS NULL';

function archiveClause(includeArchived: boolean): string[] {
  return includeArchived ? [] : [ACTIVE_ONLY];
}

function toItem(row: ItemRow): Item {
  return {
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
  };
}

/**
 * The SQL clause for one status band. `YYYY-MM-DD` sorts lexicographically, so
 * these are plain string comparisons the `idx_items_expiry_date` index can serve
 * — no date functions, and the same boundaries the pure status function uses.
 */
function statusCondition(
  status: DocumentStatus,
  window: StatusWindow,
): { sql: string; params: SqlParam[] } {
  switch (status) {
    case 'expired':
      return { sql: 'expiry_date < ?', params: [window.today] };
    case 'soon':
      return {
        sql: 'expiry_date >= ? AND expiry_date <= ?',
        params: [window.today, window.soonEnd],
      };
    case 'safe':
      return { sql: 'expiry_date > ?', params: [window.soonEnd] };
  }
}

export interface ListItemsOptions {
  category?: DocumentCategory;
  /** Requires `window`, since a status band is defined by its date boundaries. */
  status?: DocumentStatus;
  window?: StatusWindow;
  /** Matched case-insensitively against title and issuer. */
  search?: string;
  /** Archived items are excluded unless this is set. */
  includeArchived?: boolean;
}

/** Escapes the LIKE wildcards so a literal `%` in a search term stays literal. */
function toLikePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

export async function createItem(db: Database, input: NewItem): Promise<Item> {
  const id = newId();
  const timestamp = nowTimestamp();

  await db.runAsync(
    `INSERT INTO items (${INSERT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.title,
      input.category,
      orNull(input.issuer),
      orNull(input.documentNumber),
      orNull(input.country),
      orNull(input.issueDate),
      input.expiryDate,
      null,
      toSqlBoolean(input.isVital ?? false),
      toSqlBoolean(input.escalationEnabled ?? true),
      input.ocrConfidence ?? null,
      orNull(input.ocrRawText),
      timestamp,
      timestamp,
    ],
  );

  const created = await getItem(db, id);

  if (created === null) {
    throw new Error(`Item ${id} disappeared immediately after insert.`);
  }

  return created;
}

export async function getItem(db: Database, id: string): Promise<Item | null> {
  const row = await db.getFirstAsync<ItemRow>(`SELECT ${COLUMNS} FROM items WHERE id = ?`, [id]);

  return row === null ? null : toItem(row);
}

export async function listItems(db: Database, options: ListItemsOptions = {}): Promise<Item[]> {
  const conditions: string[] = archiveClause(options.includeArchived ?? false);
  const params: SqlParam[] = [];

  if (options.category !== undefined) {
    conditions.push('category = ?');
    params.push(options.category);
  }

  if (options.status !== undefined) {
    if (options.window === undefined) {
      throw new Error('Filtering by status requires a status window.');
    }

    const condition = statusCondition(options.status, options.window);
    conditions.push(`(${condition.sql})`);
    params.push(...condition.params);
  }

  if (options.search !== undefined && options.search.trim() !== '') {
    conditions.push("(title LIKE ? ESCAPE '\\' OR IFNULL(issuer, '') LIKE ? ESCAPE '\\')");
    const pattern = toLikePattern(options.search.trim());
    params.push(pattern, pattern);
  }

  const where = conditions.length === 0 ? '' : ` WHERE ${conditions.join(' AND ')}`;
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT ${COLUMNS} FROM items${where} ORDER BY expiry_date ASC, title ASC`,
    params,
  );

  return rows.map(toItem);
}

/**
 * Updates the given fields and, when the expiry date moves, recomputes every
 * reminder rule's stored `fire_date` in the same transaction — so the two can
 * never disagree about when an alert is due.
 */
export async function updateItem(
  db: Database,
  id: string,
  changes: ItemUpdate,
): Promise<Item | null> {
  const existing = await getItem(db, id);

  if (existing === null) {
    return null;
  }

  const assignments: string[] = [];
  const params: SqlParam[] = [];

  const push = (column: string, value: SqlParam): void => {
    assignments.push(`${column} = ?`);
    params.push(value);
  };

  if (changes.title !== undefined) push('title', changes.title);
  if (changes.category !== undefined) push('category', changes.category);
  if (changes.issuer !== undefined) push('issuer', orNull(changes.issuer));
  if (changes.documentNumber !== undefined) push('document_number', orNull(changes.documentNumber));
  if (changes.country !== undefined) push('country', orNull(changes.country));
  if (changes.issueDate !== undefined) push('issue_date', orNull(changes.issueDate));
  if (changes.expiryDate !== undefined) push('expiry_date', changes.expiryDate);
  if (changes.isVital !== undefined) push('is_vital', toSqlBoolean(changes.isVital));
  if (changes.escalationEnabled !== undefined) {
    push('escalation_enabled', toSqlBoolean(changes.escalationEnabled));
  }
  if (changes.ocrConfidence !== undefined) push('ocr_confidence', changes.ocrConfidence ?? null);
  if (changes.ocrRawText !== undefined) push('ocr_raw_text', orNull(changes.ocrRawText));

  if (assignments.length === 0) {
    return existing;
  }

  push('updated_at', nowTimestamp());

  const newExpiry = changes.expiryDate;
  const expiryMoved = newExpiry !== undefined && newExpiry !== existing.expiryDate;

  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE items SET ${assignments.join(', ')} WHERE id = ?`, [...params, id]);

    if (expiryMoved) {
      await recomputeFireDates(db, id, newExpiry);
    }
  });

  return getItem(db, id);
}

async function recomputeFireDates(
  db: Database,
  itemId: string,
  expiryDate: IsoDate,
): Promise<void> {
  const rules = await db.getAllAsync<{ id: string; offset_days: number }>(
    'SELECT id, offset_days FROM reminder_rules WHERE item_id = ?',
    [itemId],
  );

  for (const rule of rules) {
    await db.runAsync('UPDATE reminder_rules SET fire_date = ? WHERE id = ?', [
      fireDateFor(expiryDate, rule.offset_days),
      rule.id,
    ]);
  }
}

/**
 * Records a renewal: the document runs to a new expiry date, the previous one is
 * appended to the renewal history, and every reminder follows the new expiry.
 *
 * All three happen in one transaction. History that can disagree with the record
 * it describes would be worse than no history at all.
 */
export async function markItemRenewed(
  db: Database,
  id: string,
  newExpiryDate: IsoDate,
  renewedOn: IsoDate,
  note?: string | null,
): Promise<Item | null> {
  const existing = await getItem(db, id);

  if (existing === null) {
    return null;
  }

  await db.withTransactionAsync(async () => {
    await recordRenewal(db, {
      itemId: id,
      previousExpiryDate: existing.expiryDate,
      newExpiryDate,
      renewedOn,
      note,
    });

    await db.runAsync(
      'UPDATE items SET expiry_date = ?, renewed_at = ?, updated_at = ? WHERE id = ?',
      [newExpiryDate, renewedOn, nowTimestamp(), id],
    );
    await recomputeFireDates(db, id, newExpiryDate);
  });

  return getItem(db, id);
}

/**
 * Hides the item from the vault without destroying it. Reversible, unlike
 * `deleteItem`, and the timestamp records when.
 */
export async function archiveItem(db: Database, id: string): Promise<Item | null> {
  const timestamp = nowTimestamp();
  await db.runAsync('UPDATE items SET archived_at = ?, updated_at = ? WHERE id = ?', [
    timestamp,
    timestamp,
    id,
  ]);

  return getItem(db, id);
}

export async function unarchiveItem(db: Database, id: string): Promise<Item | null> {
  await db.runAsync('UPDATE items SET archived_at = NULL, updated_at = ? WHERE id = ?', [
    nowTimestamp(),
    id,
  ]);

  return getItem(db, id);
}

export async function listArchivedItems(db: Database): Promise<Item[]> {
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT ${COLUMNS} FROM items WHERE archived_at IS NOT NULL ORDER BY archived_at DESC`,
  );

  return rows.map(toItem);
}

/**
 * Deletes the item; every child row cascades with it.
 *
 * Note that attachment **files** live outside the database and are not touched
 * here — callers must also call `deleteItemAttachments`. `deleteItemWithFiles`
 * in `src/features/item-detail` does both.
 */
export async function deleteItem(db: Database, id: string): Promise<boolean> {
  const { changes } = await db.runAsync('DELETE FROM items WHERE id = ?', [id]);

  return changes > 0;
}

/** The three dashboard status tiles, in one pass over the expiry index. */
export async function countItemsByStatus(
  db: Database,
  window: StatusWindow,
): Promise<Record<DocumentStatus, number>> {
  const row = await db.getFirstAsync<{
    expired: number;
    soon: number;
    safe: number;
  }>(
    `SELECT
       SUM(CASE WHEN expiry_date < ? THEN 1 ELSE 0 END) AS expired,
       SUM(CASE WHEN expiry_date >= ? AND expiry_date <= ? THEN 1 ELSE 0 END) AS soon,
       SUM(CASE WHEN expiry_date > ? THEN 1 ELSE 0 END) AS safe
     FROM items WHERE ${ACTIVE_ONLY}`,
    [window.today, window.today, window.soonEnd, window.soonEnd],
  );

  return {
    // SUM over an empty table is NULL, not 0.
    expired: row?.expired ?? 0,
    soon: row?.soon ?? 0,
    safe: row?.safe ?? 0,
  };
}

/** Counts for the dashboard's category filter chips. */
export async function countItemsByCategory(
  db: Database,
): Promise<Partial<Record<DocumentCategory, number>>> {
  const rows = await db.getAllAsync<{
    category: DocumentCategory;
    count: number;
  }>(
    `SELECT category, COUNT(*) AS count FROM items
     WHERE ${ACTIVE_ONLY} GROUP BY category ORDER BY category`,
  );

  return Object.fromEntries(rows.map((row) => [row.category, row.count]));
}

export async function countItems(db: Database): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM items WHERE ${ACTIVE_ONLY}`,
  );

  return row?.count ?? 0;
}

/** The "Next renewal" readout: the soonest item that has not already expired. */
export async function getNextExpiringItem(db: Database, today: IsoDate): Promise<Item | null> {
  const row = await db.getFirstAsync<ItemRow>(
    `SELECT ${COLUMNS} FROM items
     WHERE ${ACTIVE_ONLY} AND expiry_date >= ?
     ORDER BY expiry_date ASC, title ASC LIMIT 1`,
    [today],
  );

  return row === null ? null : toItem(row);
}

/** Items with no reminder rule at all — the "Missing Alerts" vault-health count. */
export async function countItemsWithoutReminders(db: Database): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM items
     WHERE ${ACTIVE_ONLY}
       AND NOT EXISTS (SELECT 1 FROM reminder_rules WHERE reminder_rules.item_id = items.id)`,
  );

  return row?.count ?? 0;
}
