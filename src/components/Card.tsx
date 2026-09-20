import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

export interface CardProps {
  children: ReactNode;
  /** Supplying this makes the card a button rather than a static container. */
  onPress?: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Card({
  children,
  onPress,
  accessibilityLabel,
  disabled = false,
  style,
  testID,
}: CardProps) {
  const theme = useTheme();

  const surface: ViewStyle = {
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderColor: theme.colors.outlineVariant,
    borderRadius: theme.radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: theme.spacing.margin,
    ...theme.elevation.level1,
  };

  if (onPress === undefined) {
    return (
      <View style={[surface, style]} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      android_ripple={disabled ? undefined : { color: theme.colors.surfaceContainerHigh }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        surface,
        style,
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
      {children}
    </Pressable>
  );
}
