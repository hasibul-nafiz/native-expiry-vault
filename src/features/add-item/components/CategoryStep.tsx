import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components';
import type { DocumentCategory } from '@/db/models';
import { useTheme } from '@/theme';

import { categoryPresets } from '../categoryPresets';

/**
 * The category grid.
 *
 * The export renders these as plain `<button>`s whose selection lives only in
 * CSS classes — invisible to assistive tech and unreadable at save time. Here
 * they are a real radio group.
 */

export interface CategoryStepProps {
  value: DocumentCategory | undefined;
  onSelect: (category: DocumentCategory) => void;
}

export function CategoryStep({ value, onSelect }: CategoryStepProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text accessibilityRole="header" variant="titleLg">
          Select category
        </Text>
        <Text color="onSurfaceVariant" variant="bodyMd">
          Presets calibrate smart reminders automatically.
        </Text>
      </View>

      <View
        accessibilityRole="radiogroup"
        style={[styles.grid, { gap: theme.spacing.sm }]}
        testID="category-grid"
      >
        {categoryPresets.map((preset) => {
          const selected = value === preset.category;

          return (
            <Pressable
              accessibilityLabel={`${preset.title}. ${preset.subtitle}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, selected }}
              key={preset.category}
              onPress={() => {
                onSelect(preset.category);
              }}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: selected
                    ? theme.colors.primaryContainer
                    : theme.colors.surfaceContainerLowest,
                  borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
                  borderRadius: theme.radius.lg,
                  borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                  gap: theme.spacing.sm,
                  padding: theme.spacing.md,
                },
                pressed
                  ? {
                      opacity: theme.interaction.pressedOpacity,
                      transform: [{ scale: theme.interaction.pressedScale }],
                    }
                  : null,
              ]}
              testID={`category-card-${preset.category}`}
            >
              <Icon
                color={selected ? 'onPrimaryContainer' : 'primary'}
                name={preset.icon}
                size={24}
              />
              <Text
                color={selected ? 'onPrimaryContainer' : 'onSurface'}
                numberOfLines={2}
                variant="labelLg"
              >
                {preset.title}
              </Text>
              <Text
                color={selected ? 'onPrimaryContainer' : 'onSurfaceVariant'}
                numberOfLines={2}
                variant="bodySm"
              >
                {preset.subtitle}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { minWidth: '46%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
