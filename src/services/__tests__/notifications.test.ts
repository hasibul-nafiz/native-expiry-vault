import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { PlannedNotification } from '@/features/reminders/computeReminders';

import {
  configureNotificationChannel,
  configureNotificationHandler,
  DEEP_LINK_DATA_KEY,
  notificationPort,
  REMINDER_CHANNEL_ID,
} from '../notifications';

/**
 * The native boundary. `expo-notifications` is mocked because there is no OS
 * here to schedule against; what is asserted is the shape of what we hand it,
 * which is the part that silently does nothing if it is wrong.
 */

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(async () => 'identifier-1'),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
}));

const mocked = jest.mocked(Notifications);

const plan: PlannedNotification = {
  fireDate: '2026-11-01',
  fireAt: new Date(2026, 10, 1, 9, 0, 0),
  ruleIds: ['r1'],
  itemIds: ['a'],
  content: {
    kind: 'single',
    itemId: 'a',
    itemTitle: 'Passport',
    category: 'passport',
    daysUntilExpiry: 30,
  },
  deepLink: '/item/a',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('configureNotificationHandler', () => {
  it('shows a banner without a sound while the app is open', async () => {
    configureNotificationHandler();

    const [handler] = mocked.setNotificationHandler.mock.calls[0];
    const behaviour = await handler?.handleNotification({} as Notifications.Notification);

    expect(behaviour).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
  });
});

describe('configureNotificationChannel', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  });

  function setPlatform(os: typeof Platform.OS) {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
  }

  it('creates the reminder channel on Android', async () => {
    setPlatform('android');

    await configureNotificationChannel('#4648d4');

    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledWith(
      REMINDER_CHANNEL_ID,
      expect.objectContaining({
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#4648d4',
      }),
    );
  });

  it('uses DEFAULT importance, not HIGH', async () => {
    setPlatform('android');

    await configureNotificationChannel('#4648d4');

    const [, channel] = mocked.setNotificationChannelAsync.mock.calls[0];

    // HIGH is a heads-up card with sound; an expiry months away must not be one.
    expect(channel.importance).not.toBe(Notifications.AndroidImportance.HIGH);
  });

  it('does nothing on iOS', async () => {
    setPlatform('ios');

    await configureNotificationChannel('#4648d4');

    expect(mocked.setNotificationChannelAsync).not.toHaveBeenCalled();
  });
});

describe('permissions', () => {
  function respond(granted: boolean, canAskAgain: boolean) {
    return {
      granted,
      canAskAgain,
      status: granted ? 'granted' : 'denied',
      expires: 'never',
    } as Notifications.NotificationPermissionsStatus;
  }

  it('reports granted', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(respond(true, false));

    await expect(notificationPort.getPermission()).resolves.toBe('granted');
  });

  it('distinguishes never-asked from refused', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(respond(false, true));
    await expect(notificationPort.getPermission()).resolves.toBe('undetermined');

    mocked.getPermissionsAsync.mockResolvedValue(respond(false, false));
    await expect(notificationPort.getPermission()).resolves.toBe('denied');
  });

  it('reports a refusal rather than throwing', async () => {
    mocked.requestPermissionsAsync.mockResolvedValue(respond(false, false));

    await expect(notificationPort.requestPermission()).resolves.toBe('denied');
  });
});

describe('schedule', () => {
  it('uses a DATE trigger at the planned instant', async () => {
    await notificationPort.schedule(plan);

    const [request] = mocked.scheduleNotificationAsync.mock.calls[0];

    expect(request.trigger).toEqual({
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: plan.fireAt,
      channelId: REMINDER_CHANNEL_ID,
    });
  });

  it('carries only the route in the payload', async () => {
    await notificationPort.schedule(plan);

    const [request] = mocked.scheduleNotificationAsync.mock.calls[0];

    // Notification payloads are visible on the lock screen; nothing identifying
    // the document beyond its title may travel in them.
    expect(request.content.data).toEqual({ [DEEP_LINK_DATA_KEY]: '/item/a' });
  });

  it('renders the notification text', async () => {
    await notificationPort.schedule(plan);

    const [request] = mocked.scheduleNotificationAsync.mock.calls[0];

    expect(request.content.title).toBe('Passport');
    expect(request.content.body).toBe('Expires in 30 days.');
  });

  it('returns the identifier the OS gave back', async () => {
    await expect(notificationPort.schedule(plan)).resolves.toBe('identifier-1');
  });
});

describe('listScheduled', () => {
  it('reads back the pending notifications with their fire dates', async () => {
    const fireAt = new Date(2026, 10, 1, 9, 0, 0);
    mocked.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'identifier-1',
        content: { title: 'Passport' },
        trigger: { type: 'date', value: fireAt.getTime() },
      },
    ] as unknown as Notifications.NotificationRequest[]);

    await expect(notificationPort.listScheduled()).resolves.toEqual([
      { identifier: 'identifier-1', title: 'Passport', fireAt },
    ]);
  });

  it('tolerates a trigger it cannot read a date from', async () => {
    mocked.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'identifier-1', content: { title: null }, trigger: null },
    ] as unknown as Notifications.NotificationRequest[]);

    await expect(notificationPort.listScheduled()).resolves.toEqual([
      { identifier: 'identifier-1', title: '', fireAt: null },
    ]);
  });
});
