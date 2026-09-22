import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { IconButton, Screen, Text } from '@/components';
import { useTheme } from '@/theme';

/**
 * The privacy policy, bundled and translated.
 *
 * A local screen rather than a link to a hosted page: the app makes no network
 * requests at all, so a policy the user can only read online would be the one
 * thing in a privacy-first app that needs the internet. F14 still needs a
 * hosted copy for the store listings; this is the source of truth for it.
 */
export function PrivacyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const section = (titleKey: string, bodyKey: string) => (
    <View key={titleKey} style={{ gap: theme.spacing.xs }}>
      <Text accessibilityRole="header" variant="titleMd">
        {t(titleKey)}
      </Text>
      <Text color="onSurfaceVariant" variant="bodyMd">
        {t(bodyKey)}
      </Text>
    </View>
  );

  return (
    <Screen scroll testID="privacy-screen">
      <View style={{ gap: theme.spacing.md }}>
        <View style={[{ gap: theme.spacing.sm }]}>
          <IconButton
            accessibilityLabel={t('common.back')}
            icon="chevronRight"
            onPress={() => router.back()}
            testID="privacy-back"
          />
          <Text variant="headlineMd">{t('privacy.title')}</Text>
        </View>

        <Text variant="bodyLg">{t('privacy.intro')}</Text>

        {section('privacy.dataTitle', 'privacy.dataBody')}
        {section('privacy.encryptionTitle', 'privacy.encryptionBody')}
        {section('privacy.networkTitle', 'privacy.networkBody')}
        {section('privacy.notificationsTitle', 'privacy.notificationsBody')}
        {section('privacy.deletionTitle', 'privacy.deletionBody')}
      </View>
    </Screen>
  );
}
