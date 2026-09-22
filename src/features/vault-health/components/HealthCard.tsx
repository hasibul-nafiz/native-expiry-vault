import { StyleSheet, View } from 'react-native';

import { useTranslation } from 'react-i18next';

import { Icon, Text } from '@/components';
import { useTheme, type Theme } from '@/theme';

import { MAX_SCORE, type HealthBand } from '../healthScore';
import { healthBandKeys } from '../labels';

/**
 * The hero card: the score, its band, and the three counts beneath it.
 *
 * Rendered as a plain number rather than the export's "92%" — it is a points
 * total, not a proportion of anything, and writing it as a percentage invites
 * the question "percent of what?" with no answer.
 *
 * Solid `primary` fill, not the export's gradient: F1 deferred
 * `expo-linear-gradient` and that decision is not reversed inside a feature.
 */

export interface HealthCardProps {
  score: number | null;
  band: HealthBand | null;
  totalItems: number;
  soonCount: number;
  missingAlerts: number;
}

function Shell({
  children,
  theme,
  label,
}: {
  children: React.ReactNode;
  theme: Theme;
  label: string;
}) {
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="summary"
      style={{
        backgroundColor: theme.colors.primary,
        borderRadius: theme.radius.xl,
        gap: theme.spacing.md,
        padding: theme.spacing.margin,
      }}
      testID="vault-health-card"
    >
      {children}
    </View>
  );
}

export function HealthCard({ score, band, totalItems, soonCount, missingAlerts }: HealthCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const heading = (
    <Text style={{ color: theme.colors.onPrimary }} uppercase variant="labelSm">
      {t('vaultHealth.healthTitle')}
    </Text>
  );

  if (score === null || band === null) {
    return (
      <Shell label={t('vaultHealth.noScore')} theme={theme}>
        <View style={[styles.header, { gap: theme.spacing.sm }]}>
          <View style={styles.headerText}>
            {heading}
            <Text style={{ color: theme.colors.onPrimary }} variant="titleLg">
              {t('vaultHealth.noScore')}
            </Text>
          </View>
          <Icon name="vault" size={28} tone={theme.colors.onPrimary} />
        </View>
        <Text style={{ color: theme.colors.onPrimary }} variant="bodyMd">
          {t('vaultHealth.noScoreBody')}
        </Text>
      </Shell>
    );
  }

  const stat = (value: number, label: string, testID: string) => (
    <View style={styles.stat} testID={testID}>
      <Text maxFontSizeMultiplier={1.6} style={{ color: theme.colors.onPrimary }} variant="titleLg">
        {value}
      </Text>
      <Text maxFontSizeMultiplier={1.6} style={{ color: theme.colors.onPrimary }} variant="labelSm">
        {label}
      </Text>
    </View>
  );

  return (
    <Shell
      label={t('vaultHealth.scoreAccessibility', { score, max: MAX_SCORE, band: t(healthBandKeys[band]) })}
      theme={theme}
    >
      <View style={[styles.header, { gap: theme.spacing.sm }]}>
        <View style={styles.headerText}>
          {heading}
          <View style={[styles.scoreRow, { gap: theme.spacing.sm }]}>
            <Text
              maxFontSizeMultiplier={1.4}
              style={{ color: theme.colors.onPrimary }}
              testID="vault-health-score"
              variant="displayLg"
            >
              {score}
            </Text>
            <View
              style={{
                backgroundColor: theme.colors.primaryContainer,
                borderRadius: theme.radius.full,
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: theme.spacing.xs,
              }}
            >
              <Text
                maxFontSizeMultiplier={1.4}
                style={{ color: theme.colors.onPrimary }}
                variant="labelSm"
              >
                {t(healthBandKeys[band])}
              </Text>
            </View>
          </View>
        </View>
        <Icon name="vault" size={28} tone={theme.colors.onPrimary} />
      </View>

      <View style={styles.stats}>
        {stat(totalItems, t('vaultHealth.activeDocs'), 'stat-active')}
        {stat(soonCount, t('vaultHealth.expiringSoon'), 'stat-soon')}
        {stat(missingAlerts, t('vaultHealth.missingAlerts'), 'stat-missing')}
      </View>
    </Shell>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-start', flexDirection: 'row' },
  headerText: { flex: 1 },
  scoreRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap' },
  stats: { flexDirection: 'row' },
  stat: { flex: 1 },
});
