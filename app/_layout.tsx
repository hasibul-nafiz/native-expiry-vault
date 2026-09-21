import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PrivacyShield } from '@/components/PrivacyShield';
import { DatabaseProvider } from '@/db/DatabaseProvider';
import { useAutoLock } from '@/features/lock/useAutoLock';
import { initialiseLock, useLockState } from '@/features/lock/useLockState';
import { ThemeProvider, useAppFonts } from '@/theme';

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
 */
export default function RootLayout() {
  const fontsLoaded = useAppFonts();
  const { isResolving } = useLockState();

  useEffect(() => {
    void initialiseLock();
  }, []);

  useAutoLock();

  if (!fontsLoaded || isResolving) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DatabaseProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
          {/* Last child, so it covers everything when the app leaves the foreground. */}
          <PrivacyShield />
        </DatabaseProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
