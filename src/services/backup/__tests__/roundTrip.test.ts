import { utf8ToBytes } from '@noble/hashes/utils.js';

import {
  attachmentsRepository,
  backupRepository,
  itemNotesRepository,
  itemsRepository,
  reminderRulesRepository,
  renewalTasksRepository,
  tagsRepository,
  travelStaysRepository,
  type Database,
} from '@/db';
import { createMigratedTestDatabase } from '@/db/testing/betterSqlite3';

import { exportVault } from '../exportVault';
import { openBackup } from '../importVault';
import { restoreVault } from '../restoreVault';
import { createFakeFileSystem, createFakeRandomBytes, type FakeBackupFileSystem } from '../testing';

/**
 * The round trip: a populated vault, exported, then restored into an empty one,
 * asserted table by table and byte for byte.
 *
 * The database is F2's in-memory better-sqlite3 adapter, so migrations, CHECK
 * constraints and foreign keys all execute for real — a restore that SQLite
 * would reject fails here rather than on a device.
 *
 * `ITERATIONS` is 10; the shipped cost is pinned in `crypto.test.ts`.
 */

const ITERATIONS = 10;
const PASSWORD = 'a perfectly adequate passphrase';
const NOW = new Date('2026-09-22T09:00:00.000Z');

const FRONT_BYTES = utf8ToBytes('front-image-bytes');
const BACK_BYTES = utf8ToBytes('back-image-bytes-which-are-longer');

let db: Database;
let fileSystem: FakeBackupFileSystem;

async function populate(database: Database): Promise<void> {
  const passport = await itemsRepository.createItem(database, {
    title: 'Passport',
    category: 'passport',
    expiryDate: '2030-01-14',
    issuer: 'HMPO',
    documentNumber: '123456789',
    country: 'GB',
    issueDate: '2020-01-15',
    isVital: true,
  });

  const visa = await itemsRepository.createItem(database, {
    title: 'Schengen visa',
    category: 'visa',
    expiryDate: '2027-03-01',
    country: 'DE',
  });

  const warranty = await itemsRepository.createItem(database, {
    title: 'Laptop warranty',
    category: 'warranty',
    expiryDate: '2026-11-30',
  });

  // An archived item, to prove archived records survive a round trip.
  await itemsRepository.archiveItem(database, warranty.id);

  // A renewal, which also writes a row into `renewals`.
  await itemsRepository.markItemRenewed(database, visa.id, '2028-03-01', '2026-09-20');

  await reminderRulesRepository.createReminderRules(database, passport.id, '2030-01-14', [90, 30, 7]);
  await itemNotesRepository.createItemNote(database, passport.id, 'Office', 'Book ahead.');
  await renewalTasksRepository.createRenewalTask(database, { itemId: passport.id, title: 'Photos' });

  const tag = await tagsRepository.createTag(database, 'Travel', 'primary');
  await tagsRepository.addTagToItem(database, passport.id, tag.id);
  await tagsRepository.addTagToItem(database, visa.id, tag.id);

  await travelStaysRepository.createTravelStay(database, {
    entryDate: '2026-03-01',
    exitDate: '2026-03-10',
  });
  await travelStaysRepository.createTravelStay(database, { entryDate: '2026-08-01' });

  await attachmentsRepository.createAttachment(database, {
    itemId: passport.id,
    fileUri: fileSystem.addLiveFile(`${passport.id}/front.jpg`, FRONT_BYTES),
    fileName: 'front.jpg',
    mimeType: 'image/jpeg',
    byteSize: FRONT_BYTES.length,
    role: 'front',
    sortOrder: 0,
  });

  await attachmentsRepository.createAttachment(database, {
    itemId: passport.id,
    fileUri: fileSystem.addLiveFile(`${passport.id}/back.jpg`, BACK_BYTES),
    fileName: 'back.jpg',
    mimeType: 'image/jpeg',
    byteSize: BACK_BYTES.length,
    role: 'back',
    sortOrder: 1,
  });
}

