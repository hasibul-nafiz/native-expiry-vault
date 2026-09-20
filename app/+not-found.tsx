import { Link, Stack } from 'expo-router';

import { Screen, Text } from '@/components';

/** Catches unmatched deep links so a bad URL lands somewhere instead of throwing. */
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Not found' }} />
      <Screen>
        <Text variant="headlineMd">This screen does not exist</Text>
        <Link accessibilityRole="link" href="/">
          <Text color="primary" variant="labelLg">
            Go to the vault
          </Text>
        </Link>
      </Screen>
    </>
  );
}
