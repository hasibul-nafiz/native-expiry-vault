import { StyleSheet, View } from 'react-native';

import { useTranslation } from 'react-i18next';

import { Card, Icon, Text, type IconName } from '@/components';
import { useTheme } from '@/theme';

import type { Deduction, DeductionReason } from '../healthScore';
import { deductionLabel, pointsLabel } from '../labels';

/**
 * Why the score is what it is.
 *
 * This is the point of a deduction-based formula: every penalty is named,
 * counted and priced, so the number above can be checked rather than trusted.
 * Nothing like it exists in the export, which shows a bare "92%".
 */

const reasonIcons: Record<DeductionReason, IconName> = {
  expired: 'expired',
  soon: 'soon',
  missingReminders: 'bell',
  notificationsDenied: 'alertActive',
};

export interface HealthBreakdownProps {
  deductions: readonly Deduction[];
}

export function HealthBreakdown({ deductions }: HealthBreakdownProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Card testID="health-breakdown">
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="titleMd">{t('vaultHealth.breakdownTitle')}</Text>

        {deductions.length === 0 ? (
          <View style={[styles.row, { gap: theme.spacing.sm }]}>
            <Icon name="safe" size={20} tone={theme.status.safe.foreground} />
            <Text color="onSurfaceVariant" style={styles.grow} variant="bodyMd">
              {t('vaultHealth.perfect')}
            </Text>
          </View>
        ) : (
          deductions.map((deduction) => {
            const label = deductionLabel(deduction.reason, deduction.count, t);
            const points = pointsLabel(deduction.pointsLost, t);

            return (
              <View
                accessibilityLabel={t('vaultHealth.deductionAccessibility', {
                  label,
                  points,
                })}
                accessibilityRole="text"
                key={deduction.reason}
                style={[styles.row, { gap: theme.spacing.sm }]}
                testID={`deduction-${deduction.reason}`}
              >
                <Icon
                  name={reasonIcons[deduction.reason]}
                  size={20}
                  tone={theme.status.expired.foreground}
                />
                <Text style={styles.grow} variant="bodyMd">
                  {label}
                </Text>
                {deduction.capped ? (
                  <Text color="onSurfaceVariant" variant="labelSm">
                    {t('vaultHealth.capped')}
                  </Text>
                ) : null}
                <Text style={{ color: theme.status.expired.foreground }} variant="labelLg">
                  {points}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row' },
  grow: { flex: 1 },
});
