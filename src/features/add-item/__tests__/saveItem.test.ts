import { attachmentsRepository, itemsRepository, reminderRulesRepository } from '@/db';
import { createMigratedTestDatabase } from '@/db/testing/betterSqlite3';
import type { Database } from '@/db/types';
import { addDays, todayLocal } from '@/features/expiry';
import type { StoredFile } from '@/services/attachmentStorage';

import type { AddItemValues } from '../schema';
import { saveNewItem } from '../saveItem';

/**
 * Runs against a real migrated SQLite database, so the transaction, the
 * constraints and the cascade behaviour are genuinely exercised. The filesystem
 * is injected rather than mocked at module level, which keeps the failure paths
 * easy to drive.
 */

let db: Database;
const today = todayLocal();

function at(days: number): string {
  return addDays(today, days);
}

function values(overrides: Partial<AddItemValues> = {}): AddItemValues {
  return {
    category: 'passport',
    title: 'US Passport',
    expiryDate: at(1000),
    reminderOffsets: [180, 30, 7],
    escalationEnabled: true,
    attachments: [],
    ...overrides,
  } as AddItemValues;
}

function storedFrom(itemId: string, sources: readonly { fileName: string }[]): StoredFile[] {
  return sources.map((source) => ({
    uri: `file:///documents/attachments/${itemId}/${source.fileName}`,
    fileName: source.fileName,
    mimeType: 'image/jpeg',
    byteSize: 1024,
  }));
}

beforeEach(async () => {
  db = await createMigratedTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

describe('saving the item', () => {
  it('writes every field through to the row', async () => {
    const item = await saveNewItem(
      db,
      values({
        issuer: 'Dept of State',
        documentNumber: 'P492019',
        country: 'US',
        issueDate: at(-1000),
        escalationEnabled: false,
      }),
      { today },
    );

    await expect(itemsRepository.getItem(db, item.id)).resolves.toMatchObject({
      title: 'US Passport',
      category: 'passport',
      issuer: 'Dept of State',
      documentNumber: 'P492019',
      country: 'US',
      escalationEnabled: false,
    });
  });

  it('stores absent optionals as null rather than empty strings', async () => {
    const item = await saveNewItem(db, values(), { today });

    await expect(itemsRepository.getItem(db, item.id)).resolves.toMatchObject({
      issuer: null,
      documentNumber: null,
      country: null,
      issueDate: null,
    });
  });
});

describe('reminder rules', () => {
  it('creates one rule per offset, furthest out first', async () => {
    const item = await saveNewItem(db, values(), { today });

    const rules = await reminderRulesRepository.listReminderRulesForItem(db, item.id);

    expect(rules.map((rule) => rule.offsetDays)).toEqual([180, 30, 7]);
  });

  it('derives each fire date from the expiry', async () => {
    const expiryDate = at(1000);
    const item = await saveNewItem(db, values({ expiryDate }), { today });

    const rules = await reminderRulesRepository.listReminderRulesForItem(db, item.id);

    expect(rules.map((rule) => rule.fireDate)).toEqual([
      addDays(expiryDate, -180),
      addDays(expiryDate, -30),
      addDays(expiryDate, -7),
    ]);
  });

  it('drops offsets that would fire in the past', async () => {
    // Expires in 10 days: the 180- and 30-day reminders are already overdue.
    const item = await saveNewItem(
      db,
      values({ expiryDate: at(10), reminderOffsets: [180, 30, 7] }),
      { today },
    );

    const rules = await reminderRulesRepository.listReminderRulesForItem(db, item.id);

    expect(rules.map((rule) => rule.offsetDays)).toEqual([7]);
  });

  it('creates no rules when every offset is in the past', async () => {
    const item = await saveNewItem(
      db,
      values({ expiryDate: at(-30), reminderOffsets: [180, 30, 7] }),
      { today },
    );

    await expect(reminderRulesRepository.listReminderRulesForItem(db, item.id)).resolves.toEqual(
      [],
    );
  });

  it('creates no rules when the user chose none', async () => {
    const item = await saveNewItem(db, values({ reminderOffsets: [] }), { today });

    await expect(reminderRulesRepository.listReminderRulesForItem(db, item.id)).resolves.toEqual(
      [],
    );
  });
});

describe('attachments', () => {
  const picked = [
    { uri: 'file:///tmp/a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg', byteSize: 10 },
    { uri: 'file:///tmp/b.jpg', fileName: 'b.jpg', mimeType: 'image/jpeg', byteSize: 20 },
  ];

  it('links stored files to the item in pick order', async () => {
    const storeFiles = jest.fn(async (itemId: string, sources: readonly { fileName: string }[]) =>
      storedFrom(itemId, sources),
    );

    const item = await saveNewItem(db, values({ attachments: picked }), { storeFiles, today });

    const rows = await attachmentsRepository.listAttachmentsForItem(db, item.id);

    expect(rows.map((row) => row.fileName)).toEqual(['a.jpg', 'b.jpg']);
    expect(rows.map((row) => row.sortOrder)).toEqual([0, 1]);
    expect(rows[0].byteSize).toBe(1024);
  });

  it('does not touch the filesystem when there is nothing to store', async () => {
    const storeFiles = jest.fn();

    await saveNewItem(db, values({ attachments: [] }), { storeFiles, today });

    expect(storeFiles).not.toHaveBeenCalled();
  });
});

describe('rollback', () => {
  it('removes the item and its children when copying files fails', async () => {
    const storeFiles = jest.fn(async () => {
      throw new Error('disk full');
    });
    const deleteFiles = jest.fn(async () => undefined);

    await expect(
      saveNewItem(
        db,
        values({
          attachments: [
            { uri: 'file:///tmp/a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg', byteSize: 10 },
          ],
        }),
        { storeFiles, deleteFiles, today },
      ),
    ).rejects.toThrow('disk full');

    await expect(itemsRepository.countItems(db)).resolves.toBe(0);
    const orphanRules = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM reminder_rules',
    );
    expect(orphanRules?.count).toBe(0);
    expect(deleteFiles).toHaveBeenCalledWith(expect.any(String));
  });

  it('removes the item when writing an attachment row fails', async () => {
    const storeFiles = jest.fn(async (itemId: string) => [
      {
        // An empty file name violates the attachments CHECK constraint.
        uri: `file:///documents/attachments/${itemId}/x.jpg`,
        fileName: '   ',
        mimeType: 'image/jpeg',
        byteSize: 10,
      },
    ]);
    const deleteFiles = jest.fn(async () => undefined);

    await expect(
      saveNewItem(
        db,
        values({
          attachments: [
            { uri: 'file:///tmp/a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg', byteSize: 10 },
          ],
        }),
        { storeFiles, deleteFiles, today },
      ),
    ).rejects.toThrow(/CHECK constraint/);

    await expect(itemsRepository.countItems(db)).resolves.toBe(0);
    expect(deleteFiles).toHaveBeenCalled();
  });

  it('leaves nothing behind when the item itself is invalid', async () => {
    await expect(saveNewItem(db, values({ title: '   ' }), { today })).rejects.toThrow(
      /CHECK constraint/,
    );

    await expect(itemsRepository.countItems(db)).resolves.toBe(0);
  });
});
