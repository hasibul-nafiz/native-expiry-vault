import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SystemUI from 'expo-system-ui';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { PrivacyShield } from '@/components/PrivacyShield';
import { DatabaseProvider } from '@/db/DatabaseProvider';
import { useAutoLock } from '@/features/lock/useAutoLock';
import { initialiseLock, useLockState } from '@/features/lock/useLockState';
import { initialiseI18n } from '@/i18n';
import { useLocale } from '@/i18n/useLocale';
import { initialisePreferences, usePreferencesState } from '@/settings/store';
import { ThemeProvider, useAppFonts, useTheme } from '@/theme';

// i18next has to be initialised before the first component calls `t`, which is
// a module-level concern rather than an effect.
initialiseI18n();

/**
 * The root layout hosts two sibling groups: `(auth)` for the lock gate and
 * `(app)` for everything behind it. Both manage their own headers, so this Stack
 * shows none of its own.
 *
 * The lock is resolved here, above both groups, for two reasons. Reading the
 * PIN record out of the Keychain is asynchronous, so rendering either group
 * before it resolves would show the dashboard for a frame and then hide it. And
 * the auto-lock listener and the privacy shield have to keep working on both
 * sides of the gate, which only a common ancestor can guarantee.
 *
 * Preferences are read here for the same reason: theme and language apply to
 * the lock screen, which is above the database, so they cannot live inside it.
 */
/**
 * Catches a render-phase throw anywhere in the app. Re-exported rather than
 * defined here so the same screen serves both this layout and `(app)`, which
 * keeps its own boundary so a broken screen behind the lock does not tear down
 * the gate with it.
 */
export { AppErrorBoundary as ErrorBoundary };

export default function RootLayout() {
  const fontsLoaded = useAppFonts();
  const { isResolving } = useLockState();
  const { loaded: preferencesLoaded, preferences } = usePreferencesState();

  useEffect(() => {
    void initialiseLock();
    void initialisePreferences();
  }, []);

  useAutoLock({ graceMs: preferences.autoLockDelayMs });

  if (!fontsLoaded || isResolving || !preferencesLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LocalisedApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * Sits inside ThemeProvider so a language change re-renders the tree below it.
 * `useLocale` is what pushes the resolved locale into i18next.
 */
function LocalisedApp() {
  const theme = useTheme();

  useLocale();

  /**
   * Android is edge-to-edge unconditionally from SDK 54, so the window's own
   * background shows through behind the status and navigation bars and during
   * overscroll. Left at the platform default it is white, which flashes on
   * every launch in dark mode.
   */
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.surface);
  }, [theme.colors.surface]);

  return (
    <DatabaseProvider>
      {/*
        Driven by the resolved theme rather than `auto`. `auto` follows the
        *system* scheme, which is the wrong one whenever the user has picked
        Light or Dark in Settings against a system set the other way.
      */}
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
      {/* Last child, so it covers everything when the app leaves the foreground. */}
      <PrivacyShield />
    </DatabaseProvider>
  );
}
