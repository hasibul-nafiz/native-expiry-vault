import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DatabaseProvider } from '@/db/DatabaseProvider';
import { createMigratedTestDatabase } from '@/db/testing/betterSqlite3';
import type { Database } from '@/db/types';
import { ThemeProvider } from '@/theme';

import VaultRoute from '../app/(app)/(tabs)/index';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: () => undefined,
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let db: Database;

beforeEach(async () => {
  db = await createMigratedTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

test('the vault route renders the dashboard', async () => {
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <DatabaseProvider database={db}>
          <VaultRoute />
        </DatabaseProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );

  expect(await screen.findByTestId('vault-hero')).toBeOnTheScreen();
});
