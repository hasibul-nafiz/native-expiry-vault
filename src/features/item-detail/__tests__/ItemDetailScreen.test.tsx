import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { itemsRepository, renewalsRepository, renewalTasksRepository } from '@/db';
import { DatabaseProvider } from '@/db/DatabaseProvider';
import type { Item } from '@/db/models';
import { createMigratedTestDatabase } from '@/db/testing/betterSqlite3';
import type { Database } from '@/db/types';
import { addDays, todayLocal } from '@/features/expiry';
import { ThemeProvider } from '@/theme';

import { ItemDetailScreen } from '../ItemDetailScreen';

const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useFocusEffect: () => undefined,
}));

/** The date picker is a native view with no JS representation. */
jest.mock('@expo/ui/community/datetime-picker', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    DateTimePicker: ({
      onValueChange,
      testID,
    }: {
      onValueChange?: (event: unknown, date: Date) => void;
      testID?: string;
    }) => (
      <Pressable
        onPress={() => {
          onValueChange?.({}, new Date(2036, 4, 14, 12, 0, 0));
        }}
        testID={testID}
      >
        <Text>picker</Text>
      </Pressable>
    ),
  };
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const today = todayLocal();
let db: Database;
let item: Item;

function at(days: number): string {
  return addDays(today, days);
}

