import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DatabaseProvider } from '@/db/DatabaseProvider';
import { createMigratedTestDatabase } from '@/db/testing/betterSqlite3';
import { itemsRepository, type Database } from '@/db';
import { i18n } from '@/i18n';
import { defaultPreferences } from '@/settings/preferences';
import { initialisePreferences, resetPreferencesStore, updatePreferences } from '@/settings/store';
import { ThemeProvider } from '@/theme';

import { BackupScreen } from '../BackupScreen';

/**
 * The screen's states.
 *
 * The filesystem, the picker and the share sheet are all native, so they are
 * mocked at the service boundary — the same boundary the round-trip tests use.
 * What is asserted here is the flow the user walks: that a passphrase is asked
 * for twice before a file is written, that a restore is never one tap away, and
 * that every failure says something specific.
 */

const mockShare = jest.fn();
const mockIsAvailable = jest.fn().mockResolvedValue(true);
const mockPickFile = jest.fn();
const mockDeleteExport = jest.fn();
const mockReadContainerFile = jest.fn();

/**
 * The shipped key-stretching cost is 300,000 PBKDF2 rounds, which is the point
 * of it — and several seconds per call here. The count is lowered rather than
 * the crypto stubbed, so these tests still run the real cipher, the real
 * framing and the real container; only the deliberate slowness is removed. The
 * shipped constant is pinned in `crypto.test.ts`.
 */