async function exportCurrentVault() {
  return exportVault({
    db,
    password: PASSWORD,
    preferences: {
      theme: 'dark',
      language: 'bn',
      reminderHour: 20,
      autoLockDelayMs: 300_000,
      biometricUnlock: false,
    },
    appVersion: '1.0.0',
    randomBytes: createFakeRandomBytes(),
    fileSystem,
    now: () => NOW,
    iterations: ITERATIONS,
  });
}

beforeEach(async () => {
  db = await createMigratedTestDatabase();
  fileSystem = createFakeFileSystem();
  await populate(db);
});

afterEach(async () => {
  await db.closeAsync();
});

describe('export', () => {
  it('writes a file named for the day it was taken', async () => {
    const result = await exportCurrentVault();

    expect(result.fileName).toBe('expiryvault-2026-09-22.evault');
    expect(result.byteSize).toBeGreaterThan(0);
    expect(fileSystem.exports.has(result.fileName)).toBe(true);
  });

  it('counts what it wrote', async () => {
    const result = await exportCurrentVault();

    expect(result.itemCount).toBe(3);
    expect(result.attachmentCount).toBe(2);
    expect(result.missingAttachments).toBe(0);
    expect(result.orphanFiles).toBe(0);
  });

  it('reports progress as it reads', async () => {
    const phases: string[] = [];
    await exportVault({
      db,
      password: PASSWORD,
      preferences: null,
      appVersion: '1.0.0',
      randomBytes: createFakeRandomBytes(),
      fileSystem,
      now: () => NOW,
      iterations: ITERATIONS,
      onProgress: ({ phase }) => phases.push(phase),
    });

    expect(phases).toEqual(['reading', 'reading', 'sealing', 'writing']);
  });

  /** The orphan reconciliation PROGRESS.md has had open since F5. */
  it('reports files under the attachments root that no row points at', async () => {
    fileSystem.addLiveFile('ghost-item/orphan.jpg', utf8ToBytes('nobody references this'));

    expect((await exportCurrentVault()).orphanFiles).toBe(1);
  });

  /** The other direction: a row whose file is gone. */
  it('drops an attachment row whose file has vanished, and says so', async () => {
    const [first] = await backupRepository
      .readAllTables(db)
      .then((tables) => tables.attachments);
    fileSystem.live.delete('front.jpg');
    fileSystem.live.delete(first.fileUri.split('/attachments/')[1]);

    const result = await exportCurrentVault();

    expect(result.missingAttachments).toBe(1);
    expect(result.attachmentCount).toBe(1);

    // And the backup must not restore a row pointing at nothing.
    const opened = openBackup(fileSystem.exports.get(result.fileName)!, PASSWORD);
    expect(opened.payload.tables.attachments).toHaveLength(1);
  });

  it('never carries a notification id to another device', async () => {
    await reminderRulesRepository.setReminderNotificationId(
      db,
      (await backupRepository.readAllTables(db)).reminderRules[0].id,
      'local-notification-42',
    );

    const result = await exportCurrentVault();
    const opened = openBackup(fileSystem.exports.get(result.fileName)!, PASSWORD);

    expect(opened.payload.tables.reminderRules.every((rule) => rule.notificationId === null)).toBe(
      true,
    );
  });
});

