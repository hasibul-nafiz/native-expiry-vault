import type { ErrorBoundaryProps } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from '@/theme';

import { Button } from './Button';
import { Icon } from './Icon';
import { Screen } from './Screen';
import { Text } from './Text';

/**
 * The last line of defence: a render-phase throw anywhere below a layout.
 *
 * Every asynchronous failure in the app is already modelled as state — the
 * database refuses to open, a query rejects, a backup is corrupt — and each of
 * those has its own retryable screen. What none of them cover is an exception
 * raised *while rendering*, which React answers by unmounting the whole tree.
 * In development that shows the red box; in a release build it is a white
 * screen with no way out but force-quitting.
 *
 * Two things this deliberately does not do. It does not report the error
 * anywhere: there is no network in v1, and an error message can contain a
 * document title. And it does not print the message to the user, because the
 * same reasoning applies to anyone reading the screen over their shoulder.
 *
 * It provides its own providers. When expo-router catches a throw it renders
 * this *instead of* the layout that exports it, so at the root there is no
 * ThemeProvider above it any more — `useTheme` would throw inside the error
 * screen itself. Nesting a second provider lower down is harmless; the
 * preference resolves to the same scheme either way. i18next needs no provider
 * at all: the root module initialises it before the first render.
 */
export function AppErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorScreen retry={retry} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ErrorScreen({ retry }: { retry: () => Promise<void> }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Screen testID="app-error-boundary">
      <View style={[styles.centre, { gap: theme.spacing.md }]}>
        <Icon name="expired" size={40} tone={theme.colors.error} />

        <Text accessibilityRole="header" style={styles.centred} variant="headlineMd">
          {t('errors.genericTitle')}
        </Text>

        <Text color="onSurfaceVariant" style={styles.centred} variant="bodyMd">
          {t('errors.genericBody')}
        </Text>

        <Button
          label={t('errors.boundaryAction')}
          onPress={() => {
            void retry();
          }}
          testID="app-error-retry"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  centred: { textAlign: 'center' },
});
