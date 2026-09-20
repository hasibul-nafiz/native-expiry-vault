import type { Database } from '@/db';
import { attachmentsRepository, itemsRepository, reminderRulesRepository } from '@/db';
import type { Item } from '@/db/models';
import { applicableOffsets, todayLocal } from '@/features/expiry';
import { deleteItemAttachments, storeAttachments } from '@/services/attachmentStorage';

import type { AddItemValues } from './schema';

/**
 * Persists a new document: the item, its reminder rules, and its attachments.
 *
 * A filesystem copy cannot join a SQL transaction, so the ordering is chosen to
 * make every failure recoverable:
 *
 * 1. Item and reminder rules go in together, inside one transaction — a
 *    half-made item with no reminders is impossible.
 * 2. Files are copied into the item's directory.
 * 3. Attachment rows are inserted.
 * 4. Any failure after step 1 deletes the item (children cascade) and removes
 *    the directory, so nothing orphaned is left behind.
 *
 * The residual risk is a crash *between* steps, which can leave files with no
 * row pointing at them. Logged rather than pretended away.
 */

export interface SaveItemDeps {
  /** Injected so tests can drive the failure paths without a real filesystem. */
  storeFiles?: typeof storeAttachments;
  deleteFiles?: typeof deleteItemAttachments;
  today?: string;
}

export async function saveNewItem(
  db: Database,
  values: AddItemValues,
  deps: SaveItemDeps = {},
): Promise<Item> {
  const storeFiles = deps.storeFiles ?? storeAttachments;
  const deleteFiles = deps.deleteFiles ?? deleteItemAttachments;
  const today = deps.today ?? todayLocal();

  // Reminders whose fire date has already passed are dropped rather than
  // scheduled into the past.
  const offsets = applicableOffsets(values.expiryDate, today, values.reminderOffsets);

  let item: Item | null = null;

  await db.withTransactionAsync(async () => {
    item = await itemsRepository.createItem(db, {
      title: values.title,
      category: values.category,
      issuer: values.issuer ?? null,
      documentNumber: values.documentNumber ?? null,
      country: values.country ?? null,
      issueDate: values.issueDate ?? null,
      expiryDate: values.expiryDate,
      escalationEnabled: values.escalationEnabled,
      // Kept so a future version can re-parse the document without asking for
      // it again. It holds the MRZ, so it holds the document number: inside
      // SQLCipher like everything else, and never logged.
      ocrRawText: values.ocr?.rawText ?? null,
      ocrConfidence: values.ocr?.confidence ?? null,
    });

    for (const offset of offsets) {
      await reminderRulesRepository.createReminderRule(db, item.id, values.expiryDate, offset);
    }
  });

  if (item === null) {
    throw new Error('The item was not created.');
  }

  const created: Item = item;

  if (values.attachments.length === 0) {
    return created;
  }

  try {
    const stored = await storeFiles(
      created.id,
      values.attachments.map((attachment) => ({
        uri: attachment.uri,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
      })),
    );

    for (const [index, file] of stored.entries()) {
      await attachmentsRepository.createAttachment(db, {
        itemId: created.id,
        fileUri: file.uri,
        fileName: file.fileName,
        mimeType: file.mimeType,
        byteSize: file.byteSize,
        sortOrder: index,
      });
    }
  } catch (error) {
    // Roll the whole save back: the item, its cascaded children, and the files.
    await itemsRepository.deleteItem(db, created.id);
    await deleteFiles(created.id).catch(() => undefined);
    throw error;
  }

  return created;
}
