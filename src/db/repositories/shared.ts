import * as Crypto from 'expo-crypto';

import type { IsoTimestamp } from '../models';

/**
 * Helpers every repository shares. Kept deliberately small: the mapping between
 * a row and a domain object is written out explicitly per repository, so no
 * repository guesses at a shape.
 */

/** A cryptographically random v4 UUID, used for every primary key. */
export function newId(): string {
  return Crypto.randomUUID();
}

/** The audit-column format: full ISO-8601 UTC, distinct from date-only columns. */
export function nowTimestamp(): IsoTimestamp {
  return new Date().toISOString();
}

/** SQLite has no boolean type; the schema stores 0/1 with a CHECK constraint. */
export function toSqlBoolean(value: boolean): number {
  return value ? 1 : 0;
}

export function fromSqlBoolean(value: number): boolean {
  return value === 1;
}

/** Normalises an optional string field to the `null` the schema expects. */
export function orNull(value: string | null | undefined): string | null {
  return value ?? null;
}
