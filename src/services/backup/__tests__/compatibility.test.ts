import { utf8ToBytes } from '@noble/hashes/utils.js';

import { backupRepository, itemsRepository, type Database } from '@/db';
import { createMigratedTestDatabase } from '@/db/testing/betterSqlite3';

import { BackupError } from '../errors';
import { openBackup } from '../importVault';
import { migrateBackupPayload, type PayloadMigration } from '../migrations';
import { restoreVault } from '../restoreVault';
import { createFakeFileSystem } from '../testing';
import { PAYLOAD_VERSION } from '../types';

import { V1_CONTAINER_PASSWORD, v1ContainerBytes } from './fixtures/v1Container';

/**
 * Backwards compatibility.
 *
 * A backup file outlives the build that wrote it — someone restores a phone two
 * years later from a file an old version produced. These tests are the ones
 * that fail when a change to the format quietly breaks that.
 *
 * The fixture is a real container written when F12 shipped, not one this run
 * regenerated. A regenerated fixture proves only that today's code agrees with
 * itself.
 */

let db: Database;

beforeEach(async () => {
  db = await createMigratedTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

describe('a version 1 file written by the build that shipped F12', () => {
  it('still opens', () => {
    const { payload, preview } = openBackup(v1ContainerBytes(), V1_CONTAINER_PASSWORD);

    expect(payload.payloadVersion).toBe(1);
    expect(preview.itemCount).toBe(1);
    expect(preview.attachmentCount).toBe(1);
    expect(preview.migrated).toBe(false);
  });

  it('still restores, rows and bytes alike', async () => {
    const fileSystem = createFakeFileSystem();
    const backup = openBackup(v1ContainerBytes(), V1_CONTAINER_PASSWORD);

    const result = await restoreVault({ db, backup, fileSystem });

    expect(result).toEqual({ itemCount: 1, attachmentCount: 1, missingFiles: [] });

    const { items, attachments, tags, itemTags, travelStays } =
      await backupRepository.readAllTables(db);

    expect(items[0]).toMatchObject({
      id: 'item-1',
      title: 'Passport',
      category: 'passport',
      country: 'GB',
      expiryDate: '2030-01-14',
      isVital: true,
    });
    expect(attachments[0].fileName).toBe('scan.jpg');
    expect(tags[0].label).toBe('Travel');
    expect(itemTags).toEqual([{ itemId: 'item-1', tagId: 'tag-1' }]);
    expect(travelStays[0].entryDate).toBe('2026-03-01');

    expect(await fileSystem.readAttachment(attachments[0].fileUri)).toEqual(
      utf8ToBytes('frozen-v1-attachment-bytes'),
    );
  });

  it('still carries its preferences', () => {
    const { payload } = openBackup(v1ContainerBytes(), V1_CONTAINER_PASSWORD);

    expect(payload.preferences).toEqual({
      theme: 'system',
      language: 'system',
      reminderHour: 9,
      autoLockDelayMs: 60_000,
      biometricUnlock: true,
    });
  });

  it('is still refused under the wrong password', () => {
    try {
      openBackup(v1ContainerBytes(), 'not the passphrase');
      throw new Error('should not open');
    } catch (error) {
      expect((error as BackupError).reason).toBe('wrong-password');
    }
  });

  it('replaces whatever was in the vault, as any restore does', async () => {
    await itemsRepository.createItem(db, {
      title: 'Already here',
      category: 'other',
      expiryDate: '2028-01-01',
    });

    await restoreVault({
      db,
      backup: openBackup(v1ContainerBytes(), V1_CONTAINER_PASSWORD),
      fileSystem: createFakeFileSystem(),
    });

    const titles = (await itemsRepository.listItems(db, { includeArchived: true })).map(
      (item) => item.title,
    );

    expect(titles).toEqual(['Passport']);
  });
});

/**
 * The same fixture, put through a migration chain the test supplies.
 *
 * This is what the day a version 2 arrives will look like: the committed v1
 * file goes in, a step runs, and a current payload comes out. Writing it now
 * means the machinery is proven before it is needed rather than after.
 */
describe('when a version 2 eventually exists', () => {
  const toV2: PayloadMigration = {
    version: 2,
    name: 'add-vault-label',
    migrate: (payload) => ({ ...payload, vaultLabel: 'restored from v1' }),
  };

  it('carries the frozen v1 payload forward', () => {
    const { payload } = openBackup(v1ContainerBytes(), V1_CONTAINER_PASSWORD);
    const outcome = migrateBackupPayload(payload, [toV2], 2);

    expect(outcome.migrated).toBe(true);
    expect(outcome.payload.payloadVersion).toBe(2);
    expect(outcome.payload.vaultLabel).toBe('restored from v1');
    // Everything the v1 file held is still there afterwards.
    expect(outcome.payload.tables).toEqual(payload.tables);
  });

  it('leaves a v1 file alone while the target is still 1', () => {
    const { payload } = openBackup(v1ContainerBytes(), V1_CONTAINER_PASSWORD);

    expect(migrateBackupPayload(payload, [], PAYLOAD_VERSION).migrated).toBe(false);
  });
});