function wrap(ui: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <DatabaseProvider database={db}>{ui}</DatabaseProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

/** Presses the destructive choice in the most recent Alert. */
function pressAlertButton(spy: jest.SpyInstance, style: 'destructive' | 'cancel') {
  const buttons = spy.mock.calls[spy.mock.calls.length - 1][2] as {
    style?: string;
    onPress?: () => void;
  }[];
  const button = buttons.find((candidate) => candidate.style === style);
  button?.onPress?.();
}

beforeEach(async () => {
  mockBack.mockClear();
  mockPush.mockClear();
  db = await createMigratedTestDatabase();
  item = await itemsRepository.createItem(db, {
    title: 'German Residence Permit',
    category: 'visa',
    issuer: 'Berlin LEA',
    documentNumber: 'DE9204',
    issueDate: at(-1077),
    expiryDate: at(18),
  });
});

afterEach(async () => {
  await db.closeAsync();
});

describe('rendering', () => {
  it('shows the document and its countdown', async () => {
    wrap(<ItemDetailScreen itemId={item.id} />);

    expect(await screen.findByTestId('item-title')).toHaveTextContent('German Residence Permit');
    expect(screen.getByTestId('countdown-days')).toHaveTextContent('18');
    expect(screen.getByTestId('countdown-ring')).toBeOnTheScreen();
  });

  it('masks the document number until it is revealed', async () => {
    wrap(<ItemDetailScreen itemId={item.id} />);

    const field = await screen.findByTestId('document-number');
    expect(field).toHaveTextContent('•••• 9204');

    fireEvent.press(screen.getByTestId('toggle-document-number'));

    expect(screen.getByTestId('document-number')).toHaveTextContent('DE9204');
  });

  it('reports a document that no longer exists', async () => {
    wrap(<ItemDetailScreen itemId="ghost" />);

    expect(await screen.findByTestId('item-missing')).toBeOnTheScreen();
  });

  it('says so when there are no scans or notes', async () => {
    wrap(<ItemDetailScreen itemId={item.id} />);

    expect(await screen.findByTestId('attachments-empty')).toBeOnTheScreen();
    expect(screen.getByTestId('notes-empty')).toBeOnTheScreen();
  });
});

describe('deleting', () => {
  it('asks before deleting anything', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    wrap(<ItemDetailScreen itemId={item.id} />);

    fireEvent.press(await screen.findByTestId('delete-button'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete German Residence Permit?',
      expect.stringContaining('cannot be undone'),
      expect.any(Array),
    );
    await expect(itemsRepository.countItems(db)).resolves.toBe(1);
    alertSpy.mockRestore();
  });

  it('deletes nothing when the confirm is dismissed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    wrap(<ItemDetailScreen itemId={item.id} />);

    fireEvent.press(await screen.findByTestId('delete-button'));
    pressAlertButton(alertSpy, 'cancel');

    await expect(itemsRepository.countItems(db)).resolves.toBe(1);
    expect(mockBack).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('deletes and navigates back when confirmed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    wrap(<ItemDetailScreen itemId={item.id} />);

    fireEvent.press(await screen.findByTestId('delete-button'));
    pressAlertButton(alertSpy, 'destructive');

    await waitFor(async () => {
      await expect(itemsRepository.countItems(db)).resolves.toBe(0);
    });
    expect(mockBack).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('renewing', () => {
  it('asks for a new expiry date rather than renewing blindly', async () => {
    wrap(<ItemDetailScreen itemId={item.id} />);

    fireEvent.press(await screen.findByTestId('renew-button'));

    expect(await screen.findByTestId('renew-sheet')).toBeOnTheScreen();
    expect(screen.getByTestId('renew-date')).toBeOnTheScreen();
  });

  it('records the renewal and moves the expiry date', async () => {
    wrap(<ItemDetailScreen itemId={item.id} />);

    fireEvent.press(await screen.findByTestId('renew-button'));
    fireEvent.press(await screen.findByTestId('renew-date'));
    fireEvent.press(await screen.findByTestId('renew-date-picker'));
    fireEvent.press(screen.getByTestId('confirm-renewal'));

    await waitFor(async () => {
      const updated = await itemsRepository.getItem(db, item.id);
      expect(updated?.expiryDate).toBe('2036-05-14');
    });
  });

  it('keeps the previous expiry in the history', async () => {
    const previous = item.expiryDate;
    wrap(<ItemDetailScreen itemId={item.id} />);

    fireEvent.press(await screen.findByTestId('renew-button'));
    fireEvent.press(await screen.findByTestId('renew-date'));
    fireEvent.press(await screen.findByTestId('renew-date-picker'));
    fireEvent.press(screen.getByTestId('confirm-renewal'));

    await waitFor(async () => {
      const history = await renewalsRepository.listRenewals(db, item.id);
      expect(history).toHaveLength(1);
      expect(history[0].previousExpiryDate).toBe(previous);
    });
  });

  it('shows the history once a renewal exists', async () => {
    await itemsRepository.markItemRenewed(db, item.id, at(1000), today);

    wrap(<ItemDetailScreen itemId={item.id} />);

    expect(await screen.findByTestId('renewal-history')).toBeOnTheScreen();
  });

  it('changes nothing when the sheet is cancelled', async () => {
    wrap(<ItemDetailScreen itemId={item.id} />);

    fireEvent.press(await screen.findByTestId('renew-button'));
    fireEvent.press(await screen.findByTestId('cancel-renewal'));

    await expect(renewalsRepository.countRenewals(db, item.id)).resolves.toBe(0);
    await expect(itemsRepository.getItem(db, item.id)).resolves.toMatchObject({
      expiryDate: at(18),
    });
  });
});

describe('archiving', () => {
  it('archives without a confirm, since it is reversible', async () => {
    wrap(<ItemDetailScreen itemId={item.id} />);

    fireEvent.press(await screen.findByTestId('archive-button'));

    await waitFor(async () => {
      const updated = await itemsRepository.getItem(db, item.id);
      expect(updated?.archivedAt).not.toBeNull();
    });
  });

  it('shows a banner and can restore the item', async () => {
    await itemsRepository.archiveItem(db, item.id);
    wrap(<ItemDetailScreen itemId={item.id} />);

    expect(await screen.findByTestId('archived-banner')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('unarchive-button'));

    await waitFor(async () => {
      const updated = await itemsRepository.getItem(db, item.id);
      expect(updated?.archivedAt).toBeNull();
    });
  });
});

describe('the renewal checklist', () => {
  it('starts with nothing ticked and no rows written', async () => {
    wrap(<ItemDetailScreen itemId={item.id} />);

    expect(await screen.findByTestId('checklist-counter')).toHaveTextContent('0 of 4 ready');
    await expect(renewalTasksRepository.listRenewalTasks(db, item.id)).resolves.toEqual([]);
  });

  it('persists a tick and moves the counter', async () => {
    wrap(<ItemDetailScreen itemId={item.id} />);

    const step = await screen.findByTestId('checklist-step-Download the official application form');
    fireEvent.press(step);

    await waitFor(async () => {
      const tasks = await renewalTasksRepository.listRenewalTasks(db, item.id);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].done).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByTestId('checklist-counter')).toHaveTextContent('1 of 4 ready');
    });
  });

  it('unticks without creating a second row', async () => {
    wrap(<ItemDetailScreen itemId={item.id} />);

    const label = 'checklist-step-Download the official application form';
    fireEvent.press(await screen.findByTestId(label));
    await waitFor(async () => {
      await expect(renewalTasksRepository.listRenewalTasks(db, item.id)).resolves.toHaveLength(1);
    });

    fireEvent.press(screen.getByTestId(label));

    await waitFor(async () => {
      const tasks = await renewalTasksRepository.listRenewalTasks(db, item.id);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].done).toBe(false);
    });
  });
});

describe('editing', () => {
  it('routes to the edit screen', async () => {
    wrap(<ItemDetailScreen itemId={item.id} />);

    fireEvent.press(await screen.findByTestId('edit-button'));

    expect(mockPush).toHaveBeenCalledWith(`/item/${item.id}/edit`);
  });
});
