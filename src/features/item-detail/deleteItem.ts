import type { Database } from '@/db';
import { itemsRepository } from '@/db';
import { deleteItemAttachments } from '@/services/attachmentStorage';

/**
 * Deletes a document completely: the row, everything that cascades from it, and
 * the attachment files on disk.
 *
 * `deleteItem` alone is not enough. Attachment *files* live in
 * `<documentDirectory>/attachments/<itemId>/`, outside the database, so
 * cascading deletes reach their rows but not their bytes — and those bytes are
 * passport scans. Anything offering "delete" must go through here.
 */

export interface DeleteItemDeps {
  /** Injected by tests; production removes the real directory. */
  deleteFiles?: typeof deleteItemAttachments;
}

export async function deleteItemWithFiles(
  db: Database,
  id: string,
  deps: DeleteItemDeps = {},
): Promise<boolean> {
  const deleteFiles = deps.deleteFiles ?? deleteItemAttachments;

  const deleted = await itemsRepository.deleteItem(db, id);

  if (!deleted) {
    return false;
  }

  // Files are removed after the row, so a failure here leaves orphaned bytes
  // rather than a record pointing at files that are already gone.
  await deleteFiles(id);

  return true;
}
