import type { IsoDate } from '@/db/models';

import { addDays, compareDates } from './dates';

/**
 * The offsets the add-item flow presets as "6 Months / 3 Months / 30 Days /
 * 7 Days Before". Kept here as a typed constant rather than a database table:
 * making these user-configurable is F11 Settings' job, and it will add its own
 * table via a later migration.
 */
export const DEFAULT_REMINDER_OFFSETS: readonly number[] = [180, 90, 30, 7];

/**
 * The local hour reminders are delivered at. A constant for the same reason the
 * offsets are: a user-configurable delivery time belongs to F11 Settings, and
 * the export's "Delivery Time / 09:00 AM" is static text with no control behind
 * it.
 */
export const DEFAULT_REMINDER_HOUR = 9;

/** The date a reminder `offsetDays` before expiry should fire on. */
export function fireDateFor(expiryDate: IsoDate, offsetDays: number): IsoDate {
  if (!Number.isInteger(offsetDays) || offsetDays < 0) {
    throw new RangeError(`Reminder offset must be a non-negative integer, got ${offsetDays}.`);
  }

  return addDays(expiryDate, -offsetDays);
}

/**
 * Offsets whose fire date has not already passed, so an item added a week before
 * its expiry does not schedule four reminders in the past.
 *
 * A fire date landing exactly on `today` is kept: the reminder is still due.
 */
export function applicableOffsets(
  expiryDate: IsoDate,
  today: IsoDate,
  offsets: readonly number[] = DEFAULT_REMINDER_OFFSETS,
): number[] {
  return offsets
    .filter((offset) => compareDates(fireDateFor(expiryDate, offset), today) >= 0)
    .sort((a, b) => b - a);
}
