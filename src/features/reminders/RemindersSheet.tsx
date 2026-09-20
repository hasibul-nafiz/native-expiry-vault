import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { BottomSheet, Button, Icon, Text } from '@/components';
import { todayLocal } from '@/features/expiry';
import {
  notificationPort,
  type NotificationPort,
  type PermissionState,
  type ScheduledSummary,
} from '@/services/notifications';
import { useTheme } from '@/theme';

import { requestReminderSync, useReminderState } from './reminderStore';

/**
 * What the dashboard's bell opens.
 *
 * Nothing in the export covers this — the bell is drawn with no behaviour, and
 * there is no notifications screen anywhere — so all of it is designed here.
 * It exists because a permission prompt needs a second chance: someone who
 * declines once otherwise has no route back to reminders until Settings is
 * built, and would simply never be reminded of anything again.
 */

export interface RemindersSheetProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Called once the permission prompt has been answered, either way.
   *
   * The add form passes its own dismissal here: when the sheet is the last step
   * of saving a document, the answer is the end of the task and leaving the
   * sheet open would strand the user on it. Opened from the bell, there is no
   * task to end, so it stays open showing the new state.
   */
  onPermissionResolved?: () => void;
  /** Injected by tests. */
  port?: NotificationPort;
}

/** How many upcoming reminders are listed before the summary line takes over. */
const PREVIEW_COUNT = 3;

export function RemindersSheet({
  visible,
  onClose,
  onPermissionResolved,
  port = notificationPort,
}: RemindersSheetProps) {
  const theme = useTheme();
  const { outcome, syncing } = useReminderState();
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [upcoming, setUpcoming] = useState<ScheduledSummary[]>([]);
  const [requesting, setRequesting] = useState(false);

  const refresh = useCallback(() => {
    let active = true;

    Promise.all([port.getPermission(), port.listScheduled()])
      .then(([state, scheduled]) => {
        if (active) {
          setPermission(state);
          setUpcoming(scheduled);
        }
      })
      .catch(() => {
        if (active) {
          setPermission(null);
        }
      });

    return () => {
      active = false;
    };
  }, [port]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    return refresh();
  }, [visible, refresh, outcome]);

  const grant = useCallback(() => {
    setRequesting(true);

    port
      .requestPermission()
      .then((state) => {
        setPermission(state);

        if (state === 'granted') {
          // Everything already stored is scheduled at once, so granting late
          // costs the user nothing.
          requestReminderSync();
        }

        onPermissionResolved?.();
      })
      .catch(() => undefined)
      .finally(() => {
        setRequesting(false);
      });
  }, [onPermissionResolved, port]);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return (
    <BottomSheet onClose={onClose} testID="reminders-sheet" title="Reminders" visible={visible}>
      <View style={{ gap: theme.spacing.md }}>
        <Text color="onSurfaceVariant" variant="bodyMd">
          ExpiryVault reminds you before a document runs out. Reminders are scheduled on this device
          and nothing is sent anywhere.
        </Text>

        {permission === 'granted' ? (
          <GrantedBody
            scheduledThrough={outcome?.scheduledThrough ?? null}
            syncing={syncing}
            upcoming={upcoming}
          />
        ) : null}

        {permission === 'undetermined' ? (
          <Button
            disabled={requesting}
            label="Turn on reminders"
            loading={requesting}
            onPress={grant}
            testID="reminders-grant"
          />
        ) : null}

        {permission === 'denied' ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text testID="reminders-denied" variant="bodyMd">
              Notifications are switched off for ExpiryVault, so nothing can be scheduled. Your
              reminders are saved and will start as soon as you allow them.
            </Text>
            <Button
              label="Open settings"
              onPress={openSettings}
              testID="reminders-settings"
              variant="secondary"
            />
          </View>
        ) : null}

        {permission === null ? (
          <Text color="onSurfaceVariant" testID="reminders-unknown" variant="bodySm">
            Checking your notification settings…
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}

interface GrantedBodyProps {
  upcoming: ScheduledSummary[];
  scheduledThrough: string | null;
  syncing: boolean;
}

function GrantedBody({ upcoming, scheduledThrough, syncing }: GrantedBodyProps) {
  const theme = useTheme();
  const today = todayLocal();

  if (upcoming.length === 0) {
    return (
      <Text color="onSurfaceVariant" testID="reminders-none" variant="bodyMd">
        {syncing
          ? 'Working out when to remind you…'
          : 'Nothing is scheduled yet. Reminders appear here once you add a document that expires in the future.'}
      </Text>
    );
  }

  const preview = [...upcoming]
    .sort((a, b) => (a.fireAt?.getTime() ?? 0) - (b.fireAt?.getTime() ?? 0))
    .slice(0, PREVIEW_COUNT);

  return (
    <View style={{ gap: theme.spacing.sm }} testID="reminders-upcoming">
      <Text color="onSurfaceVariant" variant="labelSm">
        NEXT REMINDERS
      </Text>

      {preview.map((entry) => (
        <View
          key={entry.identifier}
          style={[
            styles.row,
            {
              backgroundColor: theme.colors.surfaceContainer,
              borderRadius: theme.radius.md,
              gap: theme.spacing.sm,
              padding: theme.spacing.md,
            },
          ]}
        >
          <Icon color="onSurfaceVariant" name="bell" size={18} />
          <Text numberOfLines={1} style={styles.rowText} variant="bodyMd">
            {entry.title}
          </Text>
          <Text color="onSurfaceVariant" variant="labelSm">
            {entry.fireAt === null ? '' : todayLocal(entry.fireAt)}
          </Text>
        </View>
      ))}

      <Text color="onSurfaceVariant" testID="reminders-summary" variant="bodySm">
        {summaryLine(upcoming.length, scheduledThrough, today)}
      </Text>
    </View>
  );
}

/**
 * Exported for its own test. The horizon is worth stating: the schedule is a
 * rolling window, not a promise about every reminder ever, and a user with a
 * large vault should be able to see where it currently reaches.
 */
export function summaryLine(
  count: number,
  scheduledThrough: string | null,
  today: string,
): string {
  const scheduled = count === 1 ? '1 reminder is scheduled' : `${count} reminders are scheduled`;

  if (scheduledThrough === null || scheduledThrough <= today) {
    return `${scheduled}.`;
  }

  return `${scheduled}, covering everything due up to ${scheduledThrough}.`;
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row' },
  rowText: { flex: 1 },
});
