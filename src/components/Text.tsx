import { Platform, StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useLocale } from '@/i18n/useLocale';
import { bengaliFontFamilies } from '@/theme/tokens/typography';
import { useTheme, type PaletteColor, type TypographyVariant } from '@/theme';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: PaletteColor;
  /** Caps text scaling where unbounded growth would break a fixed-size container. */
  maxFontSizeMultiplier?: number;
  /**
   * Renders the label in capitals.
   *
   * This exists so no caller reaches for `.toUpperCase()`. That uppercases the
   * string itself, which is what a screen reader then reads — VoiceOver spells
   * short all-caps tokens out letter by letter — and it is a no-op for scripts
   * without case, so Bengali and English would diverge silently. `textTransform`
   * changes only the glyphs.
   */
  uppercase?: boolean;
}

export function Text({
  variant = 'bodyMd',
  color = 'onSurface',
  style,
  maxFontSizeMultiplier,
  uppercase = false,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const locale = useLocale();
  const base = theme.typography[variant];

  /**
   * Bengali swaps the family for its Noto counterpart at the same weight.
   * Inter contains no Bengali glyphs, so without this every Bengali string
   * renders as tofu or falls back to an unstyled system face.
   */
  const family =
    locale === 'bn' ? (bengaliFontFamilies[base.fontFamily] ?? base.fontFamily) : base.fontFamily;

  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        base,
        { fontFamily: family },
        { color: theme.colors[color] },
        // Android pads custom fonts vertically, which breaks the design's tight
        // line heights. Harmless on iOS but only valid on Android.
        Platform.OS === 'android' ? { includeFontPadding: false } : null,
        uppercase ? styles.uppercase : null,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  uppercase: { textTransform: 'uppercase' },
});
