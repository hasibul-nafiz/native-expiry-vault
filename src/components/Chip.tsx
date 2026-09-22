import { Pressable, StyleSheet, View } from 'react-native';

import { minTouchTarget, useTheme } from '@/theme';

import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Optional trailing count, as on the dashboard's filter row. */
  count?: number;
  disabled?: boolean;
  testID?: string;
}

export function Chip({
  label,
  selected = false,
  onPress,
  count,
  disabled = false,
  testID,
}: ChipProps) {
  const theme = useTheme();

  const background = selected ? theme.colors.primary : theme.colors.surfaceContainer;
  const foreground = selected ? 'onPrimary' : 'onSurfaceVariant';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      android_ripple={disabled ? undefined : { color: theme.colors.surfaceContainerHighest }}
      disabled={disabled || onPress === undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: background,
          borderRadius: theme.radius.full,
          gap: theme.spacing.xs,
          minHeight: minTouchTarget,
          paddingHorizontal: theme.spacing.md,
        },
        pressed && !disabled
          ? {
              transform: [{ scale: theme.interaction.pressedScale }],
              opacity: theme.interaction.pressedOpacity,
            }
          : null,
        disabled ? { opacity: theme.interaction.disabledOpacity } : null,
      ]}
      testID={testID}
    >
      <Text color={foreground} maxFontSizeMultiplier={1.4} variant="labelMd">
        {label}
      </Text>
      {count === undefined ? null : (
        <View
          style={[
            styles.count,
            {
              backgroundColor: selected
                ? theme.colors.surfaceContainerLowest
                : theme.colors.surfaceContainerHighest,
              borderRadius: theme.radius.full,
              paddingHorizontal: theme.spacing.xs,
            },
          ]}
        >
          <Text
            color={selected ? 'primary' : 'onSurface'}
            maxFontSizeMultiplier={1.2}
            variant="labelSm"
          >
            {String(count)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row' },
  count: { alignItems: 'center', justifyContent: 'center', minWidth: 20 },
});
