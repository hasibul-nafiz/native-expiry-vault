import type { Migration } from '../types';

/**
 * Archiving and renewal history.
 *
 * Two things F6 needs had no home in migration 001:
 *
 * - **Archive.** A nullable timestamp rather than a boolean, so the record keeps
 *   *when* it was archived. `NULL` means active.
 * - **Renewal history.** `items.renewed_at` holds only the most recent renewal
 *   and is overwritten each time, so past renewals were unrecoverable.
 *
 * As in 001 the SQL is written out literally: a migration is history, and a
 * shared helper edited later would silently rewrite what version 2 means for
 * databases that already ran it.
 *
 * Unlike 001's other `*_at` columns, `archived_at` carries a format CHECK. The
 * stricter constraint is deliberate — it is new, so nothing existing can violate
 * it, and it matches exactly what `nowTimestamp()` produces.
 */
export const migration002: Migration = {
  version: 2,
  name: 'archive-and-renewals',
  statements: [
    `ALTER TABLE items ADD COLUMN archived_at TEXT CHECK (
      archived_at IS NULL
      OR archived_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'
    )`,

    `CREATE TABLE renewals (
      id TEXT PRIMARY KEY NOT NULL,
      item_id TEXT NOT NULL REFERENCES items (id) ON DELETE CASCADE,
      previous_expiry_date TEXT NOT NULL CHECK (
        previous_expiry_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        AND date(previous_expiry_date) IS previous_expiry_date
      ),
      new_expiry_date TEXT NOT NULL CHECK (
        new_expiry_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        AND date(new_expiry_date) IS new_expiry_date
      ),
      renewed_on TEXT NOT NULL CHECK (
        renewed_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        AND date(renewed_on) IS renewed_on
      ),
      note TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX idx_renewals_item_id ON renewals (item_id, renewed_on DESC)`,

    // Every dashboard query filters to active items, so the index does too.
    `CREATE INDEX idx_items_active_expiry ON items (expiry_date) WHERE archived_at IS NULL`,
  ],
};
