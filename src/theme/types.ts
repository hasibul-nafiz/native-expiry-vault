import type { PaletteColor } from './tokens/palette.light';
import type { StatusPalette } from './tokens/status';
import { elevation, interaction, radius, spacing } from './tokens/layout';
import { typography } from './tokens/typography';

export type ThemeColors = Record<PaletteColor, string>;
export type StatusColors = StatusPalette;
export type ColorSchemeName = 'light' | 'dark';

export interface Theme {
  scheme: ColorSchemeName;
  colors: ThemeColors;
  status: StatusColors;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  elevation: typeof elevation;
  interaction: typeof interaction;
}

export type { PaletteColor };
