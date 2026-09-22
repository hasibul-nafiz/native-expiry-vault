import { StyleSheet, View } from 'react-native';

import { useTranslation } from 'react-i18next';

import { Card, Icon, StatusBadge, Text, iconForCategory } from '@/components';
import type { IsoDate, Item } from '@/db/models';
import { useTheme } from '@/theme';

import { daysLeftLabel } from '../../dashboard/selectors';
import { documentStatus } from '../../expiry';

/**
 * One document on the timeline.
 *
 * The card keeps the three-status colouring the rest of the app uses; only the
 * month header above it carries the five-band tone. The export's per-card
 * extras — a "grace period" countdown, an "Immigration Queue Buffer" meter, an
 * auto-renew pill — have no field behind them and are not rendered.
 */

export interface TimelineEntryCardProps {
  item: Item;
  today: IsoDate;
  onPress: (id: string) => void;
  testID?: string;
}

const statusKeys = {
  expired: 'status.expired',
  soon: 'status.expiringSoon',
  safe: 'status.valid',
} as const;

export function TimelineEntryCard({ item, today, onPress, testID }: TimelineEntryCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const status = documentStatus(item.expiryDate, today);
  const countdown = daysLeftLabel(item.expiryDate, today, t);

  return (
    <Card
      accessibilityLabel={`${item.title}, ${t(statusKeys[status])}, ${countdown}`}
      onPress={() => onPress(item.id)}
      testID={testID}
    >
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        <View
          style={[
            styles.glyph,
            {
              backgroundColor: theme.colors.surfaceContainer,
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <Icon color="primary" name={iconForCategory(item.category)} size={22} />
        </View>
        <View style={[styles.body, { gap: theme.spacing.xs }]}>
          <Text numberOfLines={2} variant="titleMd">
            {item.title}
          </Text>
          <Text color="onSurfaceVariant" variant="bodySm">
            {countdown}
          </Text>
          {item.issuer === null ? null : (
            <Text color="onSurfaceVariant" numberOfLines={1} variant="bodySm">
              {item.issuer}
            </Text>
          )}
        </View>
        <StatusBadge label={t(statusKeys[status])} status={status} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'flex-start', flexDirection: 'row' },
  glyph: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  body: { flex: 1 },
});
