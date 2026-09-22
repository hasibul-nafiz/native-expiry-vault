import {
  attachmentsRepository,
  itemNotesRepository,
  itemsRepository,
  reminderRulesRepository,
  renewalsRepository,
  renewalTasksRepository,
} from '@/db';
import { createMigratedTestDatabase } from '@/db/testing/betterSqlite3';
import type { Database } from '@/db/types';
import { addDays, todayLocal } from '@/features/expiry';

import { deleteItemWithFiles } from '../deleteItem';

/**
 * Deleting is the one irreversible action in the app, so what it removes — and
 * what it leaves alone — is asserted exhaustively.
 */

let db: Database;
let itemId: string;
let deleteFiles: jest.Mock<Promise<void>, [itemId: string]>;

const today = todayLocal();

/** An item with one of every kind of child record. */
async function givenAFullyPopulatedItem(): Promise<string> {
  const item = await itemsRepository.createItem(db, {
    title: 'German Residence Permit',
    category: 'visa',
    expiryDate: addDays(today, 18),
  });

  await reminderRulesRepository.createReminderRules(db, item.id, item.expiryDate, [30, 7]);
  await attachmentsRepository.createAttachment(db, {
    itemId: item.id,
    fileUri: `file:///documents/attachments/${item.id}/front.jpg`,
    fileName: 'front.jpg',
    mimeType: 'image/jpeg',
    byteSize: 2048,
  });
  await itemNotesRepository.createItemNote(db, item.id, 'Appointment', 'Ref #ABH-99201');
  await renewalTasksRepository.createRenewalTask(db, { itemId: item.id, title: 'Book slot' });
  await itemsRepository.markItemRenewed(db, item.id, addDays(today, 1000), today);

  return item.id;
}

async function countIn(table: string): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`);

  return row?.count ?? 0;
}

beforeEach(async () => {
  db = await createMigratedTestDatabase();
  deleteFiles = jest.fn(async (_itemId: string) => undefined);
  itemId = await givenAFullyPopulatedItem();
});

afterEach(async () => {
  await db.closeAsync();
});

describe('deleting a document', () => {
  it('reports that it removed something', async () => {
    await expect(deleteItemWithFiles(db, itemId, { deleteFiles })).resolves.toBe(true);
  });

  it('removes the item itself', async () => {
    await deleteItemWithFiles(db, itemId, { deleteFiles });

    await expect(itemsRepository.getItem(db, itemId)).resolves.toBeNull();
  });

  it.each(['reminder_rules', 'attachments', 'item_notes', 'renewal_tasks', 'renewals'])(
    'cascades every row in %s',
    async (table) => {
      // Guard: the fixture really did create one.
      expect(await countIn(table)).toBeGreaterThan(0);

      await deleteItemWithFiles(db, itemId, { deleteFiles });

      await expect(countIn(table)).resolves.toBe(0);
    },
  );

  it('removes the attachment files, which no cascade can reach', async () => {
    await deleteItemWithFiles(db, itemId, { deleteFiles });

    expect(deleteFiles).toHaveBeenCalledTimes(1);
    expect(deleteFiles).toHaveBeenCalledWith(itemId);
  });

  it('leaves other documents alone', async () => {
    const other = await itemsRepository.createItem(db, {
      title: 'US Passport',
      category: 'passport',
      expiryDate: addDays(today, 400),
    });

    await deleteItemWithFiles(db, itemId, { deleteFiles });

    await expect(itemsRepository.getItem(db, other.id)).resolves.not.toBeNull();
    await expect(itemsRepository.countItems(db)).resolves.toBe(1);
  });
});

describe('deleting something that is not there', () => {
  it('reports false rather than throwing', async () => {
    await expect(deleteItemWithFiles(db, 'ghost', { deleteFiles })).resolves.toBe(false);
  });

  it('does not touch the filesystem', async () => {
    await deleteItemWithFiles(db, 'ghost', { deleteFiles });

    expect(deleteFiles).not.toHaveBeenCalled();
  });

  it('leaves the real item intact', async () => {
    await deleteItemWithFiles(db, 'ghost', { deleteFiles });

    await expect(itemsRepository.getItem(db, itemId)).resolves.not.toBeNull();
  });
});

describe('deleting an archived document', () => {
  it('works the same way', async () => {
    await itemsRepository.archiveItem(db, itemId);

    await expect(deleteItemWithFiles(db, itemId, { deleteFiles })).resolves.toBe(true);
    await expect(itemsRepository.getItem(db, itemId)).resolves.toBeNull();
    expect(deleteFiles).toHaveBeenCalledWith(itemId);
  });
});

describe('when removing the files fails', () => {
  it('propagates, having already removed the row', async () => {
    const failing = jest.fn(async () => {
      throw new Error('permission denied');
    });

    await expect(deleteItemWithFiles(db, itemId, { deleteFiles: failing })).rejects.toThrow(
      'permission denied',
    );

    // The row is gone; the bytes are orphaned rather than the reverse, which is
    // the safer of the two failure modes.
    await expect(itemsRepository.getItem(db, itemId)).resolves.toBeNull();
  });
});

describe('renewal history survives until deletion', () => {
  it('is present before and absent after', async () => {
    await expect(renewalsRepository.countRenewals(db, itemId)).resolves.toBe(1);

    await deleteItemWithFiles(db, itemId, { deleteFiles });

    await expect(renewalsRepository.countRenewals(db, itemId)).resolves.toBe(0);
  });
});
