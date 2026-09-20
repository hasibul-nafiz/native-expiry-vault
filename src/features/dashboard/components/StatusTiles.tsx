import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components';
import type { IconName } from '@/components';
import { useTheme } from '@/theme';
import type { DocumentStatus } from '@/theme';

/** The three counters. Tapping one filters the list to that status. */

interface Tile {
  status: DocumentStatus;
  label: string;
  sublabel: string;
  icon: IconName;
}

const tiles: readonly Tile[] = [
  { status: 'safe', label: 'Valid', sublabel: 'Healthy', icon: 'safe' },
  { status: 'soon', label: 'Review', sublabel: '< 60 days', icon: 'soon' },
  { status: 'expired', label: 'Expired', sublabel: 'Immediate', icon: 'expired' },
];

export interface StatusTilesProps {
  counts: Record<DocumentStatus, number>;
  selected: DocumentStatus | null;
  onSelect: (status: DocumentStatus | null) => void;
}

export function StatusTiles({ counts, selected, onSelect }: StatusTilesProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { gap: theme.spacing.sm }]}>
      {tiles.map((tile) => {
        const tone = theme.status[tile.status];
        const isSelected = selected === tile.status;

        return (
          <Pressable
            accessibilityHint="Filters the list to these documents"
            accessibilityLabel={`${tile.label}, ${counts[tile.status]} documents, ${tile.sublabel}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={tile.status}
            onPress={() => {
              onSelect(isSelected ? null : tile.status);
            }}
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: isSelected ? tone.container : theme.colors.surfaceContainerLowest,
                borderColor: isSelected ? tone.foreground : theme.colors.outlineVariant,
                borderRadius: theme.radius.lg,
                borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
                gap: theme.spacing.xs,
                padding: theme.spacing.sm,
              },
              pressed
                ? {
                    opacity: theme.interaction.pressedOpacity,
                    transform: [{ scale: theme.interaction.pressedScale }],
                  }
                : null,
            ]}
            testID={`status-tile-${tile.status}`}
          >
            <View style={styles.header}>
              <Text color="onSurfaceVariant" numberOfLines={1} variant="labelSm">
                {tile.label}
              </Text>
              <Icon name={tile.icon} size={16} tone={tone.foreground} />
            </View>

            <Text
              maxFontSizeMultiplier={1.5}
              style={{
                color: tile.status === 'expired' ? tone.foreground : theme.colors.onSurface,
              }}
              variant="headlineMd"
            >
              {String(counts[tile.status])}
            </Text>

            <Text numberOfLines={1} style={{ color: tone.foreground }} variant="labelSm">
              {tile.sublabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  row: { flexDirection: 'row' },
  tile: { flex: 1 },
});
