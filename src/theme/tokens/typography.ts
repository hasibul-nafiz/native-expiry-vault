import type { TextStyle } from 'react-native';

/**
 * From DESIGN.md `typography`. Two conversions React Native requires:
 * - letterSpacing em -> px (RN has no em unit): fontSize * em.
 * - fontWeight -> an explicit per-weight family. Android ignores numeric
 *   fontWeight on runtime-loaded custom fonts and synthesises a fake bold, so
 *   the weight has to be baked into the family name on both platforms.
 */
export const fontFamilies = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const typography = {
  displayLg: { fontFamily: fontFamilies.bold, fontSize: 36, lineHeight: 44, letterSpacing: -0.72 },
  displayLgMobile: {
    fontFamily: fontFamilies.bold,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.56,
  },
  headlineLg: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.42,
  },
  headlineMd: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.22,
  },
  titleLg: { fontFamily: fontFamilies.semiBold, fontSize: 18, lineHeight: 26, letterSpacing: -0.09 },
  titleMd: { fontFamily: fontFamilies.semiBold, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  bodyLg: { fontFamily: fontFamilies.regular, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  bodyMd: { fontFamily: fontFamilies.regular, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  bodySm: { fontFamily: fontFamilies.regular, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  labelLg: { fontFamily: fontFamilies.medium, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  labelMd: { fontFamily: fontFamilies.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  labelSm: { fontFamily: fontFamilies.semiBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.22 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
