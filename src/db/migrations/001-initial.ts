import type { Migration } from '../types';

/**
 * Initial schema.
 *
 * The SQL here is written out literally rather than assembled from helpers: a
 * migration is history, and a shared helper edited later would silently rewrite
 * what version 1 means for databases that already ran it.
 *
 * Date-only columns are validated by `col GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
 * AND date(col) IS col`. The GLOB fixes the shape and the `date()` round-trip
 * rejects impossible calendar dates — SQLite normalises `2026-02-30` to
 * `2026-03-02`, so a value that survives the round-trip is genuinely real. `IS`
 * rather than `=` because a CHECK whose expression evaluates to NULL passes, and
 * `date('2026-13-01')` is NULL.
 */
export const migration001: Migration = {
  version: 1,
  name: 'initial',
  statements: [
    `CREATE TABLE items (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL CHECK (length(trim(title)) > 0),
      category TEXT NOT NULL CHECK (category IN (
        'passport', 'visa', 'health', 'license', 'warranty', 'contract', 'other'
      )),
      issuer TEXT,
      document_number TEXT,
      country TEXT CHECK (country IS NULL OR country GLOB '[A-Z][A-Z]'),
      issue_date TEXT CHECK (
        issue_date IS NULL
        OR (issue_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(issue_date) IS issue_date)
      ),
      expiry_date TEXT NOT NULL CHECK (
        expiry_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(expiry_date) IS expiry_date
      ),
      renewed_at TEXT CHECK (
        renewed_at IS NULL
        OR (renewed_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(renewed_at) IS renewed_at)
      ),
      is_vital INTEGER NOT NULL DEFAULT 0 CHECK (is_vital IN (0, 1)),
      escalation_enabled INTEGER NOT NULL DEFAULT 1 CHECK (escalation_enabled IN (0, 1)),
      ocr_confidence REAL CHECK (ocr_confidence IS NULL OR (ocr_confidence >= 0 AND ocr_confidence <= 1)),
      ocr_raw_text TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (issue_date IS NULL OR issue_date <= expiry_date)
    )`,
    `CREATE INDEX idx_items_expiry_date ON items (expiry_date)`,
    `CREATE INDEX idx_items_category ON items (category)`,

    `CREATE TABLE attachments (
      id TEXT PRIMARY KEY NOT NULL,
      item_id TEXT NOT NULL REFERENCES items (id) ON DELETE CASCADE,
      file_uri TEXT NOT NULL CHECK (length(trim(file_uri)) > 0),
      file_name TEXT NOT NULL CHECK (length(trim(file_name)) > 0),
      mime_type TEXT NOT NULL CHECK (length(trim(mime_type)) > 0),
      byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
      role TEXT NOT NULL DEFAULT 'other' CHECK (role IN ('front', 'back', 'other')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      sha256 TEXT CHECK (sha256 IS NULL OR sha256 GLOB '[0-9a-f]*'),
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX idx_attachments_item_id ON attachments (item_id, sort_order)`,

    `CREATE TABLE reminder_rules (
      id TEXT PRIMARY KEY NOT NULL,
      item_id TEXT NOT NULL REFERENCES items (id) ON DELETE CASCADE,
      offset_days INTEGER NOT NULL CHECK (offset_days >= 0),
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      fire_date TEXT NOT NULL CHECK (
        fire_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(fire_date) IS fire_date
      ),
      delivered_at TEXT,
      notification_id TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (item_id, offset_days)
    )`,
    `CREATE INDEX idx_reminder_rules_fire_date ON reminder_rules (fire_date) WHERE enabled = 1`,

    `CREATE TABLE item_notes (
      id TEXT PRIMARY KEY NOT NULL,
      item_id TEXT NOT NULL REFERENCES items (id) ON DELETE CASCADE,
      title TEXT NOT NULL CHECK (length(trim(title)) > 0),
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX idx_item_notes_item_id ON item_notes (item_id)`,

    `CREATE TABLE renewal_tasks (
      id TEXT PRIMARY KEY NOT NULL,
      item_id TEXT NOT NULL REFERENCES items (id) ON DELETE CASCADE,
      title TEXT NOT NULL CHECK (length(trim(title)) > 0),
      detail TEXT,
      due_date TEXT CHECK (
        due_date IS NULL
        OR (due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(due_date) IS due_date)
      ),
      done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX idx_renewal_tasks_item_id ON renewal_tasks (item_id, sort_order)`,

    `CREATE TABLE tags (
      id TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL UNIQUE CHECK (length(trim(label)) > 0),
      color TEXT,
      created_at TEXT NOT NULL
    )`,

    `CREATE TABLE item_tags (
      item_id TEXT NOT NULL REFERENCES items (id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
      PRIMARY KEY (item_id, tag_id)
    )`,
    `CREATE INDEX idx_item_tags_tag_id ON item_tags (tag_id)`,

    `CREATE TABLE travel_stays (
      id TEXT PRIMARY KEY NOT NULL,
      area TEXT NOT NULL DEFAULT 'schengen' CHECK (length(trim(area)) > 0),
      entry_date TEXT NOT NULL CHECK (
        entry_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(entry_date) IS entry_date
      ),
      exit_date TEXT CHECK (
        exit_date IS NULL
        OR (exit_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(exit_date) IS exit_date)
      ),
      note TEXT,
      created_at TEXT NOT NULL,
      CHECK (exit_date IS NULL OR exit_date >= entry_date)
    )`,
    `CREATE INDEX idx_travel_stays_area_entry ON travel_stays (area, entry_date)`,
  ],
};
