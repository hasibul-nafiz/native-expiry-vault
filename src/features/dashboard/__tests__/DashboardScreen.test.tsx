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

import { DashboardScreen } from '../DashboardScreen';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  // The real hook needs a navigation container; the dashboard only uses it to
  // refetch on focus, which the initial mount already does.
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
  it('invites the user to add their first document', async () => {
    wrap(<DashboardScreen />, db);

    expect(await screen.findByTestId('dashboard-empty')).toBeOnTheScreen();
    expect(screen.getByText('No documents yet')).toBeOnTheScreen();
  });

  it('hides the search, tiles and chips when there is nothing to filter', async () => {
    wrap(<DashboardScreen />, db);

    await screen.findByTestId('dashboard-empty');

    expect(screen.queryByTestId('dashboard-search')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('status-tile-safe')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('category-chip-all')).not.toBeOnTheScreen();
  });

  it('routes the empty-state call to action to the add screen', async () => {
    wrap(<DashboardScreen />, db);

    fireEvent.press(await screen.findByTestId('empty-add-button'));

    expect(mockPush).toHaveBeenCalledWith('/add');
  });
});

describe('the loading state', () => {
  it('shows a skeleton while the database is still opening', () => {
    // No `database` prop: the provider reports `opening`, so the hook never
    // resolves and the screen stays in its loading state.
    wrap(<DashboardScreen />);

    expect(screen.getByTestId('dashboard-loading')).toBeOnTheScreen();
  });
});

describe('the error state', () => {
  it('offers a retry when the query fails', async () => {
    await db.closeAsync();

    wrap(<DashboardScreen />, db);

    expect(await screen.findByTestId('dashboard-error')).toBeOnTheScreen();
    expect(screen.getByText('Could not open your vault')).toBeOnTheScreen();
    expect(screen.getByTestId('dashboard-retry')).toBeOnTheScreen();

    db = await createMigratedTestDatabase();
  });

  it('never shows the raw error, which can carry SQL', async () => {
    await db.closeAsync();

    wrap(<DashboardScreen />, db);
    await screen.findByTestId('dashboard-error');

    expect(screen.queryByText(/SELECT/i)).not.toBeOnTheScreen();

    db = await createMigratedTestDatabase();
  });
});

