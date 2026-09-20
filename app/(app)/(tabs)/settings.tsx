import { Link } from 'expo-router';
import { View } from 'react-native';

import { Screen, Text } from '@/components';
import { useTheme } from '@/theme';

/** Placeholder. F11 builds settings and i18n here. */
export default function SettingsScreen() {
  const theme = useTheme();

  return (
    <Screen>
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="headlineMd">Settings</Text>

        {__DEV__ ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text color="onSurfaceVariant" variant="labelSm">
              DEVELOPER
            </Text>
            <Link accessibilityRole="link" href="/dev-gallery">
              <Text color="primary" variant="labelLg">
                UI kit gallery
              </Text>
            </Link>
            <Link accessibilityRole="link" href="/dev-seed">
              <Text color="primary" variant="labelLg">
                Sample data
              </Text>
            </Link>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
