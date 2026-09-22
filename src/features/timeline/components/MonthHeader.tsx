import { StyleSheet, View } from 'react-native';

import { useTranslation } from 'react-i18next';

import { Icon, Text, type IconName } from '@/components';
import { useLocale } from '@/i18n/useLocale';
import { useTheme, type TimelineBand } from '@/theme';

import { bandKeys, monthHeading } from '../labels';

/**
 * A month node on the rail: a filled circle, the month, and its band pill.
 *
 * The band is never conveyed by colour alone — the pill always carries its
 * label and the icon differs per band, so the header is legible to a screen
 * reader and to anyone who cannot separate the five hues.
 */

const bandIcons: Record<TimelineBand, IconName> = {
  critical: 'expired',
  action: 'soon',
  review: 'reminder',
  safeWindow: 'safe',
  secure: 'vault',
};

export interface MonthHeaderProps {
  year: number;
  month: number;
  band: TimelineBand;
  testID?: string;
}

export function MonthHeader({ year, month, band, testID }: MonthHeaderProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useLocale();
  const tone = theme.bands[band];
  const heading = monthHeading(year, month, locale);
  const label = t(bandKeys[band]);

  return (
    <View
      accessibilityLabel={t('timeline.monthAccessibility', { month: heading, band: label })}
      accessibilityRole="header"
      style={[styles.row, { gap: theme.spacing.sm }]}
      testID={testID}
    >
      <View
        style={[styles.node, { backgroundColor: tone.container, borderColor: tone.foreground }]}
      >
        <Icon name={bandIcons[band]} size={18} tone={tone.foreground} />
      </View>
      <View style={[styles.labels, { gap: theme.spacing.xs }]}>
        <Text uppercase variant="titleLg">
          {heading}
        </Text>
        <View
          style={{
            backgroundColor: tone.container,
            borderRadius: theme.radius.full,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.xs,
          }}
        >
          <Text maxFontSizeMultiplier={1.4} style={{ color: tone.foreground }} variant="labelSm">
            {label}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row' },
  node: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  labels: { alignItems: 'flex-start', flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
});
