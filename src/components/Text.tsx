import { Platform, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme, type PaletteColor, type TypographyVariant } from '@/theme';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: PaletteColor;
  /** Caps text scaling where unbounded growth would break a fixed-size container. */
  maxFontSizeMultiplier?: number;
}

export function Text({
  variant = 'bodyMd',
  color = 'onSurface',
  style,
  maxFontSizeMultiplier,
  ...rest
}: TextProps) {
  const theme = useTheme();

  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        theme.typography[variant],
        { color: theme.colors[color] },
        // Android pads custom fonts vertically, which breaks the design's tight
        // line heights. Harmless on iOS but only valid on Android.
        Platform.OS === 'android' ? { includeFontPadding: false } : null,
        style,
      ]}
      {...rest}
    />
  );
}
