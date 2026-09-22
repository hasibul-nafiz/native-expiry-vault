import type { BackupPayload } from '../../types';

/**
 * A minimal but complete valid payload, for tests that need to break exactly
 * one thing about it.
 *
 * Shared test data, not a suite — `jest.config.js` excludes this directory for
 * that reason.
 */

export const TIMESTAMP = '2026-09-22T09:00:00.000Z';

export function validPayload(): BackupPayload {
  return {
    payloadVersion: 1,
    createdAt: TIMESTAMP,
    appVersion: '1.0.0',
    schemaVersion: 2,
    preferences: {
      theme: 'system',
      language: 'system',
      reminderHour: 9,
      autoLockDelayMs: 60_000,
      biometricUnlock: true,
    },
    tables: {
      items: [
        {
          id: 'item-1',
          title: 'Passport',
          category: 'passport',
          issuer: 'HMPO',
          documentNumber: '123456789',
          country: 'GB',
          issueDate: '2020-01-15',
          expiryDate: '2030-01-14',
          renewedAt: null,
          isVital: true,
          escalationEnabled: true,
          ocrConfidence: 0.8,
          ocrRawText: null,
          archivedAt: null,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      attachments: [
        {
          id: 'attachment-1',
          itemId: 'item-1',
          fileUri: 'file:///documents/attachments/item-1/scan.jpg',
          fileName: 'scan.jpg',
          mimeType: 'image/jpeg',
          byteSize: 4,
          role: 'front',
          sortOrder: 0,
          sha256: null,
          createdAt: TIMESTAMP,
        },
      ],
      reminderRules: [
        {
          id: 'rule-1',
          itemId: 'item-1',
          offsetDays: 30,
          enabled: true,
          fireDate: '2029-12-15',
          deliveredAt: null,
          notificationId: null,
          createdAt: TIMESTAMP,
        },
      ],
      itemNotes: [
        {
          id: 'note-1',
          itemId: 'item-1',
          title: 'Renewal office',
          body: 'Book an appointment first.',
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      renewalTasks: [
        {
          id: 'task-1',
          itemId: 'item-1',
          title: 'Photos',
          detail: null,
          dueDate: '2029-11-01',
          done: false,
          sortOrder: 0,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      renewals: [
        {
          id: 'renewal-1',
          itemId: 'item-1',
          previousExpiryDate: '2020-01-14',
          newExpiryDate: '2030-01-14',
          renewedOn: '2020-01-15',
          note: null,
          createdAt: TIMESTAMP,
        },
      ],
      tags: [{ id: 'tag-1', label: 'Travel', color: null, createdAt: TIMESTAMP }],
      itemTags: [{ itemId: 'item-1', tagId: 'tag-1' }],
      travelStays: [
        {
          id: 'stay-1',
          area: 'schengen',
          entryDate: '2026-03-01',
          exitDate: '2026-03-10',
          note: null,
          createdAt: TIMESTAMP,
        },
      ],
    },
    files: [
      {
        attachmentId: 'attachment-1',
        relativePath: 'item-1/scan.jpg',
        byteSize: 4,
        sha256: 'a'.repeat(64),
      },
    ],
  };
}
