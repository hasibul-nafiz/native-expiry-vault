import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { itemsRepository } from '@/db';
import { DatabaseProvider } from '@/db/DatabaseProvider';
import type { NewItem } from '@/db/models';
import { createMigratedTestDatabase } from '@/db/testing/betterSqlite3';
import type { Database } from '@/db/types';
import { addDays, todayLocal } from '@/features/expiry';
import { ThemeProvider } from '@/theme';

import { TimelineScreen } from '../TimelineScreen';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: () => undefined,
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const today = todayLocal();

function at(days: number): string {
  return addDays(today, days);
}

let db: Database;

function wrap(ui: ReactElement, database?: Database) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <DatabaseProvider database={database}>{ui}</DatabaseProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

async function seed(items: readonly NewItem[]): Promise<void> {
  for (const item of items) {
    await itemsRepository.createItem(db, item);
  }
}

beforeEach(async () => {
  mockPush.mockClear();
  db = await createMigratedTestDatabase();
});

describe('the empty state', () => {
  it('invites the user to add a document when the vault is empty', async () => {
    wrap(<TimelineScreen />, db);

    expect(await screen.findByTestId('timeline-empty')).toBeTruthy();
    // The list itself stays mounted in every state — it carries the header —
    // so an empty feed is the absence of months, not of the scroller.
    expect(screen.queryAllByTestId(/^timeline-month-/)).toHaveLength(0);
  });

  it('routes to the add flow', async () => {
    wrap(<TimelineScreen />, db);

    fireEvent.press(await screen.findByTestId('timeline-empty-add'));

    expect(mockPush).toHaveBeenCalledWith('/add');
  });
});

describe('the feed', () => {
  it('groups documents under the month they expire in', async () => {
    await seed([
      { title: 'Passport', category: 'passport', expiryDate: '2027-03-04' },
      { title: 'Visa', category: 'visa', expiryDate: '2027-03-28' },
      { title: 'Warranty', category: 'warranty', expiryDate: '2027-07-01' },
    ]);

    wrap(<TimelineScreen />, db);

    expect(await screen.findByTestId('timeline-month-2027-03')).toBeTruthy();
    expect(screen.getByTestId('timeline-month-2027-07')).toBeTruthy();
    expect(screen.getByText('Mar 2027')).toBeTruthy();
    expect(screen.getByText('Jul 2027')).toBeTruthy();
  });

  it('renders every document as its own card', async () => {
    const items = await Promise.all([
      itemsRepository.createItem(db, {
        title: 'Passport',
        category: 'passport',
        expiryDate: at(400),
      }),
      itemsRepository.createItem(db, {
        title: 'Visa',
        category: 'visa',
        expiryDate: at(20),
      }),
    ]);

    wrap(<TimelineScreen />, db);

    for (const item of items) {
      expect(await screen.findByTestId(`timeline-item-${item.id}`)).toBeTruthy();
    }
  });

  it('opens an item when its card is pressed', async () => {
    const item = await itemsRepository.createItem(db, {
      title: 'Passport',
      category: 'passport',
      expiryDate: at(90),
    });

    wrap(<TimelineScreen />, db);

    fireEvent.press(await screen.findByTestId(`timeline-item-${item.id}`));

    expect(mockPush).toHaveBeenCalledWith(`/item/${item.id}`);
  });

  it('excludes archived documents', async () => {
    const item = await itemsRepository.createItem(db, {
      title: 'Old permit',
      category: 'other',
      expiryDate: at(30),
    });
    await itemsRepository.archiveItem(db, item.id);

    wrap(<TimelineScreen />, db);

    expect(await screen.findByTestId('timeline-empty')).toBeTruthy();
  });
});

describe('the urgent banner', () => {
  it('appears when a document has already expired', async () => {
    await seed([{ title: 'Lapsed', category: 'other', expiryDate: at(-3) }]);

    wrap(<TimelineScreen />, db);

    expect(await screen.findByTestId('timeline-urgent-banner')).toBeTruthy();
    expect(screen.getByText('1 document has already expired.')).toBeTruthy();
  });

  it('pluralises the count', async () => {
    await seed([
      { title: 'One', category: 'other', expiryDate: at(-3) },
      { title: 'Two', category: 'other', expiryDate: at(-9) },
    ]);

    wrap(<TimelineScreen />, db);

    expect(await screen.findByText('2 documents have already expired.')).toBeTruthy();
  });

  it('stays hidden when nothing has lapsed', async () => {
    await seed([{ title: 'Fine', category: 'other', expiryDate: at(120) }]);

    wrap(<TimelineScreen />, db);

    await screen.findByTestId('timeline-list');
    expect(screen.queryByTestId('timeline-urgent-banner')).toBeNull();
  });
});

