import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DatabaseProvider } from '@/db/DatabaseProvider';
import { ThemeProvider, useAppFonts } from '@/theme';

/**
 * The root layout hosts two sibling groups: `(auth)` for the lock gate and
 * `(app)` for everything behind it. Both manage their own headers, so this Stack
 * shows none of its own.
 */
export default function RootLayout() {
  const fontsLoaded = useAppFonts();

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DatabaseProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
        </DatabaseProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
