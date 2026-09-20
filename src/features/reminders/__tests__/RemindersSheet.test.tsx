import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type {
  NotificationPort,
  PermissionState,
  ScheduledSummary,
} from '@/services/notifications';
import { ThemeProvider } from '@/theme';

import type { PlannedNotification } from '../computeReminders';
import { RemindersSheet, summaryLine } from '../RemindersSheet';
import { reminderSyncSucceeded, resetReminderStore } from '../reminderStore';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function wrap(ui: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );
}

function makePort(permission: PermissionState, scheduled: ScheduledSummary[] = []) {
  const port: NotificationPort = {
    getPermission: jest.fn(async () => permission),
    requestPermission: jest.fn(async () => 'granted' as PermissionState),
    schedule: jest.fn(async (_plan: PlannedNotification) => 'identifier'),
    cancelAll: jest.fn(async () => undefined),
    listScheduled: jest.fn(async () => scheduled),
  };

  return port;
}

beforeEach(() => {
  resetReminderStore();
  jest.restoreAllMocks();
});

describe('RemindersSheet', () => {
  it('offers to turn reminders on when they have never been asked for', async () => {
    wrap(<RemindersSheet onClose={jest.fn()} port={makePort('undetermined')} visible />);

    expect(await screen.findByTestId('reminders-grant')).toBeOnTheScreen();
    expect(screen.queryByTestId('reminders-denied')).not.toBeOnTheScreen();
  });

  it('explains the refusal and offers system settings when denied', async () => {
    wrap(<RemindersSheet onClose={jest.fn()} port={makePort('denied')} visible />);

    expect(await screen.findByTestId('reminders-denied')).toBeOnTheScreen();
    expect(screen.getByTestId('reminders-settings')).toBeOnTheScreen();
    // Asking again would do nothing; the OS will not show the prompt twice.
    expect(screen.queryByTestId('reminders-grant')).not.toBeOnTheScreen();
  });

  it('opens system settings from the denied state', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    wrap(<RemindersSheet onClose={jest.fn()} port={makePort('denied')} visible />);

    fireEvent.press(await screen.findByTestId('reminders-settings'));

    expect(openSettings).toHaveBeenCalled();
  });

  it('says nothing is scheduled yet when permitted but empty', async () => {
    wrap(<RemindersSheet onClose={jest.fn()} port={makePort('granted')} visible />);

    expect(await screen.findByTestId('reminders-none')).toBeOnTheScreen();
  });

  it('lists the upcoming reminders when permitted', async () => {
    const port = makePort('granted', [
      { identifier: '1', title: 'Passport', fireAt: new Date(2026, 10, 1, 9, 0, 0) },
      { identifier: '2', title: '3 documents need attention', fireAt: new Date(2027, 0, 5, 9) },
    ]);

    wrap(<RemindersSheet onClose={jest.fn()} port={port} visible />);

    expect(await screen.findByTestId('reminders-upcoming')).toBeOnTheScreen();
    expect(screen.getByText('Passport')).toBeOnTheScreen();
    expect(screen.getByText('3 documents need attention')).toBeOnTheScreen();
  });

  it('orders the preview soonest first', async () => {
    const port = makePort('granted', [
      { identifier: 'later', title: 'Visa', fireAt: new Date(2027, 0, 5, 9) },
      { identifier: 'sooner', title: 'Passport', fireAt: new Date(2026, 10, 1, 9) },
    ]);

    wrap(<RemindersSheet onClose={jest.fn()} port={port} visible />);
    await screen.findByTestId('reminders-upcoming');

    const rendered = screen.getAllByText(/Visa|Passport/).map((node) => node.props.children);

    expect(rendered).toEqual(['Passport', 'Visa']);
  });

  it('requests permission and asks for a resync once granted', async () => {
    const port = makePort('undetermined');
    wrap(<RemindersSheet onClose={jest.fn()} port={port} visible />);

    fireEvent.press(await screen.findByTestId('reminders-grant'));

    await waitFor(() => {
      expect(port.requestPermission).toHaveBeenCalled();
    });

    // The sheet moves to its granted state without needing to be reopened.
    expect(await screen.findByTestId('reminders-none')).toBeOnTheScreen();
    expect(screen.queryByTestId('reminders-grant')).not.toBeOnTheScreen();
  });

  it('does not ask for a resync when the request is refused', async () => {
    const port = makePort('undetermined');
    port.requestPermission = jest.fn(async () => 'denied' as PermissionState);

    wrap(<RemindersSheet onClose={jest.fn()} port={port} visible />);
    fireEvent.press(await screen.findByTestId('reminders-grant'));

    expect(await screen.findByTestId('reminders-denied')).toBeOnTheScreen();
  });

  it('reports how far ahead the schedule reaches', async () => {
    reminderSyncSucceeded({
      scheduled: 2,
      stale: 0,
      deferred: 0,
      scheduledThrough: '2027-01-05',
      permission: 'granted',
    });

    const port = makePort('granted', [
      { identifier: '1', title: 'Passport', fireAt: new Date(2026, 10, 1, 9) },
      { identifier: '2', title: 'Visa', fireAt: new Date(2027, 0, 5, 9) },
    ]);

    wrap(<RemindersSheet onClose={jest.fn()} port={port} visible />);

    expect(await screen.findByTestId('reminders-summary')).toHaveTextContent(/2027-01-05/);
  });

  it('asks the OS nothing while closed', () => {
    const port = makePort('granted');
    wrap(<RemindersSheet onClose={jest.fn()} port={port} visible={false} />);

    expect(port.getPermission).not.toHaveBeenCalled();
  });
});

describe('summaryLine', () => {
  it('reads naturally for one reminder', () => {
    expect(summaryLine(1, '2027-01-05', '2026-09-20')).toBe(
      '1 reminder is scheduled, covering everything due up to 2027-01-05.',
    );
  });

  it('pluralises', () => {
    expect(summaryLine(4, '2027-01-05', '2026-09-20')).toContain('4 reminders are scheduled');
  });

  it('omits a horizon that is not in the future', () => {
    expect(summaryLine(2, '2026-09-20', '2026-09-20')).toBe('2 reminders are scheduled.');
    expect(summaryLine(2, null, '2026-09-20')).toBe('2 reminders are scheduled.');
  });
});
