import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useDatabaseState } from '@/db/DatabaseProvider';
import { notificationPort, type NotificationPort } from '@/services/notifications';
import { usePreferences } from '@/settings/store';

import {
  reminderSyncFailed,
  reminderSyncStarted,
  reminderSyncSucceeded,
  requestReminderSync,
  useReminderState,
  type ReminderState,
} from './reminderStore';
import { syncNotifications } from './syncNotifications';

/**
 * Keeps the OS's pending notifications in step with the vault.
 *
 * Mounted once, inside the lock gate. Three things make the schedule stale and
 * each is covered here: time passing (resume), the app being opened at all
 * (launch), and a document changing (`requestReminderSync`).
 *
 * Resume matters more than it looks. The schedule is a rolling window, so a
 * vault with more reminders than the budget only advances when something
 * re-runs this; without the resume trigger, an app left open for weeks would
 * hold a window that had entirely elapsed.
 */

export interface UseReminderSyncOptions {
  /** Injected by tests. */
  port?: NotificationPort;
}

export function useReminderSync({ port = notificationPort }: UseReminderSyncOptions = {}): void {
  const databaseState = useDatabaseState();
  const { revision } = useReminderState();
  const { reminderHour } = usePreferences();

  const db = databaseState.status === 'ready' ? databaseState.db : null;

  useEffect(() => {
    if (db === null) {
      return;
    }

    let active = true;

    reminderSyncStarted();

    syncNotifications(db, port, { hour: reminderHour })
      .then((outcome) => {
        if (active) {
          reminderSyncSucceeded(outcome);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          // A failed sync is not a failed app: the documents are all still
          // there and the next launch tries again.
          reminderSyncFailed(error instanceof Error ? error : new Error(String(error)));
        }
      });

    return () => {
      active = false;
    };
  }, [db, port, revision, reminderHour]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        requestReminderSync();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
}

export type { ReminderState };
