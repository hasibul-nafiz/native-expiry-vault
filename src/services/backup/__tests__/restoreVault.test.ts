import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import { backupRepository, itemsRepository, type Database } from '@/db';
import { createMigratedTestDatabase } from '@/db/testing/betterSqlite3';

import { sealContainer } from '../container';
import { BackupError } from '../errors';
import { decodeContainer, encodeContainer, NONCE_BYTES, SALT_BYTES } from '../format';
import { openBackup } from '../importVault';
import { restoreVault } from '../restoreVault';
import { createFakeFileSystem, type FakeBackupFileSystem } from '../testing';
import { PAYLOAD_VERSION, type BackupPayload } from '../types';

import { validPayload } from './fixtures/payload';

/**
 * Atomicity.
 *
 * Every case here fails somewhere in the middle of a restore and then asserts
 * the same thing: the vault that was already on the device is exactly as it
 * was. That is the promise a destructive confirmation is asking the user to
 * accept, and it is the one worth the most tests.
 */

const ITERATIONS = 10;
const PASSWORD = 'a perfectly adequate passphrase';
const SECRETS = {
  salt: new Uint8Array(SALT_BYTES).fill(7),
  nonce: new Uint8Array(NONCE_BYTES).fill(9),
};

const SCAN_BYTES = utf8ToBytes('scan bytes');

let db: Database;
let fileSystem: FakeBackupFileSystem;

/** Seals a payload plus its attachment frames into a container. */
function seal(payload: BackupPayload, attachments: readonly Uint8Array[] = [SCAN_BYTES]): Uint8Array {
  return sealContainer(
    PASSWORD,
    [utf8ToBytes(JSON.stringify(payload)), ...attachments],
    SECRETS,
    ITERATIONS,
  );
}

/** A payload whose single file entry matches the bytes it will be sealed with. */
function payloadFor(bytes: Uint8Array): BackupPayload {
  const payload = validPayload();
  payload.files[0].byteSize = bytes.length;
  payload.files[0].sha256 = bytesToHex(sha256(bytes));

  return payload;
}

async function reasonOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    return error instanceof BackupError ? error.reason : `not-a-backup-error: ${String(error)}`;
  }

  return 'did-not-throw';
}

/** What the vault looked like before anything was attempted. */
async function snapshot() {
  const tables = await backupRepository.readAllTables(db);

  return { tables, files: [...fileSystem.live.entries()] };
}

beforeEach(async () => {
  db = await createMigratedTestDatabase();
  fileSystem = createFakeFileSystem();

  await itemsRepository.createItem(db, {
    title: 'The vault that is already here',
    category: 'passport',
    expiryDate: '2029-05-05',
  });
  fileSystem.addLiveFile('existing/photo.jpg', utf8ToBytes('an existing attachment'));
});

afterEach(async () => {
  await db.closeAsync();
});

describe('a successful restore', () => {
  it('replaces the database and the attachments together', async () => {
    const backup = openBackup(seal(payloadFor(SCAN_BYTES)), PASSWORD);
    const result = await restoreVault({ db, backup, fileSystem });

    expect(result).toEqual({ itemCount: 1, attachmentCount: 1, missingFiles: [] });

    const { items, attachments } = await backupRepository.readAllTables(db);
    expect(items[0].title).toBe('Passport');
    expect(attachments[0].fileUri).toBe(fileSystem.uriFor('item-1/scan.jpg'));
    expect([...fileSystem.live.keys()]).toEqual(['item-1/scan.jpg']);
  });

  /**
   * The URI in the file came from another device: a different container id,
   * possibly a different OS. Keeping it would restore a vault whose every image
   * is a broken path.
   */
  it('rewrites attachment URIs to this device', async () => {
    const payload = payloadFor(SCAN_BYTES);
    payload.tables.attachments[0].fileUri = 'file:///some/other/phone/attachments/item-1/scan.jpg';

    await restoreVault({ db, backup: openBackup(seal(payload), PASSWORD), fileSystem });

    const { attachments } = await backupRepository.readAllTables(db);
    expect(attachments[0].fileUri).toBe(fileSystem.uriFor('item-1/scan.jpg'));
  });

  it('leaves no staging behind', async () => {
    await restoreVault({
      db,
      backup: openBackup(seal(payloadFor(SCAN_BYTES)), PASSWORD),
      fileSystem,
    });

    expect(fileSystem.staging.size).toBe(0);
  });

  it('reports its phases in order', async () => {
    const phases: string[] = [];
    await restoreVault({
      db,
      backup: openBackup(seal(payloadFor(SCAN_BYTES)), PASSWORD),
      fileSystem,
      onProgress: ({ phase }) => phases.push(phase),
    });

    expect(phases).toEqual(['staging', 'writing', 'promoting']);
  });
});

