import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { Button, Icon, Screen, Text } from '@/components';
import { useTheme } from '@/theme';
import { useTranslation } from 'react-i18next';

/**
 * A launcher, not the scanner.
 *
 * The export draws the scanner full-bleed with no tab bar, yet puts a Scan tab
 * in every tab bar it draws — a contradiction F1 logged and left to F8. Both
 * survive this way: the tab is where you look for scanning, and the camera
 * gets the whole screen. It also means the camera is only mounted while it is
 * being used, rather than held open behind a tab.
 */
export default function ScanTabScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const open = useCallback(() => {
    router.push('/scan');
  }, [router]);

  return (
    <Screen>
      <View style={{ gap: theme.spacing.md }}>
        <Icon color="primary" name="search" size={32} />
        <Text accessibilityRole="header" variant="headlineMd">
          {t('scanTab.title')}
        </Text>
        <Text color="onSurfaceVariant" variant="bodyMd">
          {t('scanTab.body')}
        </Text>
        <Text color="onSurfaceVariant" variant="bodySm">
          {t('scanTab.note')}
        </Text>
        <Button label={t('scanTab.open')} onPress={open} testID="scan-launch" />
      </View>
    </Screen>
  );
}
