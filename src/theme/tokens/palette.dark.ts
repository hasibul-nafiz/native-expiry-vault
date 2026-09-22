import { lightPalette, type PaletteColor } from './palette.light';

/**
 * The Stitch export has no dark reference, so this palette is derived. Three tiers:
 *
 * 1. Verbatim — M3 light schemes already carry their dark counterparts in the
 *    `inverse-*` and `*-fixed` tokens. Those are lifted straight from DESIGN.md.
 * 2. Interpolated — the neutral ramp and the tone-20 `on*` roles have no
 *    counterpart in DESIGN.md. Derived along the existing ramp, hue and chroma
 *    held constant. Logged as assumptions in docs/PROGRESS.md.
 * 3. Verified — every pair below is asserted against WCAG AA by contrast.test.ts.
 *
 * `*Fixed*` roles are theme-independent in M3 and are reused from light as-is.
 */
export const darkPalette: Record<PaletteColor, string> = {
  // Tier 2: neutral ramp interpolated from the light ramp (hue ~255deg).
  surface: '#0f1422',
  surfaceDim: '#0f1422',
  surfaceBright: '#353b4d',
  surfaceContainerLowest: '#0a0e1a',
  surfaceContainerLow: '#171d2e',
  surfaceContainer: '#1b2133',
  surfaceContainerHigh: '#252b3e',
  surfaceContainerHighest: '#303648',
  surfaceVariant: '#434a5f',
  background: '#0f1422',
  onSurfaceVariant: '#c5c4d6',
  outline: '#908fa0',

  // Tier 1: verbatim swaps from DESIGN.md.
  surfaceTint: lightPalette.inversePrimary,
  onSurface: lightPalette.inverseOnSurface,
  onBackground: lightPalette.inverseOnSurface,
  inverseSurface: lightPalette.surface,
  inverseOnSurface: lightPalette.onSurface,
  outlineVariant: lightPalette.onSurfaceVariant,
  primary: lightPalette.inversePrimary,
  primaryContainer: lightPalette.onPrimaryFixedVariant,
  onPrimaryContainer: lightPalette.primaryFixed,
  inversePrimary: lightPalette.primary,
  secondary: lightPalette.secondaryFixedDim,
  secondaryContainer: lightPalette.onSecondaryFixedVariant,
  onSecondaryContainer: lightPalette.secondaryFixed,
  tertiary: lightPalette.tertiaryFixedDim,
  tertiaryContainer: lightPalette.onTertiaryFixedVariant,
  onTertiaryContainer: lightPalette.tertiaryFixed,
  errorContainer: lightPalette.onErrorContainer,
  onErrorContainer: lightPalette.errorContainer,

  // Tier 2: tone 20, interpolated between the tone 10 and tone 30 tokens above.
  onPrimary: '#1b1795',
  onSecondary: '#3c0b8d',
  onTertiary: '#003925',

  // Tier 2: DESIGN.md carries no dark error tone; M3 baseline error palette.
  error: '#ffb4ab',
  onError: '#690005',

  // Theme-independent in M3.
  primaryFixed: lightPalette.primaryFixed,
  primaryFixedDim: lightPalette.primaryFixedDim,
  onPrimaryFixed: lightPalette.onPrimaryFixed,
  onPrimaryFixedVariant: lightPalette.onPrimaryFixedVariant,
  secondaryFixed: lightPalette.secondaryFixed,
  secondaryFixedDim: lightPalette.secondaryFixedDim,
  onSecondaryFixed: lightPalette.onSecondaryFixed,
  onSecondaryFixedVariant: lightPalette.onSecondaryFixedVariant,
  tertiaryFixed: lightPalette.tertiaryFixed,
  tertiaryFixedDim: lightPalette.tertiaryFixedDim,
  onTertiaryFixed: lightPalette.onTertiaryFixed,
  onTertiaryFixedVariant: lightPalette.onTertiaryFixedVariant,
};
