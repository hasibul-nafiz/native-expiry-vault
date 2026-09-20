import { Link } from 'expo-router';

import { Screen, Text } from '@/components';

export default function HomeScreen() {
  return (
    <Screen>
      <Text variant="headlineMd">ExpiryVault</Text>
      {__DEV__ ? (
        <Link accessibilityRole="link" href="/dev-gallery">
          <Text color="primary" variant="labelLg">
            UI kit gallery
          </Text>
        </Link>
      ) : null}
    </Screen>
  );
}