describe('round trip', () => {
  it('restores every table exactly as it was', async () => {
    const before = await backupRepository.readAllTables(db);
    const result = await exportCurrentVault();

    const fresh = await createMigratedTestDatabase();
    const opened = openBackup(fileSystem.exports.get(result.fileName)!, PASSWORD);
    await restoreVault({ db: fresh, backup: opened, fileSystem });

    const after = await backupRepository.readAllTables(fresh);

    expect(after.items).toEqual(before.items);
    expect(after.reminderRules).toEqual(before.reminderRules);
    expect(after.itemNotes).toEqual(before.itemNotes);
    expect(after.renewalTasks).toEqual(before.renewalTasks);
    expect(after.renewals).toEqual(before.renewals);
    expect(after.tags).toEqual(before.tags);
    expect(after.itemTags).toEqual(before.itemTags);
    expect(after.travelStays).toEqual(before.travelStays);
    expect(after.attachments).toEqual(before.attachments);

    await fresh.closeAsync();
  });

  it('restores the attachment bytes', async () => {
    const result = await exportCurrentVault();
    const fresh = await createMigratedTestDatabase();

    fileSystem.live.clear();
    const opened = openBackup(fileSystem.exports.get(result.fileName)!, PASSWORD);
    await restoreVault({ db: fresh, backup: opened, fileSystem });

    const { attachments } = await backupRepository.readAllTables(fresh);
    const front = attachments.find((attachment) => attachment.fileName === 'front.jpg');

    expect(await fileSystem.readAttachment(front!.fileUri)).toEqual(FRONT_BYTES);
    expect(fileSystem.live.size).toBe(2);

    await fresh.closeAsync();
  });

  it('keeps archived items archived', async () => {
    const result = await exportCurrentVault();
    const fresh = await createMigratedTestDatabase();
    await restoreVault({
      db: fresh,
      backup: openBackup(fileSystem.exports.get(result.fileName)!, PASSWORD),
      fileSystem,
    });

    const active = await itemsRepository.listItems(fresh);
    const all = await itemsRepository.listItems(fresh, { includeArchived: true });

    expect(active).toHaveLength(2);
    expect(all).toHaveLength(3);

    await fresh.closeAsync();
  });

  it('carries the preferences', async () => {
    const result = await exportCurrentVault();
    const opened = openBackup(fileSystem.exports.get(result.fileName)!, PASSWORD);

    expect(opened.payload.preferences).toEqual({
      theme: 'dark',
      language: 'bn',
      reminderHour: 20,
      autoLockDelayMs: 300_000,
      biometricUnlock: false,
    });
  });

  it('describes itself for the confirmation screen', async () => {
    const result = await exportCurrentVault();
    const { preview } = openBackup(fileSystem.exports.get(result.fileName)!, PASSWORD);

    expect(preview).toEqual({
      createdAt: '2026-09-22T09:00:00.000Z',
      appVersion: '1.0.0',
      payloadVersion: 1,
      itemCount: 3,
      archivedItemCount: 1,
      attachmentCount: 2,
      attachmentBytes: FRONT_BYTES.length + BACK_BYTES.length,
      reminderCount: 3,
      migrated: false,
    });
  });

  it('replaces an existing vault rather than merging into it', async () => {
    const result = await exportCurrentVault();

    const other = await createMigratedTestDatabase();
    await itemsRepository.createItem(other, {
      title: 'Something else entirely',
      category: 'other',
      expiryDate: '2029-01-01',
    });

    await restoreVault({
      db: other,
      backup: openBackup(fileSystem.exports.get(result.fileName)!, PASSWORD),
      fileSystem,
    });

    const titles = (await itemsRepository.listItems(other, { includeArchived: true })).map(
      (item) => item.title,
    );

    expect(titles).not.toContain('Something else entirely');
    expect(titles).toHaveLength(3);

    await other.closeAsync();
  });

  it('survives a vault with nothing in it', async () => {
    const empty = await createMigratedTestDatabase();
    const emptyFs = createFakeFileSystem();

    const result = await exportVault({
      db: empty,
      password: PASSWORD,
      preferences: null,
      appVersion: '1.0.0',
      randomBytes: createFakeRandomBytes(),
      fileSystem: emptyFs,
      now: () => NOW,
      iterations: ITERATIONS,
    });

    const restored = await createMigratedTestDatabase();
    const opened = openBackup(emptyFs.exports.get(result.fileName)!, PASSWORD);
    const outcome = await restoreVault({ db: restored, backup: opened, fileSystem: emptyFs });

    expect(outcome).toEqual({ itemCount: 0, attachmentCount: 0, missingFiles: [] });

    await empty.closeAsync();
    await restored.closeAsync();
  });
});