jest.mock('@/services/backup/crypto', () => ({
  ...jest.requireActual('@/services/backup/crypto'),
  PBKDF2_ITERATIONS: 10,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: () => undefined,
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

jest.mock('expo-crypto', () => ({
  ...jest.requireActual('expo-crypto'),
  getRandomBytesAsync: async (length: number) => new Uint8Array(length).fill(4),
  randomUUID: () => `id-${Math.random().toString(36).slice(2)}`,
}));

jest.mock('expo-file-system', () => ({
  ...jest.requireActual('expo-file-system'),
  File: { pickFileAsync: (...args: unknown[]) => mockPickFile(...args) },
}));

jest.mock('@/services/backup/share', () => ({
  sharing: {
    isAvailable: () => mockIsAvailable(),
    share: (...args: unknown[]) => mockShare(...args),
  },
}));

/**
 * The real port writes to the device's document directory. The in-memory double
 * keeps the same contract and lets the export be read straight back.
 */
jest.mock('@/services/backup/fileSystem', () => {
  const exports = new Map<string, Uint8Array>();

  return {
    backupFileSystem: {
      exports,
      readAttachment: async () => null,
      listAttachmentPaths: async () => [],
      writeStagedAttachment: async () => undefined,
      restoredUri: (path: string) => `file:///documents/attachments/${path}`,
      clearStaging: async () => undefined,
      promoteStaging: async () => undefined,
      fileExists: async () => true,
      writeExport: async (name: string, bytes: Uint8Array) => {
        exports.set(name, bytes);

        return `file:///cache/exports/${name}`;
      },
      deleteExport: (...args: unknown[]) => mockDeleteExport(...args),
      readContainerFile: (...args: unknown[]) => mockReadContainerFile(...args),
    },
  };
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let db: Database;

function wrap(ui: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <DatabaseProvider database={db}>{ui}</DatabaseProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

/** Walks the export flow and returns the bytes it wrote. */
async function exportWithPassphrase(passphrase = 'a perfectly fine passphrase') {
  fireEvent.press(screen.getByTestId('backup-export'));

  fireEvent.changeText(await screen.findByTestId('export-password-field'), passphrase);
  fireEvent.changeText(screen.getByTestId('export-password-confirm'), passphrase);
  fireEvent.press(screen.getByTestId('export-password-submit'));

  await screen.findByTestId('backup-exported');

  const { backupFileSystem } = jest.requireMock('@/services/backup/fileSystem') as {
    backupFileSystem: { exports: Map<string, Uint8Array> };
  };

  return [...backupFileSystem.exports.values()][0];
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockIsAvailable.mockResolvedValue(true);

  db = await createMigratedTestDatabase();
  await itemsRepository.createItem(db, {
    title: 'Passport',
    category: 'passport',
    expiryDate: '2030-01-14',
  });

  resetPreferencesStore();
  await updatePreferences({ ...defaultPreferences });
  resetPreferencesStore();
  await initialisePreferences();
  await i18n.changeLanguage('en');
});

afterEach(async () => {
  await db.closeAsync();
});

describe('the screen', () => {
  it('offers both directions', async () => {
    wrap(<BackupScreen />);

    expect(await screen.findByTestId('backup-screen')).toBeTruthy();
    expect(screen.getByTestId('backup-export')).toBeTruthy();
    expect(screen.getByTestId('backup-restore')).toBeTruthy();
  });

  it('explains that the file has to be kept safe', async () => {
    wrap(<BackupScreen />);

    expect(await screen.findByTestId('backup-safety')).toBeTruthy();
  });
});

describe('creating a backup', () => {
  it('asks for the passphrase twice before writing anything', async () => {
    wrap(<BackupScreen />);
    fireEvent.press(await screen.findByTestId('backup-export'));

    const field = await screen.findByTestId('export-password-field');
    fireEvent.changeText(field, 'a perfectly fine passphrase');
    fireEvent.press(screen.getByTestId('export-password-submit'));

    // The confirmation is empty, so nothing has been written.
    expect(screen.queryByTestId('backup-exported')).toBeNull();
    expect(screen.getByText('The two passphrases do not match.')).toBeTruthy();
  });

  it('refuses a passphrase under the minimum length', async () => {
    wrap(<BackupScreen />);
    fireEvent.press(await screen.findByTestId('backup-export'));

    fireEvent.changeText(await screen.findByTestId('export-password-field'), 'short');
    fireEvent.changeText(screen.getByTestId('export-password-confirm'), 'short');
    fireEvent.press(screen.getByTestId('export-password-submit'));

    expect(screen.getByText('Use at least 12 characters.')).toBeTruthy();
    expect(screen.queryByTestId('backup-exported')).toBeNull();
  });

  it('writes a file and reports what went into it', async () => {
    wrap(<BackupScreen />);
    await screen.findByTestId('backup-screen');

    const bytes = await exportWithPassphrase();

    expect(bytes.length).toBeGreaterThan(0);
    expect(screen.getByText('1 document · 0 attachments')).toBeTruthy();
  });

  /**
   * The export is a complete copy of the vault in the cache, protected only by
   * the passphrase. It exists for as long as the share sheet needs it.
   */
  it('deletes the cached file once it has been shared', async () => {
    wrap(<BackupScreen />);
    await screen.findByTestId('backup-screen');
    await exportWithPassphrase();

    fireEvent.press(screen.getByTestId('backup-share'));

    await waitFor(() => expect(mockShare).toHaveBeenCalled());
    expect(mockDeleteExport).toHaveBeenCalledWith(expect.stringContaining('.evault'));
  });

  it('still deletes the cached file when sharing fails', async () => {
    mockShare.mockRejectedValueOnce(new Error('no share sheet'));
    wrap(<BackupScreen />);
    await screen.findByTestId('backup-screen');
    await exportWithPassphrase();

    fireEvent.press(screen.getByTestId('backup-share'));

    await waitFor(() => expect(mockDeleteExport).toHaveBeenCalled());
  });
});

describe('restoring a backup', () => {
  async function pickFileContaining(bytes: Uint8Array | Error, passphrase: string) {
    mockPickFile.mockResolvedValue({ canceled: false, result: { uri: 'file:///picked.evault' } });

    if (bytes instanceof Error) {
      mockReadContainerFile.mockRejectedValue(bytes);
    } else {
      mockReadContainerFile.mockResolvedValue(bytes);
    }

    fireEvent.press(screen.getByTestId('backup-restore'));
    fireEvent.changeText(await screen.findByTestId('import-password-field'), passphrase);
    fireEvent.press(screen.getByTestId('import-password-submit'));
  }

  it('shows what is in the file before replacing anything', async () => {
    wrap(<BackupScreen />);
    await screen.findByTestId('backup-screen');
    const bytes = await exportWithPassphrase();

    await pickFileContaining(bytes, 'a perfectly fine passphrase');

    expect(await screen.findByTestId('restore-preview')).toBeTruthy();
    expect(screen.getByText('This replaces your vault')).toBeTruthy();
    // Nothing has happened to the vault yet.
    expect(screen.queryByTestId('backup-restored')).toBeNull();
  });

  it('replaces the vault only after the destructive confirmation', async () => {
    wrap(<BackupScreen />);
    await screen.findByTestId('backup-screen');
    const bytes = await exportWithPassphrase();

    await pickFileContaining(bytes, 'a perfectly fine passphrase');
    fireEvent.press(await screen.findByTestId('restore-confirm'));

    expect(await screen.findByTestId('backup-restored')).toBeTruthy();
  });

  it('backs out without touching anything when cancelled', async () => {
    wrap(<BackupScreen />);
    await screen.findByTestId('backup-screen');
    const bytes = await exportWithPassphrase();

    await pickFileContaining(bytes, 'a perfectly fine passphrase');
    fireEvent.press(await screen.findByTestId('restore-cancel'));

    await waitFor(() => expect(screen.queryByTestId('restore-preview')).toBeNull());
    expect(screen.queryByTestId('backup-restored')).toBeNull();
    expect(await itemsRepository.countItems(db)).toBe(1);
  });

  it('says the passphrase was wrong, and says nothing else', async () => {
    wrap(<BackupScreen />);
    await screen.findByTestId('backup-screen');
    const bytes = await exportWithPassphrase();

    await pickFileContaining(bytes, 'the wrong passphrase entirely');

    expect(await screen.findByTestId('backup-error')).toBeTruthy();
    expect(
      screen.getByText('That passphrase did not open the file. Check it and try again.'),
    ).toBeTruthy();
  });

  it('tells a damaged file apart from a wrong passphrase', async () => {
    wrap(<BackupScreen />);
    await screen.findByTestId('backup-screen');
    const bytes = await exportWithPassphrase();

    const damaged = Uint8Array.from(bytes);
    // Past the header, inside the manifest frame: the verifier still opens, so
    // the passphrase is known to be right and this can only be damage.
    damaged[damaged.length - 20] ^= 0xff;

    await pickFileContaining(damaged, 'a perfectly fine passphrase');

    expect(await screen.findByTestId('backup-error')).toBeTruthy();
    expect(screen.getByText(/the file is damaged/i)).toBeTruthy();
  });

  it('rejects a file that is not a backup at all', async () => {
    wrap(<BackupScreen />);
    await screen.findByTestId('backup-screen');

    await pickFileContaining(new Uint8Array([1, 2, 3, 4]), 'anything at all');

    expect(await screen.findByTestId('backup-error')).toBeTruthy();
    expect(screen.getByText('That file is not an ExpiryVault backup.')).toBeTruthy();
  });

  it('leaves the vault alone when a file cannot be read', async () => {
    wrap(<BackupScreen />);
    await screen.findByTestId('backup-screen');

    await pickFileContaining(new Error('unreadable'), 'anything at all');

    expect(await screen.findByTestId('backup-error')).toBeTruthy();
    expect(await itemsRepository.countItems(db)).toBe(1);
  });

  it('does nothing at all when the picker is cancelled', async () => {
    wrap(<BackupScreen />);
    await screen.findByTestId('backup-screen');
    mockPickFile.mockResolvedValue({ canceled: true, result: null });

    fireEvent.press(screen.getByTestId('backup-restore'));
    fireEvent.changeText(await screen.findByTestId('import-password-field'), 'anything at all');
    fireEvent.press(screen.getByTestId('import-password-submit'));

    await waitFor(() => expect(mockPickFile).toHaveBeenCalled());
    expect(screen.queryByTestId('backup-error')).toBeNull();
    expect(screen.queryByTestId('restore-preview')).toBeNull();
  });

  it('lets the error be dismissed', async () => {
    wrap(<BackupScreen />);
    await screen.findByTestId('backup-screen');

    await pickFileContaining(new Uint8Array([1, 2, 3, 4]), 'anything at all');
    fireEvent.press(await screen.findByTestId('backup-dismiss'));

    await waitFor(() => expect(screen.queryByTestId('backup-error')).toBeNull());
  });
});
