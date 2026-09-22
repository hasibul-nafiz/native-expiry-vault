import type { Migration } from '../types';

import { migration001 } from './001-initial';
import { migration002 } from './002-archive-and-renewals';

/**
 * The single registry of schema versions, in ascending order. Append only —
 * never edit or reorder a migration that has shipped.
 */
export const migrations: readonly Migration[] = [migration001, migration002];

/** The version a fully migrated database reports in `PRAGMA user_version`. */
export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1].version;
