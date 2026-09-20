import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { minTouchTarget, useTheme } from '@/theme';
import type { PaletteColor } from '@/theme';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  testID?: string;
}

/**
 * DESIGN.md defines no button height ramp, so these are component intrinsics
 * rather than tokens. Each is floored at the platform touch minimum below.
 */
const heights: Record<ButtonSize, number> = { sm: 40, md: 48, lg: 56 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;

  const palette: Record<ButtonVariant, { background: string; label: PaletteColor; border?: string }> =
    {
      primary: { background: theme.colors.primary, label: 'onPrimary' },
      secondary: {
        background: theme.colors.surfaceContainerLowest,
        label: 'primary',
        border: theme.colors.outline,
      },
      ghost: { background: 'transparent', label: 'primary' },
    };

  const { background, label: labelColor, border } = palette[variant];

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      android_ripple={inactive ? undefined : { color: theme.colors.surfaceContainerHighest }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: background,
          borderRadius: theme.radius.full,
          minHeight: Math.max(heights[size], minTouchTarget),
          paddingHorizontal: theme.spacing.lg,
        },
        border ? { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: border } : null,
        pressed && !inactive
          ? {
              transform: [{ scale: theme.interaction.pressedScale }],
              opacity: theme.interaction.pressedOpacity,
            }
          : null,
        inactive ? { opacity: theme.interaction.disabledOpacity } : null,
      ]}
      testID={testID}
    >
      <View style={[styles.content, { gap: theme.spacing.sm }]}>
        {loading ? (
          <ActivityIndicator
            accessibilityElementsHidden
            color={theme.colors[labelColor]}
            size="small"
          />
        ) : null}
        <Text color={labelColor} maxFontSizeMultiplier={1.6} variant="labelLg">
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', flexDirection: 'row' },
});
