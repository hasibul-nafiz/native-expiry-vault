import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { File } from 'expo-file-system';
import { useCallback, useState } from 'react';

import { useDatabaseState } from '@/db/DatabaseProvider';
import { requestReminderSync } from '@/features/reminders';
import {
  backupFileSystem,
  exportVault,
  isBackupError,
  openBackup,
  restoreVault,
  sharing,
  type BackupErrorReason,
  type BackupPreview,
  type ExportResult,
  type OpenedBackup,
} from '@/services/backup';
import { parsePreferences } from '@/settings/preferences';
import { getPreferencesState, initialisePreferences, updatePreferences } from '@/settings/store';

/**
 * The backup screen's state machine.
 *
 * Export and restore are both multi-step and both destructive in their own way
 * — one puts the whole vault on the share sheet, the other replaces it — so
 * every step the user has to confirm is a state here rather than a nested
 * callback.
 */

export type BackupStage =
  | { kind: 'idle' }
  | { kind: 'exporting' }
  | { kind: 'exported'; result: ExportResult }
  | { kind: 'opening' }
  /** The file opened; the user has not yet agreed to let it replace the vault. */
  | { kind: 'previewing'; backup: OpenedBackup; preview: BackupPreview }
  | { kind: 'restoring' }
  | { kind: 'restored'; itemCount: number; attachmentCount: number; missingFiles: string[] }
  | { kind: 'failed'; reason: BackupErrorReason };

export interface BackupController {
  stage: BackupStage;
  databaseReady: boolean;
  reset(): void;
  runExport(password: string): Promise<void>;
  shareExport(dialogTitle: string): Promise<void>;
  pickAndOpen(password: string): Promise<void>;
  confirmRestore(): Promise<void>;
}

/** `expo-crypto` is already the app's CSPRNG, for the database key and every id. */
async function randomBytes(length: number): Promise<Uint8Array> {
  return Crypto.getRandomBytesAsync(length);
}

export function useBackup(): BackupController {
  const database = useDatabaseState();
  const db = database.status === 'ready' ? database.db : null;
  const [stage, setStage] = useState<BackupStage>({ kind: 'idle' });

  const fail = useCallback((error: unknown) => {
    setStage({ kind: 'failed', reason: isBackupError(error) ? error.reason : 'io' });
  }, []);

  const reset = useCallback(() => {
    setStage({ kind: 'idle' });
  }, []);

  const runExport = useCallback(
    async (password: string) => {
      if (db === null) {
        return;
      }

      setStage({ kind: 'exporting' });

      try {
        const result = await exportVault({
          db,
          password,
          // Carried so a restore onto a new phone comes back in the same theme
          // and language rather than in the device defaults.
          preferences: getPreferencesState().preferences,
          appVersion: Constants.expoConfig?.version ?? '',
          randomBytes,
        });

        setStage({ kind: 'exported', result });
      } catch (error) {
        fail(error);
      }
    },
    [db, fail],
  );

  /**
   * Shares the file, then deletes it.
   *
   * The export is a complete copy of the vault sitting in the cache with only
   * the passphrase protecting it. It exists for as long as the share sheet
   * needs it and no longer — whatever the user chose to do with it, they now
   * have their own copy.
   */
  const shareExport = useCallback(
    async (dialogTitle: string) => {
      if (stage.kind !== 'exported') {
        return;
      }

      try {
        if (await sharing.isAvailable()) {
          await sharing.share(stage.result.fileUri, dialogTitle);
        }
      } catch (error) {
        fail(error);
      } finally {
        await backupFileSystem.deleteExport(stage.result.fileUri);
      }
    },
    [stage, fail],
  );

  const pickAndOpen = useCallback(
    async (password: string) => {
      setStage({ kind: 'opening' });

      try {
        // `.evault` is not a registered type, so the picker cannot filter by it
        // on either platform; anything the user chooses is validated on open.
        const picked = await File.pickFileAsync({ mimeTypes: '*/*' });

        if (picked.canceled) {
          setStage({ kind: 'idle' });

          return;
        }

        const bytes = await backupFileSystem.readContainerFile(picked.result.uri);
        const backup = openBackup(bytes, password);

        setStage({ kind: 'previewing', backup, preview: backup.preview });
      } catch (error) {
        fail(error);
      }
    },
    [fail],
  );

  const confirmRestore = useCallback(async () => {
    if (stage.kind !== 'previewing' || db === null) {
      return;
    }

    const { backup } = stage;
    setStage({ kind: 'restoring' });

    try {
      const result = await restoreVault({ db, backup });

      // The restored vault's own settings, applied defensively: the file could
      // have been written by a build whose values this one does not know.
      if (backup.payload.preferences !== null) {
        await updatePreferences(parsePreferences(backup.payload.preferences));
      } else {
        await initialisePreferences();
      }

      // Every pending notification belonged to the vault that was just
      // replaced. F7 rebuilds wholesale rather than diffing, so asking is all
      // that is needed.
      requestReminderSync();

      setStage({ kind: 'restored', ...result });
    } catch (error) {
      fail(error);
    }
  }, [stage, db, fail]);

  return {
    stage,
    databaseReady: db !== null,
    reset,
    runExport,
    shareExport,
    pickAndOpen,
    confirmRestore,
  };
}
