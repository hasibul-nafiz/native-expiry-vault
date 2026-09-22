import { StyleSheet, View } from 'react-native';

import { Card, Icon, StatusBadge, Text, iconForCategory } from '@/components';
import type { IsoDate, Item } from '@/db/models';
import { documentStatus } from '@/features/expiry';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';

import { daysLeftLabel, elapsedFraction, elapsedLabel } from '../selectors';
import { formatDate } from '@/i18n';
import { useLocale } from '@/i18n/useLocale';

/** One card in the "Urgent Renewal" scroller. */

export interface UrgentRenewalCardProps {
  item: Item;
  today: IsoDate;
  onPress: (item: Item) => void;
}

/** The export's cards are a fixed 285px so the next one peeks into view. */
const CARD_WIDTH = 285;

export function UrgentRenewalCard({ item, today, onPress }: UrgentRenewalCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useLocale();
  const status = documentStatus(item.expiryDate, today);
  const tone = theme.status[status];
  const countdown = daysLeftLabel(item.expiryDate, today, t);
  const elapsed = elapsedLabel(item.issueDate, item.expiryDate, today, t);
  const fraction = elapsedFraction(item.issueDate, item.expiryDate, today);

  return (
    <Card
      accessibilityLabel={`${item.title}, ${countdown}`}
      onPress={() => {
        onPress(item);
      }}
      style={{ width: CARD_WIDTH }}
      testID={`urgent-card-${item.id}`}
    >
      <View style={{ gap: theme.spacing.md }}>
        <View style={[styles.header, { gap: theme.spacing.sm }]}>
          <View
            style={[
              styles.iconBox,
              { backgroundColor: tone.container, borderRadius: theme.radius.md },
            ]}
          >
            <Icon name={iconForCategory(item.category)} size={20} tone={tone.foreground} />
          </View>

          <View style={styles.titleBlock}>
            <Text numberOfLines={1} variant="labelLg">
              {item.title}
            </Text>
            {item.issuer === null ? null : (
              <Text color="onSurfaceVariant" numberOfLines={1} variant="bodySm">
                {item.issuer}
              </Text>
            )}
          </View>

          <StatusBadge label={countdown} status={status} />
        </View>

        {elapsed === null || fraction === null ? null : (
          <View style={{ gap: theme.spacing.xs }}>
            <View style={styles.header}>
              <Text color="onSurfaceVariant" variant="bodySm">
                {formatDate(item.expiryDate, locale)}
              </Text>
              <Text variant="labelSm">{elapsed}</Text>
            </View>

            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ max: 100, min: 0, now: Math.round(fraction * 100) }}
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
                    width: `${Math.round(fraction * 100)}%`,
                  },
                ]}
              />
            </View>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  fill: { height: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  iconBox: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  titleBlock: { flex: 1 },
  track: { height: 6, overflow: 'hidden', width: '100%' },
});
