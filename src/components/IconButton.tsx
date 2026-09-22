import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { minTouchTarget, useTheme } from '@/theme';

export type IconButtonVariant = 'filled' | 'tonal' | 'ghost';

export interface IconButtonProps {
  /** The glyph. F1 deliberately ships no icon library — the caller supplies it. */
  icon: ReactNode;
  onPress: () => void;
  /** Required: an icon-only control is unusable to a screen reader without it. */
  accessibilityLabel: string;
  variant?: IconButtonVariant;
  disabled?: boolean;
  testID?: string;
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'ghost',
  disabled = false,
  testID,
}: IconButtonProps) {
  const theme = useTheme();

  const backgrounds: Record<IconButtonVariant, string> = {
    filled: theme.colors.primary,
    tonal: theme.colors.surfaceContainer,
    ghost: 'transparent',
  };

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      android_ripple={
        disabled ? undefined : { color: theme.colors.surfaceContainerHighest, borderless: true }
      }
      disabled={disabled}
      hitSlop={theme.spacing.xs}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: backgrounds[variant],
          borderRadius: theme.radius.full,
          height: minTouchTarget,
          width: minTouchTarget,
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
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
