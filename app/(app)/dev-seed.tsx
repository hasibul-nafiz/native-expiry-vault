import { useState } from 'react';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/components';
import { useDatabaseState } from '@/db/DatabaseProvider';
import { clearAllData, seedSampleData } from '@/db/testing/seed';
import { useTheme } from '@/theme';

/**
 * Development-only sample data, so a populated dashboard can be seen on a
 * device before F5 exists to add real items.
 *
 * expo-router registers every file under `app/`, so this route exists in
 * production builds too — it renders nothing there, and nothing in the app
 * links to it outside __DEV__.
 */
export default function DevSeedRoute() {
  const theme = useTheme();
  const databaseState = useDatabaseState();
  const [message, setMessage] = useState('');

  if (!__DEV__) {
    return null;
  }

  if (databaseState.status !== 'ready') {
    return (
      <Screen>
        <Text variant="headlineMd">Sample data</Text>
        <Text color="onSurfaceVariant">The database is not open.</Text>
      </Screen>
    );
  }

  const { db } = databaseState;

  return (
    <Screen>
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="headlineMd">Sample data</Text>
        <Text color="onSurfaceVariant" variant="bodyMd">
          Development only. Adds six documents spanning every status band, each with the default
          reminder set.
        </Text>

        <Button
          label="Seed sample data"
          onPress={() => {
            seedSampleData(db)
              .then((count) => {
                setMessage(`Added ${count} documents.`);
              })
              .catch((error: unknown) => {
                setMessage(error instanceof Error ? error.message : String(error));
              });
          }}
          testID="seed-button"
        />

        <Button
          label="Delete all documents"
          onPress={() => {
            clearAllData(db)
              .then(() => {
                setMessage('All documents removed.');
              })
              .catch((error: unknown) => {
                setMessage(error instanceof Error ? error.message : String(error));
              });
          }}
          testID="clear-button"
          variant="secondary"
        />

        {message === '' ? null : <Text color="onSurfaceVariant">{message}</Text>}
      </View>
    </Screen>
  );
}
