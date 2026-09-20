import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, StatusBadge, Text, iconForCategory } from '@/components';
import type { IsoDate, Item } from '@/db/models';
import { documentStatus } from '@/features/expiry';
import { minTouchTarget, useTheme } from '@/theme';

import { daysLeftLabel } from '../selectors';

/** One row in the "Vault Records" list. */

export interface RecordRowProps {
  item: Item;
  today: IsoDate;
  onPress: (item: Item) => void;
}

const statusLabels = { safe: 'Safe', soon: 'Soon', expired: 'Expired' } as const;

export function RecordRow({ item, today, onPress }: RecordRowProps) {
  const theme = useTheme();
  const status = documentStatus(item.expiryDate, today);
  const tone = theme.status[status];
  const countdown = daysLeftLabel(item.expiryDate, today);

  const subtitle = [item.country, item.issuer].filter((part) => part !== null).join(' · ');

  return (
    <Pressable
      accessibilityHint="Opens the document details"
      accessibilityLabel={`${item.title}, ${statusLabels[status]}, ${countdown}`}
      accessibilityRole="button"
      onPress={() => {
        onPress(item);
      }}
      style={({ pressed }) => [
        styles.row,
        {
          gap: theme.spacing.md,
          minHeight: minTouchTarget,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.md,
        },
        pressed ? { backgroundColor: theme.colors.surfaceContainer } : null,
      ]}
      testID={`record-row-${item.id}`}
    >
      <View
        style={[styles.iconBox, { backgroundColor: tone.container, borderRadius: theme.radius.md }]}
      >
        <Icon name={iconForCategory(item.category)} size={22} tone={tone.foreground} />
      </View>

      <View style={styles.textBlock}>
        <View style={[styles.titleRow, { gap: theme.spacing.sm }]}>
          <Text numberOfLines={1} style={styles.title} variant="labelLg">
            {item.title}
          </Text>
          <StatusBadge label={statusLabels[status]} status={status} />
        </View>
        {subtitle === '' ? null : (
          <Text color="onSurfaceVariant" numberOfLines={1} variant="bodySm">
            {subtitle}
          </Text>
        )}
      </View>

      <View style={styles.trailing}>
        <Text
          numberOfLines={1}
          style={{ color: status === 'expired' ? tone.foreground : theme.colors.onSurface }}
          variant="labelMd"
        >
          {item.expiryDate}
        </Text>
        <Text numberOfLines={1} style={{ color: tone.foreground }} variant="bodySm">
          {countdown}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconBox: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  row: { alignItems: 'center', flexDirection: 'row' },
  textBlock: { flex: 1, minWidth: 0 },
  title: { flexShrink: 1 },
  titleRow: { alignItems: 'center', flexDirection: 'row' },
  trailing: { alignItems: 'flex-end' },
});
