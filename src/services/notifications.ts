import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { PlannedNotification } from '@/features/reminders/computeReminders';
import { notificationText } from '@/features/reminders/messages';

/**
 * The only file in the app that imports `expo-notifications`.
 *
 * Same containment as `src/components/Icon.tsx` gives the icon library: the
 * engine above talks to `NotificationPort`, so the scheduling logic is testable
 * without a native module, and replacing the library stays a one-file change.
 *
 * Everything here is local. No push token is ever requested, no project id is
 * configured and nothing reaches the network, which is what F5's "Local
 * notifications only. Nothing leaves this device." promises the user.
 */

/** The Android channel documents are reminded on. */
export const REMINDER_CHANNEL_ID = 'reminders';

/** The key carrying the deep link, read back when a notification is tapped. */
export const DEEP_LINK_DATA_KEY = 'deepLink';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export interface ScheduledSummary {
  identifier: string;
  title: string;
  fireAt: Date | null;
}

export interface NotificationPort {
  getPermission(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
  schedule(plan: PlannedNotification): Promise<string>;
  cancelAll(): Promise<void>;
  listScheduled(): Promise<ScheduledSummary[]>;
}

/**
 * Notifications arriving while the app is open are shown as a banner but not
 * sounded — the user is already looking at the app, and a document expiring in
 * 90 days does not warrant interrupting them twice.
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Creates the Android channel. A no-op on iOS, and safe to call repeatedly:
 * the platform treats it as an update, except for importance, which the user
 * owns once the channel exists.
 *
 * Importance is DEFAULT rather than HIGH on purpose. HIGH is a heads-up card
 * with sound, and an expiry reminder months out that interrupts whatever you
 * are doing is the notification people switch off entirely.
 */
export async function configureNotificationChannel(lightColor: string): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Document reminders',
    description: 'Alerts before one of your documents expires.',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor,
  });
}

function toPermissionState(status: Notifications.NotificationPermissionsStatus): PermissionState {
  if (status.granted) {
    return 'granted';
  }

  // `canAskAgain` distinguishes "not asked yet" from "asked and refused", which
  // is what decides between showing the rationale and pointing at Settings.
  return status.canAskAgain ? 'undetermined' : 'denied';
}

export const notificationPort: NotificationPort = {
  async getPermission() {
    return toPermissionState(await Notifications.getPermissionsAsync());
  },

  /**
   * On Android 13+ this is the POST_NOTIFICATIONS prompt; on 12 and below it
   * resolves granted without showing anything. One code path, no branch.
   */
  async requestPermission() {
    return toPermissionState(await Notifications.requestPermissionsAsync());
  },

  async schedule(plan) {
    const { title, body } = notificationText(plan.content);

    return Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        // The route only. No document number, no issuer: notification payloads
        // are readable on the lock screen and in system logs.
        data: { [DEEP_LINK_DATA_KEY]: plan.deepLink },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: plan.fireAt,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
  },

  async cancelAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  async listScheduled() {
    const requests = await Notifications.getAllScheduledNotificationsAsync();

    return requests.map((request) => ({
      identifier: request.identifier,
      title: request.content.title ?? '',
      fireAt: triggerDate(request.trigger),
    }));
  },
};

function readDeepLink(response: Notifications.NotificationResponse | null): string | null {
  const value = response?.notification.request.content.data?.[DEEP_LINK_DATA_KEY];

  return typeof value === 'string' && value.startsWith('/') ? value : null;
}

/**
 * The route carried by a notification tapped while the app was not running.
 *
 * Read once at startup and cleared, so returning to the app later does not
 * navigate somewhere the user did not just ask for.
 */
export function consumeInitialDeepLink(): string | null {
  // The synchronous pair, not the `…Async` ones: those are deprecated in SDK 57
  // in favour of these.
  const deepLink = readDeepLink(Notifications.getLastNotificationResponse());

  if (deepLink !== null) {
    Notifications.clearLastNotificationResponse();
  }

  return deepLink;
}

/** Taps arriving while the app is running. Returns an unsubscribe function. */
export function addDeepLinkListener(handler: (deepLink: string) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const deepLink = readDeepLink(response);

    if (deepLink !== null) {
      handler(deepLink);
    }
  });

  return () => {
    subscription.remove();
  };
}

function triggerDate(trigger: Notifications.NotificationTrigger): Date | null {
  if (trigger !== null && typeof trigger === 'object' && 'value' in trigger) {
    const { value } = trigger;

    if (typeof value === 'number') {
      return new Date(value);
    }
  }

  return null;
}
