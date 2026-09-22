import { StyleSheet, View } from 'react-native';

import { useTranslation } from 'react-i18next';

import { Button, Icon, Text } from '@/components';
import { useTheme } from '@/theme';

/** Loading and error. The export defines neither; both are designed here. */

export function VaultHealthLoading() {
  const theme = useTheme();
  const { t } = useTranslation();

  const block = (height: number, width: string | number = '100%') => (
    <View
      style={{
        backgroundColor: theme.colors.surfaceContainerHigh,
        borderRadius: theme.radius.md,
        height,
        width: width as number,
      }}
    />
  );

  return (
    <View
      accessibilityLabel={t('vaultHealth.loading')}
      accessibilityRole="progressbar"
      style={{ gap: theme.spacing.md }}
      testID="vault-health-loading"
    >
      {block(160)}
      {block(96)}
      {block(140)}
    </View>
  );
}

export interface VaultHealthErrorProps {
  onRetry: () => void;
}

export function VaultHealthError({ onRetry }: VaultHealthErrorProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={[styles.centred, { gap: theme.spacing.md, paddingVertical: theme.spacing.xl }]}
      testID="vault-health-error"
    >
      <Icon color="error" name="error" size={40} />
      <Text variant="titleLg">{t('vaultHealth.errorTitle')}</Text>
      <Text color="onSurfaceVariant" style={styles.centredText} variant="bodyMd">
        {t('vaultHealth.errorBody')}
      </Text>
      <Button label={t('common.tryAgain')} onPress={onRetry} testID="vault-health-retry" />
    </View>
  );
}

const styles = StyleSheet.create({
  centred: { alignItems: 'center' },
  centredText: { textAlign: 'center' },
});
