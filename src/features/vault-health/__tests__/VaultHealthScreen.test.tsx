import { fireEvent, render, screen, within } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { itemsRepository, reminderRulesRepository, travelStaysRepository } from '@/db';
import { DatabaseProvider } from '@/db/DatabaseProvider';
import { createMigratedTestDatabase } from '@/db/testing/betterSqlite3';
import type { Database } from '@/db/types';
import { addDays, todayLocal } from '@/features/expiry';
import type { NotificationPort, PermissionState } from '@/services/notifications';
import { ThemeProvider } from '@/theme';

import { VaultHealthScreen } from '../VaultHealthScreen';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: () => undefined,
}));

/**
 * The screen resolves its own port through `useVaultHealth`'s default, so the
 * permission call is mocked at the service boundary — the same containment the
 * rest of the app relies on to stay testable with no native module.
 */
let mockPermission: PermissionState = 'granted';

jest.mock('@/services/notifications', () => ({
  ...jest.requireActual('@/services/notifications'),
  notificationPort: {
    getPermission: () => Promise.resolve(mockPermission),
  } as Partial<NotificationPort>,
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

beforeEach(async () => {
  mockPush.mockClear();
  mockPermission = 'granted';
  db = await createMigratedTestDatabase();
});

describe('the score', () => {
  it('shows no score for an empty vault rather than a perfect one', async () => {
    wrap(<VaultHealthScreen />, db);

    expect(await screen.findByText('No score yet')).toBeTruthy();
    expect(screen.queryByTestId('vault-health-score')).toBeNull();
  });

  it('scores a clean vault at 100', async () => {
    const item = await itemsRepository.createItem(db, {
      title: 'Passport',
      category: 'passport',
      expiryDate: at(900),
    });
    await reminderRulesRepository.createReminderRule(db, item.id, item.expiryDate, 30);

    wrap(<VaultHealthScreen />, db);

    expect(await screen.findByTestId('vault-health-score')).toHaveTextContent('100');
    expect(screen.getByText('Good state')).toBeTruthy();
  });

  it('applies the formula to a vault that needs attention', async () => {
    // One expired (-12) and one with no reminder (-6) = 82. The expired item
    // has no reminder either, so it counts under both.
    const expired = await itemsRepository.createItem(db, {
      title: 'Lapsed',
      category: 'other',
      expiryDate: at(-5),
    });
    await reminderRulesRepository.createReminderRule(db, expired.id, expired.expiryDate, 30);
    await itemsRepository.createItem(db, {
      title: 'Uncovered',
      category: 'other',
      expiryDate: at(900),
    });

    wrap(<VaultHealthScreen />, db);

    expect(await screen.findByTestId('vault-health-score')).toHaveTextContent('82');
    expect(screen.getByText('Needs attention')).toBeTruthy();
  });

  it('charges the flat penalty when notifications are denied', async () => {
    mockPermission = 'denied';
    const item = await itemsRepository.createItem(db, {
      title: 'Passport',
      category: 'passport',
      expiryDate: at(900),
    });
    await reminderRulesRepository.createReminderRule(db, item.id, item.expiryDate, 30);

    wrap(<VaultHealthScreen />, db);

    expect(await screen.findByTestId('vault-health-score')).toHaveTextContent('85');
    expect(screen.getByTestId('deduction-notificationsDenied')).toBeTruthy();
  });
});

describe('the breakdown', () => {
  it('names and prices every deduction so the score can be checked', async () => {
    await itemsRepository.createItem(db, {
      title: 'Lapsed',
      category: 'other',
      expiryDate: at(-5),
    });

    wrap(<VaultHealthScreen />, db);

    expect(await screen.findByTestId('deduction-expired')).toBeTruthy();
    expect(screen.getByText('1 document expired')).toBeTruthy();
    expect(screen.getByText('-12')).toBeTruthy();
  });

  it('says so when nothing needs attention', async () => {
    const item = await itemsRepository.createItem(db, {
      title: 'Passport',
      category: 'passport',
      expiryDate: at(900),
    });
    await reminderRulesRepository.createReminderRule(db, item.id, item.expiryDate, 30);

    wrap(<VaultHealthScreen />, db);

    expect(await screen.findByText('Nothing needs attention right now.')).toBeTruthy();
  });

  it('marks a deduction that has hit its cap', async () => {
    for (let index = 0; index < 6; index += 1) {
      await itemsRepository.createItem(db, {
        title: `Lapsed ${index}`,
        category: 'other',
        expiryDate: at(-5),
      });
    }

    wrap(<VaultHealthScreen />, db);

    const row = within(await screen.findByTestId('deduction-expired'));

    expect(row.getByText('capped')).toBeTruthy();
    // Six expired items would be -72 uncapped; the cap holds it at -48.
    expect(row.getByText('-48')).toBeTruthy();
  });
});

describe('the Schengen card', () => {
  it('stays hidden when no travel has been recorded', async () => {
    await itemsRepository.createItem(db, {
      title: 'Passport',
      category: 'passport',
      expiryDate: at(900),
    });

    wrap(<VaultHealthScreen />, db);

    await screen.findByTestId('vault-health-card');
    expect(screen.queryByTestId('schengen-card')).toBeNull();
  });

  it('appears once a stay exists', async () => {
    await travelStaysRepository.createTravelStay(db, {
      area: 'schengen',
      entryDate: at(-10),
      exitDate: at(-4),
    });

    wrap(<VaultHealthScreen />, db);

    expect(await screen.findByTestId('schengen-card')).toBeTruthy();
    // Seven days of presence, entry and exit days both counted.
    expect(screen.getByText('7 of 90 days used · 83 days left')).toBeTruthy();
  });
});

describe('navigation', () => {
  it('opens the app-lock flow from the security row', async () => {
    wrap(<VaultHealthScreen />, db);

    fireEvent.press(await screen.findByTestId('vault-health-security-row'));

    expect(mockPush).toHaveBeenCalledWith('/set-pin');
  });
});

describe('failure states', () => {
  it('offers a retry when the read fails', async () => {
    const failing = {
      ...db,
      getFirstAsync: jest.fn().mockRejectedValue(new Error('disk I/O error')),
    } as unknown as Database;

    wrap(<VaultHealthScreen />, failing);

    expect(await screen.findByTestId('vault-health-error')).toBeTruthy();
  });
});
