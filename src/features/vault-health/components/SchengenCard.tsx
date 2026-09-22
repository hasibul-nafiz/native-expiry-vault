import { StyleSheet, View } from 'react-native';

import { useTranslation } from 'react-i18next';

import { Card, Icon, Text } from '@/components';
import { useTheme } from '@/theme';

import type { WindowUsage } from '../../expiry/travel';
import { schengenSummary } from '../labels';

/**
 * The 90/180 allowance meter.
 *
 * Only rendered when travel has actually been recorded — nothing writes
 * `travel_stays` yet, and a card permanently reading "0 of 90 days used" would
 * be worse than no card. The arithmetic behind it is `schengenUsage`, which has
 * been tested since F2.
 */

export interface SchengenCardProps {
  usage: WindowUsage;
}

export function SchengenCard({ usage }: SchengenCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const fraction = Math.min(1, usage.used / usage.allowance);
  const percent = Math.round(fraction * 100);

  return (
    <Card testID="schengen-card">
      <View style={{ gap: theme.spacing.sm }}>
        <View style={[styles.row, { gap: theme.spacing.sm }]}>
          <Icon color="primary" name="visa" size={22} />
          <View style={styles.grow}>
            <Text variant="titleMd">{t('vaultHealth.schengenTitle')}</Text>
            <Text color="onSurfaceVariant" variant="bodySm">
              {schengenSummary(usage.used, usage.allowance, usage.remaining, t)}
            </Text>
          </View>
          <Text color="primary" variant="labelLg">
            {percent}%
          </Text>
        </View>
        <View
          accessibilityLabel={schengenSummary(usage.used, usage.allowance, usage.remaining, t)}
          accessibilityRole="progressbar"
          accessibilityValue={{ max: usage.allowance, min: 0, now: usage.used }}
          style={{
            backgroundColor: theme.colors.surfaceContainerHighest,
            borderRadius: theme.radius.full,
            height: 8,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.primary,
              borderRadius: theme.radius.full,
              height: 8,
              width: `${percent}%`,
            }}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row' },
  grow: { flex: 1 },
});
