import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { i18n } from '@/i18n';
import { defaultPreferences } from '@/settings/preferences';
import {
  getPreferencesState,
  initialisePreferences,
  resetPreferencesStore,
  updatePreferences,
} from '@/settings/store';
import { ThemeProvider } from '@/theme';

import { SettingsScreen } from '../SettingsScreen';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: () => undefined,
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

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

beforeEach(async () => {
  mockPush.mockClear();
  resetPreferencesStore();
  // The storage double persists between tests, exactly as the real file does,
  // so the defaults have to be written back rather than only cleared in memory.
  await updatePreferences({ ...defaultPreferences });
  resetPreferencesStore();
  await initialisePreferences();
  await i18n.changeLanguage('en');
});

describe('the screen', () => {
  it('shows the current preference on each row', async () => {
    wrap(<SettingsScreen />);

    expect(await screen.findByTestId('settings-screen')).toBeTruthy();
    expect(screen.getByText('System default')).toBeTruthy();
    expect(screen.getByText('System')).toBeTruthy();
  });

  it('reads the version from the app config rather than hardcoding it', async () => {
    wrap(<SettingsScreen />);

    expect(await screen.findByText('1.0.0')).toBeTruthy();
  });

  it('opens the privacy policy', async () => {
    wrap(<SettingsScreen />);

    fireEvent.press(await screen.findByTestId('settings-privacy'));

    expect(mockPush).toHaveBeenCalledWith('/privacy');
  });

  it('opens the app-lock flow', async () => {
    wrap(<SettingsScreen />);

    fireEvent.press(await screen.findByTestId('settings-app-lock'));

    expect(mockPush).toHaveBeenCalledWith('/set-pin');
  });
});

describe('changing the theme', () => {
  it('persists the choice', async () => {
    wrap(<SettingsScreen />);

    fireEvent.press(await screen.findByTestId('settings-theme'));
    fireEvent.press(await screen.findByTestId('theme-sheet-dark'));

    await waitFor(() => {
      expect(getPreferencesState().preferences.theme).toBe('dark');
    });
  });

  it('shows the new value on the row immediately', async () => {
    wrap(<SettingsScreen />);

    fireEvent.press(await screen.findByTestId('settings-theme'));
    fireEvent.press(await screen.findByTestId('theme-sheet-light'));

    expect(await screen.findByText('Light')).toBeTruthy();
  });
});

describe('changing the language', () => {
  it('persists the choice', async () => {
    wrap(<SettingsScreen />);

    fireEvent.press(await screen.findByTestId('settings-language'));
    fireEvent.press(await screen.findByTestId('language-sheet-bn'));

    await waitFor(() => {
      expect(getPreferencesState().preferences.language).toBe('bn');
    });
  });

  /**
   * The point of the whole feature: choosing Bengali must change what is on
   * screen, not just what is stored.
   */
  it('re-renders the screen in the chosen language', async () => {
    wrap(<SettingsScreen />);

    fireEvent.press(await screen.findByTestId('settings-language'));
    fireEvent.press(await screen.findByTestId('language-sheet-bn'));

    expect(await screen.findByText('সেটিংস')).toBeTruthy();
  });
});

describe('changing the reminder time', () => {
  it('persists the hour', async () => {
    wrap(<SettingsScreen />);

    fireEvent.press(await screen.findByTestId('settings-reminder-time'));
    fireEvent.press(await screen.findByTestId('reminder-hour-sheet-20'));

    await waitFor(() => {
      expect(getPreferencesState().preferences.reminderHour).toBe(20);
    });
  });

  it('starts at the documented default', () => {
    expect(defaultPreferences.reminderHour).toBe(9);
  });
});

describe('the auto-lock delay', () => {
  it('persists the choice', async () => {
    wrap(<SettingsScreen />);

    fireEvent.press(await screen.findByTestId('settings-auto-lock'));
    fireEvent.press(await screen.findByTestId('auto-lock-sheet-0'));

    await waitFor(() => {
      expect(getPreferencesState().preferences.autoLockDelayMs).toBe(0);
    });
  });
});

describe('biometric unlock', () => {
  /**
   * Closes F9's logged gap: biometrics could not previously be turned off
   * independently of the PIN.
   */
  it('is disabled on a device with no enrolled hardware', async () => {
    wrap(<SettingsScreen />);

    expect(
      await screen.findByText('No biometric hardware is enrolled on this device.'),
    ).toBeTruthy();
  });
});
