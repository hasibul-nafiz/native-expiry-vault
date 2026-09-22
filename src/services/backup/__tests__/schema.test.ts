import { BackupError } from '../errors';
import { parseBackupPayload } from '../schema';
import type { BackupPayload } from '../types';

import { validPayload } from './fixtures/payload';

/**
 * The import validator.
 *
 * A `.evault` file is untrusted input: it arrived through a system picker and
 * could have been written by anything. Each case below is one constraint from
 * migration 001 or 002, asserted here so that a violation is reported as a bad
 * file rather than as a `DatabaseError` thrown halfway through a restore the
 * user has already confirmed.
 */

function failureOf(payload: unknown): string {
  try {
    parseBackupPayload(payload);
  } catch (error) {
    return error instanceof BackupError ? error.reason : `not-a-backup-error: ${String(error)}`;
  }

  return 'did-not-throw';
}

/** Builds a payload with one thing changed about it. */
function broken(change: (payload: BackupPayload) => void): BackupPayload {
  const payload = validPayload();
  change(payload);

  return payload;
}

describe('a valid payload', () => {
  it('parses', () => {
    expect(parseBackupPayload(validPayload())).toEqual(validPayload());
  });

  it('parses with every table empty', () => {
    const payload = broken((draft) => {
      draft.tables = {
        items: [],
        attachments: [],
        reminderRules: [],
        itemNotes: [],
        renewalTasks: [],
        renewals: [],
        tags: [],
        itemTags: [],
        travelStays: [],
      };
      draft.files = [];
    });

    expect(parseBackupPayload(payload).tables.items).toEqual([]);
  });

  it('parses with no preferences', () => {
    expect(parseBackupPayload(broken((draft) => (draft.preferences = null)))).toBeTruthy();
  });
});

describe('column constraints from migration 001', () => {
  it.each([
    ['a blank title', (d: BackupPayload) => (d.tables.items[0].title = '   ')],
    ['an unknown category', (d: BackupPayload) => (d.tables.items[0].category = 'spaceship' as never)],
    ['a lowercase country', (d: BackupPayload) => (d.tables.items[0].country = 'gb')],
    ['a three-letter country', (d: BackupPayload) => (d.tables.items[0].country = 'GBR')],
    ['a malformed expiry date', (d: BackupPayload) => (d.tables.items[0].expiryDate = '14/01/2030')],
    ['an impossible expiry date', (d: BackupPayload) => (d.tables.items[0].expiryDate = '2026-02-30')],
    ['a non-leap-year 29 February', (d: BackupPayload) => (d.tables.items[0].expiryDate = '2023-02-29')],
    ['a month of 13', (d: BackupPayload) => (d.tables.items[0].expiryDate = '2026-13-01')],
    ['an issue date after the expiry', (d: BackupPayload) => (d.tables.items[0].issueDate = '2031-01-01')],
    ['a confidence above 1', (d: BackupPayload) => (d.tables.items[0].ocrConfidence = 1.5)],
    ['a confidence below 0', (d: BackupPayload) => (d.tables.items[0].ocrConfidence = -0.1)],
    ['a malformed archived_at', (d: BackupPayload) => (d.tables.items[0].archivedAt = '2026-09-22')],
    ['a negative byte size', (d: BackupPayload) => (d.tables.attachments[0].byteSize = -1)],
    ['a blank file name', (d: BackupPayload) => (d.tables.attachments[0].fileName = '')],
    ['an unknown attachment role', (d: BackupPayload) => (d.tables.attachments[0].role = 'side' as never)],
    ['a non-hex sha256', (d: BackupPayload) => (d.tables.attachments[0].sha256 = 'ZZZZ')],
    ['a negative reminder offset', (d: BackupPayload) => (d.tables.reminderRules[0].offsetDays = -1)],
    ['a malformed fire date', (d: BackupPayload) => (d.tables.reminderRules[0].fireDate = 'soon')],
    ['a blank tag label', (d: BackupPayload) => (d.tables.tags[0].label = ' ')],
    ['a stay that ends before it starts', (d: BackupPayload) => (d.tables.travelStays[0].exitDate = '2026-02-01')],
    ['a blank stay area', (d: BackupPayload) => (d.tables.travelStays[0].area = '')],
  ])('rejects %s', (_label, change) => {
    expect(failureOf(broken(change))).toBe('invalid-payload');
  });

  it('accepts a stay that is still open', () => {
    expect(parseBackupPayload(broken((d) => (d.tables.travelStays[0].exitDate = null)))).toBeTruthy();
  });

  it('accepts an archived item', () => {
    expect(
      parseBackupPayload(broken((d) => (d.tables.items[0].archivedAt = '2026-09-22T09:00:00.000Z'))),
    ).toBeTruthy();
  });
});

