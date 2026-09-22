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
  /**
   * Mirrors the OS "Reduce Motion" switch.
   *
   * On the theme rather than read per component, so every animated surface
   * answers to one source and none can be forgotten.
   */
  reduceMotion: boolean;
  colors: ThemeColors;
  status: StatusColors;
  /** The timeline's five month bands, three of them aliases of `status`. */
  bands: BandColors;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  elevation: typeof elevation;
  /**
   * Widened from the token's literal types: `pressedScale` is overridden to 1
   * under Reduce Motion, which `as const` would otherwise forbid.
   */
  interaction: Record<keyof typeof interaction, number>;
}

export type { PaletteColor };
