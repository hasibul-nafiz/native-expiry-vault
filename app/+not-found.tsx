import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen, Text } from '@/components';

/** Catches unmatched deep links so a bad URL lands somewhere instead of throwing. */
export default function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('notFound.header') }} />
      <Screen>
        <Text variant="headlineMd">{t('notFound.title')}</Text>
        <Link accessibilityRole="link" href="/">
          <Text color="primary" variant="labelLg">
            {t('notFound.action')}
          </Text>
        </Link>
      </Screen>
    </>
  );
}
