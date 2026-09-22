import { act, render, waitFor } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';

import { itemsRepository, reminderRulesRepository } from '@/db';
import { DatabaseProvider } from '@/db/DatabaseProvider';
import { createMigratedTestDatabase } from '@/db/testing/betterSqlite3';
import type { Database } from '@/db/types';
import { addDays, todayLocal } from '@/features/expiry';
import type { NotificationPort, PermissionState } from '@/services/notifications';

import type { PlannedNotification } from '../computeReminders';
import {
  requestReminderSync,
  resetReminderStore,
  useReminderState,
} from '../reminderStore';
import { useReminderSync } from '../useReminderSync';

/**
 * The trigger points. Scheduling itself is covered by `syncNotifications`; what
 * matters here is that it actually runs when it should.
 */

let db: Database;
let scheduled: PlannedNotification[];

function makePort(permission: PermissionState = 'granted'): NotificationPort {
  return {
    getPermission: async () => permission,
    requestPermission: async () => permission,
    schedule: async (plan) => {
      scheduled.push(plan);

      return `identifier-${scheduled.length}`;
    },
    cancelAll: async () => {
      scheduled = [];
    },
    listScheduled: async () => [],
  };
}

function Harness({ port }: { port: NotificationPort }) {
  useReminderSync({ port });
  const { outcome, error } = useReminderState();

  return (
    <Text testID="outcome">
      {error !== null
        ? `error:${error.message}`
        : outcome === null
          ? 'pending'
          : `${outcome.permission}:${outcome.scheduled}`}
    </Text>
  );
}

beforeEach(async () => {
  resetReminderStore();
  scheduled = [];
  db = await createMigratedTestDatabase();

  const item = await itemsRepository.createItem(db, {
    title: 'Passport',
    category: 'passport',
    expiryDate: addDays(todayLocal(), 400),
  });
  await reminderRulesRepository.createReminderRules(db, item.id, item.expiryDate, [180, 30]);
});

afterEach(async () => {
  await db.closeAsync();
});

describe('useReminderSync', () => {
  it('schedules on mount', async () => {
    render(
      <DatabaseProvider database={db}>
        <Harness port={makePort()} />
      </DatabaseProvider>,
    );

    await waitFor(() => {
      expect(scheduled).toHaveLength(2);
    });
  });

  it('records the outcome in the store, so the sheet can read it', async () => {
    const view = render(
      <DatabaseProvider database={db}>
        <Harness port={makePort()} />
      </DatabaseProvider>,
    );

    await waitFor(() => {
      expect(view.getByTestId('outcome')).toHaveTextContent('granted:2');
    });
  });

  it('reschedules when a screen asks for a resync', async () => {
    render(
      <DatabaseProvider database={db}>
        <Harness port={makePort()} />
      </DatabaseProvider>,
    );

    await waitFor(() => {
      expect(scheduled).toHaveLength(2);
    });

    // A mutation elsewhere in the app.
    scheduled = [];
    act(() => {
      requestReminderSync();
    });

    await waitFor(() => {
      expect(scheduled).toHaveLength(2);
    });
  });

  it('reschedules when the app returns to the foreground', async () => {
    const listeners: ((status: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _event: string,
      handler: (status: string) => void,
    ) => {
      listeners.push(handler);

      return { remove: jest.fn() };
    }) as unknown as typeof AppState.addEventListener);

    render(
      <DatabaseProvider database={db}>
        <Harness port={makePort()} />
      </DatabaseProvider>,
    );

    await waitFor(() => {
      expect(scheduled).toHaveLength(2);
    });

    scheduled = [];
    act(() => {
      for (const listener of listeners) {
        listener('active');
      }
    });

    // The window is rolling, so resuming after a long absence has to advance it.
    await waitFor(() => {
      expect(scheduled).toHaveLength(2);
    });

    jest.restoreAllMocks();
  });

  it('does not reschedule when the app merely goes to the background', async () => {
    const listeners: ((status: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _event: string,
      handler: (status: string) => void,
    ) => {
      listeners.push(handler);

      return { remove: jest.fn() };
    }) as unknown as typeof AppState.addEventListener);

    render(
      <DatabaseProvider database={db}>
        <Harness port={makePort()} />
      </DatabaseProvider>,
    );

    await waitFor(() => {
      expect(scheduled).toHaveLength(2);
    });

    scheduled = [];
    act(() => {
      for (const listener of listeners) {
        listener('background');
      }
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(scheduled).toHaveLength(0);

    jest.restoreAllMocks();
  });

  it('schedules nothing while permission is missing', async () => {
    const view = render(
      <DatabaseProvider database={db}>
        <Harness port={makePort('denied')} />
      </DatabaseProvider>,
    );

    await waitFor(() => {
      expect(view.getByTestId('outcome')).toHaveTextContent('denied:0');
    });
    expect(scheduled).toHaveLength(0);
  });

  it('survives a failing sync without taking the app down', async () => {
    const port = makePort();
    port.schedule = async () => {
      throw new Error('native failure');
    };

    const view = render(
      <DatabaseProvider database={db}>
        <Harness port={port} />
      </DatabaseProvider>,
    );

    await waitFor(() => {
      expect(view.getByTestId('outcome')).toHaveTextContent('error:native failure');
    });
    expect(scheduled).toHaveLength(0);
  });
});