describe('the range filters', () => {
  beforeEach(async () => {
    await seed([
      { title: 'Urgent', category: 'other', expiryDate: at(10) },
      { title: 'Distant', category: 'other', expiryDate: at(900) },
    ]);
  });

  it('narrows the feed to the selected range', async () => {
    wrap(<TimelineScreen />, db);

    fireEvent.press(await screen.findByTestId('timeline-chip-next30'));

    await waitFor(() => {
      expect(screen.queryByText('Distant')).toBeNull();
    });
    expect(screen.getByText('Urgent')).toBeTruthy();
  });

  it('offers a way back when a range matches nothing', async () => {
    const empty = await createMigratedTestDatabase();
    await itemsRepository.createItem(empty, {
      title: 'Distant only',
      category: 'other',
      expiryDate: addDays(today, 900),
    });

    wrap(<TimelineScreen />, empty);

    fireEvent.press(await screen.findByTestId('timeline-chip-next30'));

    const clear = await screen.findByTestId('timeline-clear-filter');
    fireEvent.press(clear);

    expect(await screen.findByText('Distant only')).toBeTruthy();
  });
});

describe('failure states', () => {
  it('offers a retry when the database cannot be opened', async () => {
    const failing = {
      ...db,
      getAllAsync: jest.fn().mockRejectedValue(new Error('disk I/O error')),
    } as unknown as Database;

    wrap(<TimelineScreen />, failing);

    expect(await screen.findByTestId('timeline-error')).toBeTruthy();
  });
});

/**
 * The feed is a `SectionList`, which has cells and no wrapper to hang a single
 * rail on. These pin the invariant that replaced it: every cell paints its own
 * segment, which is what keeps the line unbroken.
 */
describe('the rail', () => {
  it('paints a segment on every cell, headers and cards alike', async () => {
    await seed([
      { title: 'Passport', category: 'passport', expiryDate: '2027-03-04' },
      { title: 'Visa', category: 'visa', expiryDate: '2027-03-28' },
      { title: 'Warranty', category: 'warranty', expiryDate: '2027-07-01' },
    ]);

    wrap(<TimelineScreen />, db);

    await screen.findByTestId('timeline-month-2027-03');

    // Two month headers and three cards: a gap in this count is a gap in the line.
    expect(screen.getAllByTestId('timeline-rail')).toHaveLength(5);
  });

  it('leaves no cell without one', async () => {
    await seed([{ title: 'Passport', category: 'passport', expiryDate: '2027-03-04' }]);

    wrap(<TimelineScreen />, db);

    await screen.findByTestId('timeline-month-2027-03');

    const cells =
      screen.getAllByTestId(/^timeline-month-/).length +
      screen.getAllByTestId(/^timeline-item-/).length;

    expect(screen.getAllByTestId('timeline-rail')).toHaveLength(cells);
  });

  it('never sticks the month headers, which would detach them from the rail', async () => {
    await seed([{ title: 'Passport', category: 'passport', expiryDate: '2027-03-04' }]);

    wrap(<TimelineScreen />, db);
    const list = await screen.findByTestId('timeline-list');

    // The flag reaches the host view as the set of sticky indices; a sticky
    // header would list its own index here.
    expect(list.props.stickyHeaderIndices).toEqual([]);
  });

  it('virtualizes rather than mounting every card', async () => {
    await seed([{ title: 'Passport', category: 'passport', expiryDate: '2027-03-04' }]);

    wrap(<TimelineScreen />, db);
    const list = await screen.findByTestId('timeline-list');

    expect(list.props.getItem).toBeDefined();
    expect(list.props.getItemCount).toBeDefined();
  });

  it('keeps the page chrome scrolling with the feed', async () => {
    await seed([{ title: 'Passport', category: 'passport', expiryDate: '2027-03-04' }]);

    wrap(<TimelineScreen />, db);

    await screen.findByTestId('timeline-month-2027-03');

    // Header content and rows share one scroller, as they did before.
    expect(screen.getByText('Expiry Timeline')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^timeline-item-/)).toHaveLength(1);
  });
});
