import { deleteItemAttachments, storeAttachment, storeAttachments } from '../attachmentStorage';

/**
 * `expo-file-system` is a native module, so it is replaced with a small
 * in-memory filesystem. What is under test is this module's own logic —
 * per-item directories, collision renaming, name sanitisation and cleanup —
 * not the platform's file APIs, which need a device.
 */

interface FakeEntry {
  size: number;
}

const mockFiles = new Map<string, FakeEntry>();
const mockDirectories = new Set<string>();

jest.mock('expo-file-system', () => {
  // Preserves the `file:///` scheme, which a naive slash-collapse destroys.
  const join = (...parts: string[]) => {
    const [first = '', ...rest] = parts;
    const tail = rest.map((part) => part.replace(/^\/+|\/+$/g, '')).filter((part) => part !== '');

    return [first.replace(/\/+$/, ''), ...tail].join('/');
  };

  class FakeDirectory {
    uri: string;

    constructor(...parts: (string | { uri: string })[]) {
      this.uri = join(...parts.map((part) => (typeof part === 'string' ? part : part.uri)));
    }

    get exists(): boolean {
      return mockDirectories.has(this.uri);
    }

    create(): void {
      mockDirectories.add(this.uri);
    }

    delete(): void {
      mockDirectories.delete(this.uri);
      for (const key of [...mockFiles.keys()]) {
        if (key.startsWith(`${this.uri}/`)) {
          mockFiles.delete(key);
        }
      }
    }
  }

  class FakeFile {
    uri: string;

    constructor(...parts: (string | { uri: string })[]) {
      this.uri = join(...parts.map((part) => (typeof part === 'string' ? part : part.uri)));
    }

    get name(): string {
      return this.uri.slice(this.uri.lastIndexOf('/') + 1);
    }

    get exists(): boolean {
      return mockFiles.has(this.uri);
    }

    get size(): number | null {
      return mockFiles.get(this.uri)?.size ?? null;
    }

    copy(destination: { uri: string }): void {
      const source = mockFiles.get(this.uri);

      if (source === undefined) {
        throw new Error(`No such file: ${this.uri}`);
      }

      mockFiles.set(destination.uri, { size: source.size });
    }
  }

  return {
    Directory: FakeDirectory,
    File: FakeFile,
    Paths: { document: 'file:///documents' },
  };
});

function givenSourceFile(uri: string, size: number): void {
  mockFiles.set(uri, { size });
}

beforeEach(() => {
  mockFiles.clear();
  mockDirectories.clear();
});

describe('storeAttachment', () => {
  it('copies into a directory named for the item', async () => {
    givenSourceFile('file:///tmp/a.jpg', 2048);

    const stored = await storeAttachment('item-1', {
      uri: 'file:///tmp/a.jpg',
      fileName: 'a.jpg',
      mimeType: 'image/jpeg',
    });

    expect(stored.uri).toBe('file:///documents/attachments/item-1/a.jpg');
    expect(stored.fileName).toBe('a.jpg');
    expect(stored.byteSize).toBe(2048);
  });

  it('creates the directory when it does not exist', async () => {
    givenSourceFile('file:///tmp/a.jpg', 10);

    await storeAttachment('item-1', {
      uri: 'file:///tmp/a.jpg',
      fileName: 'a.jpg',
      mimeType: 'image/jpeg',
    });

    expect(mockDirectories.has('file:///documents/attachments/item-1')).toBe(true);
  });

  it('renames rather than overwriting when the same name is picked twice', async () => {
    givenSourceFile('file:///tmp/a.jpg', 10);

    const first = await storeAttachment('item-1', {
      uri: 'file:///tmp/a.jpg',
      fileName: 'a.jpg',
      mimeType: 'image/jpeg',
    });
    const second = await storeAttachment('item-1', {
      uri: 'file:///tmp/a.jpg',
      fileName: 'a.jpg',
      mimeType: 'image/jpeg',
    });

    expect(first.fileName).toBe('a.jpg');
    expect(second.fileName).toBe('a-1.jpg');
    expect(mockFiles.has(first.uri)).toBe(true);
  });

  it.each([
    // Separators become underscores, then any leading dots are stripped.
    ['a path traversal', '../../etc/passwd', '_.._etc_passwd'],
    ['a leading dot', '.hidden.jpg', 'hidden.jpg'],
    ['spaces and slashes', 'my scan/1.jpg', 'my_scan_1.jpg'],
  ])('sanitises %s', async (_label, fileName, expected) => {
    givenSourceFile('file:///tmp/src', 10);

    const stored = await storeAttachment('item-1', {
      uri: 'file:///tmp/src',
      fileName,
      mimeType: 'image/jpeg',
    });

    expect(stored.fileName).toBe(expected);
    // Crucially, still inside the item's own directory.
    expect(stored.uri.startsWith('file:///documents/attachments/item-1/')).toBe(true);
  });

  it('sanitises the item id too, so it cannot escape the attachments folder', async () => {
    givenSourceFile('file:///tmp/a.jpg', 10);

    const stored = await storeAttachment('../evil', {
      uri: 'file:///tmp/a.jpg',
      fileName: 'a.jpg',
      mimeType: 'image/jpeg',
    });

    expect(stored.uri).toBe('file:///documents/attachments/_evil/a.jpg');
  });
});

describe('storeAttachments', () => {
  it('stores several files in order', async () => {
    givenSourceFile('file:///tmp/a.jpg', 10);
    givenSourceFile('file:///tmp/b.jpg', 20);

    const stored = await storeAttachments('item-1', [
      { uri: 'file:///tmp/a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg' },
      { uri: 'file:///tmp/b.jpg', fileName: 'b.jpg', mimeType: 'image/jpeg' },
    ]);

    expect(stored.map((file) => file.fileName)).toEqual(['a.jpg', 'b.jpg']);
    expect(stored.map((file) => file.byteSize)).toEqual([10, 20]);
  });

  it('cleans up everything when one file fails', async () => {
    givenSourceFile('file:///tmp/a.jpg', 10);
    // b.jpg deliberately absent, so copying it throws.

    await expect(
      storeAttachments('item-1', [
        { uri: 'file:///tmp/a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg' },
        { uri: 'file:///tmp/b.jpg', fileName: 'b.jpg', mimeType: 'image/jpeg' },
      ]),
    ).rejects.toThrow(/No such file/);

    // No half-written set left behind.
    expect(mockDirectories.has('file:///documents/attachments/item-1')).toBe(false);
    expect([...mockFiles.keys()]).toEqual(['file:///tmp/a.jpg']);
  });
});

describe('deleteItemAttachments', () => {
  it('removes the directory and its contents', async () => {
    givenSourceFile('file:///tmp/a.jpg', 10);
    await storeAttachment('item-1', {
      uri: 'file:///tmp/a.jpg',
      fileName: 'a.jpg',
      mimeType: 'image/jpeg',
    });

    await deleteItemAttachments('item-1');

    expect(mockDirectories.has('file:///documents/attachments/item-1')).toBe(false);
    expect(mockFiles.has('file:///documents/attachments/item-1/a.jpg')).toBe(false);
  });

  it('is safe to call when the item has no attachments', async () => {
    await expect(deleteItemAttachments('never-existed')).resolves.toBeUndefined();
  });
});
