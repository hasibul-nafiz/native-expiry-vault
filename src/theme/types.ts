import type { PaletteColor } from './tokens/palette.light';
import type { StatusPalette, StatusTone } from './tokens/status';
import type { TimelineBand } from './tokens/timeline';
import { elevation, interaction, radius, spacing } from './tokens/layout';
import { typography } from './tokens/typography';

export type ThemeColors = Record<PaletteColor, string>;
export type StatusColors = StatusPalette;
export type BandColors = Record<TimelineBand, StatusTone>;
export type ColorSchemeName = 'light' | 'dark';

export interface Theme {
  scheme: ColorSchemeName;
  colors: ThemeColors;
  status: StatusColors;
  /** The timeline's five month bands, three of them aliases of `status`. */
  bands: BandColors;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  elevation: typeof elevation;
  interaction: typeof interaction;
}

export type { PaletteColor };