describe('referential integrity', () => {
  /**
   * Foreign keys are on for the connection, so an orphan row would abort the
   * restore mid-transaction. Catching it here turns that into a clear message
   * about the file.
   */
  it.each([
    ['an attachment', (d: BackupPayload) => (d.tables.attachments[0].itemId = 'ghost')],
    ['a reminder rule', (d: BackupPayload) => (d.tables.reminderRules[0].itemId = 'ghost')],
    ['a note', (d: BackupPayload) => (d.tables.itemNotes[0].itemId = 'ghost')],
    ['a renewal task', (d: BackupPayload) => (d.tables.renewalTasks[0].itemId = 'ghost')],
    ['a renewal', (d: BackupPayload) => (d.tables.renewals[0].itemId = 'ghost')],
    ['an item tag', (d: BackupPayload) => (d.tables.itemTags[0].itemId = 'ghost')],
  ])('rejects %s naming an item that is not in the file', (_label, change) => {
    expect(failureOf(broken(change))).toBe('invalid-payload');
  });

  it('rejects an item tag naming a tag that is not in the file', () => {
    expect(failureOf(broken((d) => (d.tables.itemTags[0].tagId = 'ghost')))).toBe(
      'invalid-payload',
    );
  });
});

describe('uniqueness', () => {
  it('rejects a duplicate primary key', () => {
    expect(
      failureOf(broken((d) => d.tables.items.push({ ...d.tables.items[0] }))),
    ).toBe('invalid-payload');
  });

  it('rejects a duplicate tag label', () => {
    expect(
      failureOf(
        broken((d) => d.tables.tags.push({ ...d.tables.tags[0], id: 'tag-2', label: 'Travel' })),
      ),
    ).toBe('invalid-payload');
  });

  /** `UNIQUE (item_id, offset_days)` — a constraint no row shape can express. */
  it('rejects two reminders at the same offset for one item', () => {
    expect(
      failureOf(
        broken((d) => d.tables.reminderRules.push({ ...d.tables.reminderRules[0], id: 'rule-2' })),
      ),
    ).toBe('invalid-payload');
  });

  it('rejects a duplicate item/tag pair', () => {
    expect(failureOf(broken((d) => d.tables.itemTags.push({ ...d.tables.itemTags[0] })))).toBe(
      'invalid-payload',
    );
  });
});

describe('the manifest and the attachment rows', () => {
  it('rejects a file entry for an attachment that is not in the file', () => {
    expect(failureOf(broken((d) => (d.files[0].attachmentId = 'ghost')))).toBe('invalid-payload');
  });

  it('rejects an attachment row with no file entry', () => {
    expect(failureOf(broken((d) => (d.files = [])))).toBe('invalid-payload');
  });

  it('rejects the same attachment described twice', () => {
    expect(failureOf(broken((d) => d.files.push({ ...d.files[0] })))).toBe('invalid-payload');
  });

  it('rejects two attachments claiming the same path', () => {
    expect(
      failureOf(
        broken((d) => {
          d.tables.attachments.push({ ...d.tables.attachments[0], id: 'attachment-2' });
          d.files.push({ ...d.files[0], attachmentId: 'attachment-2' });
        }),
      ),
    ).toBe('invalid-payload');
  });

  it('rejects a digest that is not a SHA-256', () => {
    expect(failureOf(broken((d) => (d.files[0].sha256 = 'abc')))).toBe('invalid-payload');
  });
});

describe('path traversal', () => {
  /**
   * The hostile case. A crafted backup naming `../../preferences.json` would
   * have the importer overwrite a file outside the directory it owns.
   */
  it.each([
    ['a parent segment', '../../preferences.json'],
    ['a parent segment in the middle', 'item-1/../../escape.jpg'],
    ['an absolute path', '/etc/passwd'],
    ['a current-directory segment', './scan.jpg'],
    ['a backslash path', 'item-1\\scan.jpg'],
    ['a drive letter', 'C:/windows/system32'],
    ['a doubled separator', 'item-1//scan.jpg'],
    ['an empty path', ''],
  ])('rejects %s', (_label, path) => {
    expect(failureOf(broken((d) => (d.files[0].relativePath = path)))).toBe('invalid-payload');
  });

  it('accepts an ordinary nested path', () => {
    expect(
      parseBackupPayload(broken((d) => (d.files[0].relativePath = 'item-1/front.jpg'))),
    ).toBeTruthy();
  });
});

describe('the payload envelope', () => {
  it.each([
    ['a missing tables object', (d: BackupPayload) => delete (d as Partial<BackupPayload>).tables],
    ['a malformed createdAt', (d: BackupPayload) => (d.createdAt = 'yesterday')],
    ['a negative schema version', (d: BackupPayload) => (d.schemaVersion = -1)],
    ['a zero payload version', (d: BackupPayload) => (d.payloadVersion = 0)],
  ])('rejects %s', (_label, change) => {
    expect(failureOf(broken(change as (payload: BackupPayload) => void))).toBe('invalid-payload');
  });

  it('names what was wrong, so the failure is diagnosable', () => {
    try {
      parseBackupPayload(broken((d) => (d.tables.items[0].country = 'gb')));
      throw new Error('should not parse');
    } catch (error) {
      expect((error as BackupError).message).toContain('country');
    }
  });

  it('rejects a notification id, which is a handle to another device', () => {
    expect(failureOf(broken((d) => (d.tables.reminderRules[0].notificationId = 'abc')))).toBe(
      'invalid-payload',
    );
  });
});
