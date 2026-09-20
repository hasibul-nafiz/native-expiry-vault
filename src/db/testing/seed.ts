import { itemsRepository, reminderRulesRepository } from '../index';
import type { NewItem } from '../models';
import type { Database } from '../types';

import { addDays, DEFAULT_REMINDER_OFFSETS, todayLocal } from '@/features/expiry';

/**
 * Sample data for looking at a populated screen during development.
 *
 * Reachable only from the `__DEV__`-gated dev gallery route and never imported
 * by a feature, so no mock data reaches the shipped dashboard. Offsets are
 * relative to today so the sample always spans all three status bands.
 */

function sampleItems(): NewItem[] {
  const today = todayLocal();
  const at = (days: number) => addDays(today, days);

  return [
    {
      title: 'US Passport',
      category: 'passport',
      issuer: 'Dept of State',
      country: 'US',
      issueDate: at(-1600),
      expiryDate: at(1642),
    },
    {
      title: 'EU Blue Card',
      category: 'visa',
      issuer: 'Berlin LEA',
      country: 'DE',
      issueDate: at(-700),
      expiryDate: at(389),
    },
    {
      title: 'Global Health Cover',
      category: 'health',
      issuer: 'Allianz Worldwide',
      country: 'DE',
      issueDate: at(-294),
      expiryDate: at(71),
    },
    {
      title: 'Residence Permit',
      category: 'visa',
      issuer: 'Friedrich-Krause-Ufer',
      country: 'DE',
      issueDate: at(-1077),
      expiryDate: at(18),
      isVital: true,
    },
    {
      title: 'Driving Permit',
      category: 'license',
      issuer: 'AAA Federation',
      country: 'US',
      issueDate: at(-1850),
      expiryDate: at(-25),
    },
    {
      title: 'MacBook Warranty',
      category: 'warranty',
      issuer: 'Apple',
      country: 'US',
      issueDate: at(-1000),
      expiryDate: at(-4),
    },
  ];
}

/** Inserts the sample set, with default reminders, and returns how many were added. */
export async function seedSampleData(db: Database): Promise<number> {
  const items = sampleItems();

  for (const input of items) {
    const item = await itemsRepository.createItem(db, input);
    await reminderRulesRepository.createReminderRules(
      db,
      item.id,
      item.expiryDate,
      DEFAULT_REMINDER_OFFSETS,
    );
  }

  return items.length;
}

/** Removes every item, cascading to reminders, attachments and the rest. */
export async function clearAllData(db: Database): Promise<void> {
  await db.runAsync('DELETE FROM items');
}
