import { Link } from 'expo-router';
import { View } from 'react-native';

import { Screen, Text } from '@/components';
import { useLockState } from '@/features/lock/useLockState';
import { useTheme } from '@/theme';

/**
 * Placeholder. F11 builds settings and i18n here.
 *
 * The app-lock row is real, not a placeholder: F9's enrolment flow is
 * unreachable without an entry point, and Settings is where it belongs. F11
 * restyles it along with everything else on this screen.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const { enrolled } = useLockState();

  return (
    <Screen>
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="headlineMd">Settings</Text>

        <View style={{ gap: theme.spacing.sm }}>
          <Text color="onSurfaceVariant" variant="labelSm">
            SECURITY
          </Text>
          <Link accessibilityRole="link" href="/set-pin">
            <Text color="primary" variant="labelLg">
              {enrolled ? 'App lock — on' : 'App lock — off'}
            </Text>
          </Link>
        </View>

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
