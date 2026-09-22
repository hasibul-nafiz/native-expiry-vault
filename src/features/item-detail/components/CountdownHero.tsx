import { StyleSheet, View } from 'react-native';

import { CountdownRing, StatusBadge, Text } from '@/components';
import type { IsoDate, Item } from '@/db/models';
import { daysUntilExpiry, documentStatus, lifetimeElapsed } from '@/features/expiry';
import { useTranslation } from 'react-i18next';

import { MAX_LAYOUT_SCALE, useScaledSize, useTheme } from '@/theme';

import { daysLeftLabel } from '../../dashboard/selectors';

/**
 * The countdown ring and the lifetime bar.
 *
 * The export labels its bar "Lifetime Elapsed" but its width, and the ring's
 * arc, both match the fraction *remaining*. Rather than pick one and leave the
 * contradiction in place, both are rendered as remaining and labelled as such.
 *
 * Without an issue date there is no lifetime to measure, so the ring falls back
 * to the proportion of the final year remaining — a document with no start date
 * still needs a ring to draw.
 */

const FALLBACK_WINDOW_DAYS = 365;

/** The export draws the ring at 176. It scales with the text set inside it. */
const RING_SIZE = 176;

export interface CountdownHeroProps {
  item: Item;
  today: IsoDate;
}

const statusKeys = {
  safe: 'status.valid',
  soon: 'status.expiringSoon',
  expired: 'status.expired',
} as const;

export function CountdownHero({ item, today }: CountdownHeroProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const ringSize = useScaledSize(RING_SIZE);
  const status = documentStatus(item.expiryDate, today);
  const tone = theme.status[status];
  const remainingDays = daysUntilExpiry(item.expiryDate, today);

  const elapsed = lifetimeElapsed(item.issueDate, item.expiryDate, today);
  const remainingFraction =
    elapsed === null ? Math.min(1, Math.max(0, remainingDays / FALLBACK_WINDOW_DAYS)) : 1 - elapsed;

  const percentRemaining = Math.round(remainingFraction * 100);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surfaceContainerLowest,
          borderColor: theme.colors.outlineVariant,
          borderRadius: theme.radius.xl,
          borderWidth: StyleSheet.hairlineWidth,
          gap: theme.spacing.md,
          padding: theme.spacing.lg,
        },
      ]}
      testID="countdown-hero"
    >
      <StatusBadge label={t(statusKeys[status])} status={status} />

      <CountdownRing
        fraction={remainingFraction}
        size={ringSize}
        testID="countdown-ring"
        tone={tone.foreground}
      >
        {/*
          Capped at the same ceiling as the ring around it: past that the ring
          stops growing, so the number has to stop too or it overflows the arc.
        */}
        <Text
          maxFontSizeMultiplier={MAX_LAYOUT_SCALE}
          testID="countdown-days"
          variant="displayLgMobile"
        >
          {remainingDays < 0 ? String(Math.abs(remainingDays)) : String(remainingDays)}
        </Text>
        <Text style={{ color: tone.foreground }} uppercase variant="labelSm">
          {remainingDays < 0 ? t('countdown.daysAgoLabel') : t('countdown.daysLeftLabel')}
        </Text>
        <Text color="onSurfaceVariant" variant="bodySm">
          {daysLeftLabel(item.expiryDate, today, t)}
        </Text>
      </CountdownRing>

      <View style={[styles.bar, { gap: theme.spacing.xs }]}>
        <View
          style={[
            styles.track,
            {
              backgroundColor: theme.colors.surfaceContainerHighest,
              borderRadius: theme.radius.full,
            },
          ]}
        >
          <View
            style={[
              styles.fill,
              {
                backgroundColor: tone.foreground,
                borderRadius: theme.radius.full,
                width: `${percentRemaining}%`,
              },
            ]}
            testID="lifetime-bar-fill"
          />
        </View>
        <View style={styles.barLabels}>
          <Text color="onSurfaceVariant" variant="bodySm">
            {t('itemDetail.lifetimeRemaining')}
          </Text>
          <Text style={{ color: tone.foreground }} testID="percent-remaining" variant="labelSm">
            {t('itemDetail.percent', { percent: percentRemaining })}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: '100%' },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  card: { alignItems: 'center' },
  fill: { height: '100%' },
  track: { height: 8, overflow: 'hidden', width: '100%' },
});
