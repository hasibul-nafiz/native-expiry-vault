import { StyleSheet, View } from 'react-native';

import { Button, Icon, Text } from '@/components';
import type { IsoDate, Item } from '@/db/models';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';

import { nextRenewalLabel } from '../selectors';

/**
 * The "Personal Vault" hero.
 *
 * The export paints this with a three-stop gradient (#53389e -> #6941c6 ->
 * #7f56d9). F1 deferred gradients rather than add `expo-linear-gradient` before
 * seeing one on a device, and that stands: this uses the solid `primary` token,
 * which is also what keeps the contrast assertions in F1's test suite valid.
 */

export interface VaultHeroCardProps {
  total: number;
  nextRenewal: Item | null;
  today: IsoDate;
  onViewNext: (item: Item) => void;
}

export function VaultHeroCard({ total, nextRenewal, today, onViewNext }: VaultHeroCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.primary,
          borderRadius: theme.radius.xl,
          gap: theme.spacing.md,
          padding: theme.spacing.lg,
          ...theme.elevation.level2,
        },
      ]}
      testID="vault-hero"
    >
      <View style={styles.headerRow}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text color="onPrimary" variant="labelSm">
            {t('dashboard.heroEyebrow').toUpperCase()}
          </Text>
          <View style={[styles.countRow, { gap: theme.spacing.sm }]}>
            <Text color="onPrimary" testID="vault-hero-total" variant="displayLgMobile">
              {String(total)}
            </Text>
            <Text color="onPrimary" variant="bodyMd">
              {t('dashboard.documentsTracked', { count: total })}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.shield,
            {
              backgroundColor: theme.colors.primaryContainer,
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <Icon color="onPrimaryContainer" name="vault" size={22} />
        </View>
      </View>

      {nextRenewal === null ? null : (
        <View
          style={[
            styles.nextRow,
            {
              borderTopColor: theme.colors.primaryContainer,
              gap: theme.spacing.sm,
              paddingTop: theme.spacing.md,
            },
          ]}
        >
          <View style={[styles.nextText, { gap: theme.spacing.xs }]}>
            <Text color="onPrimary" variant="labelSm">
              {t('dashboard.nextRenewalLabel')}
            </Text>
            <Text color="onPrimary" numberOfLines={1} variant="labelMd">
              {nextRenewalLabel(nextRenewal, today, t)}
            </Text>
          </View>

          <Button
            accessibilityHint={t('dashboard.recordHint')}
            label={t('common.view')}
            onPress={() => {
              onViewNext(nextRenewal);
            }}
            size="sm"
            testID="hero-view-next"
            variant="secondary"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%' },
  countRow: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap' },
  headerRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  nextRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nextText: { flexShrink: 1 },
  shield: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
});