describe('a populated dashboard', () => {
  beforeEach(async () => {
    await seed([
      { title: 'US Passport', category: 'passport', expiryDate: at(1200) },
      { title: 'Residence Permit', category: 'visa', expiryDate: at(18) },
      { title: 'Driving Permit', category: 'license', expiryDate: at(-25) },
    ]);
  });

  it('renders the counters, the records and the hero total', async () => {
    wrap(<DashboardScreen />, db);

    await screen.findByTestId('vault-hero');

    expect(screen.getByTestId('vault-hero-total')).toHaveTextContent('3');
    expect(screen.getByText('US Passport')).toBeOnTheScreen();
    // Appears in both the urgent scroller and the records list.
    expect(screen.getAllByText('Residence Permit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Driving Permit').length).toBeGreaterThan(0);
  });

  it('names the soonest unexpired item as the next renewal', async () => {
    wrap(<DashboardScreen />, db);

    expect(await screen.findByText('Residence Permit (18 days)')).toBeOnTheScreen();
  });

  it('shows the expired and soon items in the urgent scroller', async () => {
    wrap(<DashboardScreen />, db);

    await screen.findByTestId('vault-hero');

    const urgent = await screen.findAllByTestId(/^urgent-card-/);
    expect(urgent).toHaveLength(2);
    expect(screen.getAllByText('Expired 25d ago').length).toBeGreaterThan(0);
    expect(screen.getAllByText('18d left').length).toBeGreaterThan(0);
  });

  it('opens an item when its row is tapped', async () => {
    wrap(<DashboardScreen />, db);

    const rows = await screen.findAllByTestId(/^record-row-/);
    fireEvent.press(rows[0]);

    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/item\//));
  });

  it('opens the add screen from the floating action button', async () => {
    wrap(<DashboardScreen />, db);

    fireEvent.press(await screen.findByTestId('add-fab'));

    expect(mockPush).toHaveBeenCalledWith('/add');
  });

  it('filters the records when a category chip is tapped', async () => {
    wrap(<DashboardScreen />, db);

    fireEvent.press(await screen.findByTestId('category-chip-visa'));

    await waitFor(() => {
      expect(screen.queryByText('US Passport')).not.toBeOnTheScreen();
    });
    expect(screen.getAllByText('Residence Permit').length).toBeGreaterThan(0);
  });

  it('leaves the counters alone when a category filter is applied', async () => {
    wrap(<DashboardScreen />, db);

    fireEvent.press(await screen.findByTestId('category-chip-visa'));

    await waitFor(() => {
      expect(screen.queryByText('US Passport')).not.toBeOnTheScreen();
    });
    // The hero still reports the whole vault.
    expect(screen.getByTestId('vault-hero-total')).toHaveTextContent('3');
  });

  it('filters by status when a counter tile is tapped', async () => {
    wrap(<DashboardScreen />, db);

    fireEvent.press(await screen.findByTestId('status-tile-expired'));

    await waitFor(() => {
      expect(screen.queryByText('US Passport')).not.toBeOnTheScreen();
    });
    expect(screen.getAllByTestId(/^record-row-/)).toHaveLength(1);
    expect(screen.getAllByText('Driving Permit').length).toBeGreaterThan(0);
  });

  it('distinguishes no-matches from an empty vault, and can clear back', async () => {
    wrap(<DashboardScreen />, db);

    fireEvent.changeText(await screen.findByTestId('dashboard-search'), 'nothing matches this');

    expect(await screen.findByTestId('dashboard-no-matches')).toBeOnTheScreen();
    // Crucially not the empty-vault state.
    expect(screen.queryByTestId('dashboard-empty')).not.toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('clear-filters-button'));

    expect(await screen.findByText('US Passport')).toBeOnTheScreen();
  });

  it('opens the reminders sheet from the bell', async () => {
    wrap(<DashboardScreen />, db);

    // Wait for the loaded render so the assertion is not made against the
    // header of a tree that is about to be replaced.
    await screen.findByTestId('vault-hero');

    expect(screen.queryByTestId('reminders-sheet')).not.toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('notifications-button'));

    expect(await screen.findByTestId('reminders-sheet')).toBeOnTheScreen();
  });
});

/**
 * F13 moved the vault records off a `ScrollView` full of `.map()` and onto a
 * virtualized list. These pin the behaviour that swap could have broken: the
 * page chrome still scrolls with the rows, and the filtered and empty paths
 * still render what they did before.
 */
describe('the records list', () => {
  it('renders the page chrome and the rows in one scroller', async () => {
    await seed([
      { title: 'Passport', category: 'passport', expiryDate: at(400) },
      { title: 'Visa', category: 'visa', expiryDate: at(20) },
    ]);

    wrap(<DashboardScreen />, db);

    const list = await screen.findByTestId('dashboard-scroll');

    expect(list).toBeOnTheScreen();
    // Header content, which now rides along as the list header.
    expect(screen.getByTestId('vault-hero')).toBeOnTheScreen();
    expect(screen.getByTestId('dashboard-search')).toBeOnTheScreen();
    // And the rows themselves. Matched by testID, since an item near its
    // expiry also appears by name in the urgent scroller above.
    expect(screen.getAllByTestId(/^record-row-/)).toHaveLength(2);
  });

  it('virtualizes rather than mounting every row', async () => {
    await seed([{ title: 'Passport', category: 'passport', expiryDate: at(400) }]);

    wrap(<DashboardScreen />, db);
    const list = await screen.findByTestId('dashboard-scroll');

    // A FlatList exposes the windowing props a plain ScrollView does not.
    expect(list.props.getItem).toBeDefined();
    expect(list.props.getItemCount).toBeDefined();
  });

  it('keeps the no-matches state when a filter excludes everything', async () => {
    await seed([{ title: 'Passport', category: 'passport', expiryDate: at(400) }]);

    wrap(<DashboardScreen />, db);

    fireEvent.changeText(await screen.findByTestId('dashboard-search'), 'no such document');

    await waitFor(() => {
      expect(screen.queryAllByTestId(/^record-row-/)).toHaveLength(0);
    });

    expect(screen.getByText('No matches')).toBeOnTheScreen();
  });
});
