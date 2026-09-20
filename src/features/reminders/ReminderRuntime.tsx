import { useEffect } from 'react';

import {
  configureNotificationChannel,
  configureNotificationHandler,
  type NotificationPort,
} from '@/services/notifications';
import { useTheme } from '@/theme';

import { useNotificationDeepLink } from './useNotificationDeepLink';
import { useReminderSync } from './useReminderSync';

/**
 * Renders nothing; runs the reminder engine.
 *
 * A component rather than a hook called from the layout, so the three
 * behaviours — channel setup, scheduling, deep links — travel together and the
 * route file stays as thin as `CLAUDE.md` asks.
 *
 * It sits inside the lock gate deliberately. A locked vault should neither
 * reschedule notifications nor follow one into a document.
 */

export interface ReminderRuntimeProps {
  /** Injected by tests. */
  port?: NotificationPort;
}

export function ReminderRuntime({ port }: ReminderRuntimeProps) {
  const theme = useTheme();
  const channelColor = theme.colors.primary;

  useEffect(() => {
    configureNotificationHandler();
    // The Android channel's accent colour is a theme token, not a literal.
    void configureNotificationChannel(channelColor);
  }, [channelColor]);

  useReminderSync(port === undefined ? {} : { port });
  useNotificationDeepLink();

  return null;
}
