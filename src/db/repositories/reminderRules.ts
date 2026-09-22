import { fireDateFor } from '@/features/expiry/reminders';

import type { IsoDate, IsoTimestamp, ReminderRule } from '../models';
import type { Database } from '../types';

import { fromSqlBoolean, newId, nowTimestamp, toSqlBoolean } from './shared';

/**
 * Reminder rules. `fire_date` is stored rather than computed per query so F7's
 * scheduler can find due reminders with an indexed range scan; it is always
 * written by `fireDateFor`, and `updateItem`/`markItemRenewed` recompute it
 * whenever an expiry date moves.
 */

interface ReminderRuleRow {
  id: string;
  item_id: string;
  offset_days: number;
  enabled: number;
  fire_date: string;
  delivered_at: string | null;
  notification_id: string | null;
  created_at: string;
}

const COLUMNS =
  'id, item_id, offset_days, enabled, fire_date, delivered_at, notification_id, created_at';

function toReminderRule(row: ReminderRuleRow): ReminderRule {
  return {
    id: row.id,
    itemId: row.item_id,
    offsetDays: row.offset_days,
    enabled: fromSqlBoolean(row.enabled),
    fireDate: row.fire_date,
    deliveredAt: row.delivered_at,
    notificationId: row.notification_id,
    createdAt: row.created_at,
  };
}

export async function createReminderRule(
  db: Database,
  itemId: string,
  expiryDate: IsoDate,
  offsetDays: number,
  enabled = true,
): Promise<ReminderRule> {
  const id = newId();

  await db.runAsync(`INSERT INTO reminder_rules (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
    id,
    itemId,
    offsetDays,
    toSqlBoolean(enabled),
    fireDateFor(expiryDate, offsetDays),
    null,
    null,
    nowTimestamp(),
  ]);

  const created = await getReminderRule(db, id);

  if (created === null) {
    throw new Error(`Reminder rule ${id} disappeared immediately after insert.`);
  }

  return created;
}

/** Creates one rule per offset in a single transaction. */
export async function createReminderRules(
  db: Database,
  itemId: string,
  expiryDate: IsoDate,
  offsets: readonly number[],
): Promise<ReminderRule[]> {
  await db.withTransactionAsync(async () => {
    for (const offset of offsets) {
      await db.runAsync(`INSERT INTO reminder_rules (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
        newId(),
        itemId,
        offset,
        toSqlBoolean(true),
        fireDateFor(expiryDate, offset),
        null,
        null,
        nowTimestamp(),
      ]);
    }
  });

  return listReminderRulesForItem(db, itemId);
}

export async function getReminderRule(db: Database, id: string): Promise<ReminderRule | null> {
  const row = await db.getFirstAsync<ReminderRuleRow>(
    `SELECT ${COLUMNS} FROM reminder_rules WHERE id = ?`,
    [id],
  );

  return row === null ? null : toReminderRule(row);
}

export async function listReminderRulesForItem(
  db: Database,
  itemId: string,
): Promise<ReminderRule[]> {
  const rows = await db.getAllAsync<ReminderRuleRow>(
    `SELECT ${COLUMNS} FROM reminder_rules WHERE item_id = ? ORDER BY offset_days DESC`,
    [itemId],
  );

  return rows.map(toReminderRule);
}

/**
 * Rules belonging to an active document. Archived documents are hidden from the
 * vault, so their reminders must be silent too — without the join an archived
 * passport still notifies, which is the gap F6 left behind for this feature.
 *
 * The prefix is needed because `id` and `item_id` exist on both sides of the
 * join.
 */
const ACTIVE_ITEM_JOIN = `FROM reminder_rules r
     JOIN items i ON i.id = r.item_id AND i.archived_at IS NULL`;

const PREFIXED_COLUMNS = COLUMNS.split(', ')
  .map((column) => `r.${column}`)
  .join(', ');

/**
 * Every rule the scheduler could act on: enabled, not yet delivered, and
 * attached to a document that is still in the vault.
 *
 * Past-dated rules are included deliberately. They cannot be scheduled, but the
 * engine needs to see them to mark them delivered; filtering them out here
 * would leave them undelivered and reconsidered on every launch forever.
 */
export async function listSchedulableRules(db: Database): Promise<ReminderRule[]> {
  const rows = await db.getAllAsync<ReminderRuleRow>(
    `SELECT ${PREFIXED_COLUMNS} ${ACTIVE_ITEM_JOIN}
     WHERE r.enabled = 1 AND r.delivered_at IS NULL
     ORDER BY r.fire_date ASC`,
  );

  return rows.map(toReminderRule);
}

export async function setReminderRuleEnabled(
  db: Database,
  id: string,
  enabled: boolean,
): Promise<boolean> {
  const { changes } = await db.runAsync('UPDATE reminder_rules SET enabled = ? WHERE id = ?', [
    toSqlBoolean(enabled),
    id,
  ]);

  return changes > 0;
}

/** Records that the notification actually went out, so it is not re-sent. */
export async function markReminderDelivered(
  db: Database,
  id: string,
  deliveredAt: IsoTimestamp = nowTimestamp(),
): Promise<boolean> {
  const { changes } = await db.runAsync('UPDATE reminder_rules SET delivered_at = ? WHERE id = ?', [
    deliveredAt,
    id,
  ]);

  return changes > 0;
}

/** Stores the expo-notifications handle so the rule can be cancelled later. */
export async function setReminderNotificationId(
  db: Database,
  id: string,
  notificationId: string | null,
): Promise<boolean> {
  const { changes } = await db.runAsync(
    'UPDATE reminder_rules SET notification_id = ? WHERE id = ?',
    [notificationId, id],
  );

  return changes > 0;
}

/**
 * Forgets every stored notification handle.
 *
 * Deliberately unfiltered. The scheduler cancels all pending notifications in
 * one call, which invalidates handles on rules it can no longer see — an
 * archived document's, for instance, which is excluded from
 * `listSchedulableRules`. Clearing only what the scheduler is about to rewrite
 * would leave those rules pointing at notifications that no longer exist.
 */
export async function clearAllNotificationIds(db: Database): Promise<number> {
  const { changes } = await db.runAsync(
    'UPDATE reminder_rules SET notification_id = NULL WHERE notification_id IS NOT NULL',
  );

  return changes;
}

export async function deleteReminderRule(db: Database, id: string): Promise<boolean> {
  const { changes } = await db.runAsync('DELETE FROM reminder_rules WHERE id = ?', [id]);

  return changes > 0;
}