describe('when something fails, the existing vault is untouched', () => {
  it('a file that will not stage', async () => {
    const before = await snapshot();
    fileSystem.failStagingAt = 0;

    expect(
      await reasonOf(() =>
        restoreVault({ db, backup: openBackup(seal(payloadFor(SCAN_BYTES)), PASSWORD), fileSystem }),
      ),
    ).toBe('io');

    expect(await snapshot()).toEqual(before);
    expect(fileSystem.promoteCount).toBe(0);
    expect(fileSystem.staging.size).toBe(0);
  });

  it('an attachment whose bytes do not match its digest', async () => {
    const before = await snapshot();
    const payload = payloadFor(SCAN_BYTES);
    payload.files[0].sha256 = bytesToHex(sha256(utf8ToBytes('something else')));

    expect(
      await reasonOf(() =>
        restoreVault({ db, backup: openBackup(seal(payload), PASSWORD), fileSystem }),
      ),
    ).toBe('corrupt');

    expect(await snapshot()).toEqual(before);
  });

  it('an attachment of the wrong length', async () => {
    const before = await snapshot();
    const payload = payloadFor(SCAN_BYTES);
    payload.files[0].byteSize = 999;

    expect(
      await reasonOf(() =>
        restoreVault({ db, backup: openBackup(seal(payload), PASSWORD), fileSystem }),
      ),
    ).toBe('corrupt');

    expect(await snapshot()).toEqual(before);
  });

  it('a damaged attachment frame', async () => {
    const before = await snapshot();
    const bytes = seal(payloadFor(SCAN_BYTES));
    bytes[bytes.length - 3] ^= 0xff;

    expect(
      await reasonOf(() =>
        restoreVault({ db, backup: openBackup(bytes, PASSWORD), fileSystem }),
      ),
    ).toBe('corrupt');

    expect(await snapshot()).toEqual(before);
  });

  /**
   * The transaction is what covers this one: several tables have already been
   * emptied and partly rewritten when the write fails.
   *
   * The failure is injected rather than provoked through a constraint, because
   * the schema refuses everything SQLite would — deliberately, and in one place
   * it is stricter: JavaScript's `trim()` treats U+00A0 as whitespace and
   * SQLite's does not, so a title of one non-breaking space is rejected by zod
   * and accepted by the CHECK. Being stricter is the safe direction, but it
   * leaves no constraint to fail on, so the disk error stands in for one.
   */
  it('a write that fails partway through the transaction', async () => {
    const before = await snapshot();
    let writes = 0;

    const failing: Database = {
      ...db,
      execAsync: (sql) => db.execAsync(sql),
      getFirstAsync: (sql, params) => db.getFirstAsync(sql, params),
      getAllAsync: (sql, params) => db.getAllAsync(sql, params),
      withTransactionAsync: (task) => db.withTransactionAsync(task),
      closeAsync: () => Promise.resolve(),
      runAsync: async (sql, params) => {
        writes += 1;

        if (writes > 2) {
          throw new Error('disk I/O error');
        }

        return db.runAsync(sql, params);
      },
    };

    expect(
      await reasonOf(() =>
        restoreVault({
          db: failing,
          backup: openBackup(seal(payloadFor(SCAN_BYTES)), PASSWORD),
          fileSystem,
        }),
      ),
    ).toBe('io');

    expect(await snapshot()).toEqual(before);
    expect(fileSystem.promoteCount).toBe(0);
    expect(fileSystem.staging.size).toBe(0);
  });

  it('a failed directory swap', async () => {
    fileSystem.failPromote = true;

    expect(
      await reasonOf(() =>
        restoreVault({ db, backup: openBackup(seal(payloadFor(SCAN_BYTES)), PASSWORD), fileSystem }),
      ),
    ).toBe('io');

    // The commit has already happened here, so the database has moved on. What
    // the test pins is that staging is cleaned up and the old files are still
    // there to be reported against — the one window `fileSystem.ts` documents.
    expect(fileSystem.staging.size).toBe(0);
    expect(fileSystem.live.has('existing/photo.jpg')).toBe(true);
  });

  it('a hostile path, caught again at the point of writing', async () => {
    const before = await snapshot();
    const payload = payloadFor(SCAN_BYTES);
    // `openBackup` would normally reject this; sealing it directly is how a
    // crafted file reaches the writer if validation were ever weakened.
    payload.files[0].relativePath = '../../escape.jpg';

    expect(await reasonOf(async () => openBackup(seal(payload), PASSWORD))).toBe('invalid-payload');
    expect(await snapshot()).toEqual(before);
  });
});

describe('opening a file before restoring it', () => {
  it('refuses a manifest that does not match the frames it carries', async () => {
    const payload = payloadFor(SCAN_BYTES);
    const bytes = seal(payload, [SCAN_BYTES, utf8ToBytes('an extra frame nothing describes')]);

    expect(await reasonOf(async () => openBackup(bytes, PASSWORD))).toBe('corrupt');
  });

  it('refuses a payload from a newer app', async () => {
    const payload = payloadFor(SCAN_BYTES);
    payload.payloadVersion = PAYLOAD_VERSION + 1;

    expect(await reasonOf(async () => openBackup(seal(payload), PASSWORD))).toBe(
      'unsupported-version',
    );
  });

  it('refuses a manifest that is not JSON', async () => {
    const bytes = sealContainer(
      PASSWORD,
      [utf8ToBytes('not json at all'), SCAN_BYTES],
      SECRETS,
      ITERATIONS,
    );

    expect(await reasonOf(async () => openBackup(bytes, PASSWORD))).toBe('invalid-payload');
  });

  it('refuses the wrong password without touching anything', async () => {
    const before = await snapshot();

    expect(await reasonOf(async () => openBackup(seal(payloadFor(SCAN_BYTES)), 'wrong'))).toBe(
      'wrong-password',
    );
    expect(await snapshot()).toEqual(before);
  });

  /** A v1 file must still open after the container has been re-encoded. */
  it('opens a container whose frames have been re-framed identically', async () => {
    const bytes = seal(payloadFor(SCAN_BYTES));
    const { header, frames } = decodeContainer(bytes);

    expect(openBackup(encodeContainer(header, frames), PASSWORD).payload.payloadVersion).toBe(1);
  });
});
