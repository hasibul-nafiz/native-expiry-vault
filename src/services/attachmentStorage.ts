import { Directory, File, Paths } from 'expo-file-system';

/**
 * Copies picked images into the app's private document directory.
 *
 * The database stores only the path, name, type and size — never the bytes.
 *
 * These files are **not encrypted**. SQLCipher covers the database, not the
 * filesystem. The directory is app-private and, on iOS, covered by the
 * platform's file data protection, but a full-device backup or a jailbroken
 * device can read it. Encrypting attachment blobs lands with F12, where backup
 * and export force the question. Recorded in PROGRESS.md rather than implied.
 */

const ATTACHMENTS_DIRECTORY = 'attachments';

export interface StoredFile {
  uri: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
}

export interface SourceFile {
  uri: string;
  fileName: string;
  mimeType: string;
}

/** Strips anything that could escape the item's own directory. */
function safeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '');

  return cleaned === '' ? 'attachment' : cleaned;
}

function directoryForItem(itemId: string): Directory {
  return new Directory(Paths.document, ATTACHMENTS_DIRECTORY, safeFileName(itemId));
}

/**
 * Copies one file into the item's directory, renaming on collision so a second
 * pick of the same photo does not overwrite the first.
 */
export async function storeAttachment(itemId: string, source: SourceFile): Promise<StoredFile> {
  const directory = directoryForItem(itemId);

  if (!directory.exists) {
    directory.create({ intermediates: true });
  }

  const base = safeFileName(source.fileName);
  let destination = new File(directory, base);
  let suffix = 1;

  while (destination.exists) {
    const dot = base.lastIndexOf('.');
    const stem = dot === -1 ? base : base.slice(0, dot);
    const extension = dot === -1 ? '' : base.slice(dot);
    destination = new File(directory, `${stem}-${suffix}${extension}`);
    suffix += 1;
  }

  new File(source.uri).copy(destination);

  return {
    uri: destination.uri,
    fileName: destination.name,
    mimeType: source.mimeType,
    byteSize: destination.size ?? 0,
  };
}

/** Copies several files, cleaning up everything if any one of them fails. */
export async function storeAttachments(
  itemId: string,
  sources: readonly SourceFile[],
): Promise<StoredFile[]> {
  const stored: StoredFile[] = [];

  try {
    for (const source of sources) {
      stored.push(await storeAttachment(itemId, source));
    }
  } catch (error) {
    await deleteItemAttachments(itemId);
    throw error;
  }

  return stored;
}

/** Removes the item's whole attachment directory. Safe to call when absent. */
export async function deleteItemAttachments(itemId: string): Promise<void> {
  const directory = directoryForItem(itemId);

  if (directory.exists) {
    directory.delete();
  }
}
