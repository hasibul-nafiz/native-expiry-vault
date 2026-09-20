import { Platform } from 'react-native';

/** DESIGN.md `spacing`, rem -> px at a 16px root. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  gutter: 16,
  margin: 20,
} as const;

/** DESIGN.md `rounded`, rem -> px at a 16px root. */
export const radius = {
  sm: 4,
  base: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

/**
 * Minimum touch target: 44pt on iOS (HIG), 48dp on Android (Material 3).
 * The only place this divergence is expressed.
 */
export const minTouchTarget = Platform.select({ ios: 44, default: 48 });

/**
 * M3 state layers. Components apply these; the dev gallery reuses the same
 * values to render a static pressed preview, so the two can't drift.
 */
export const interaction = {
  pressedScale: 0.97,
  pressedOpacity: 0.9,
  disabledOpacity: 0.38,
} as const;

/**
 * DESIGN.md specifies two-layer shadows with negative spread
 * (`0 8px 24px -4px ..., 0 2px 6px -1px ...`). React Native cannot express that:
 * iOS supports a single shadow with no spread, Android only a numeric elevation.
 * These are the closest single-layer approximation per platform.
 * Logged as a design/platform conflict in docs/PROGRESS.md.
 */
export const elevation = {
  level0: Platform.select({
    ios: { shadowOpacity: 0 },
    default: { elevation: 0 },
  }),
  level1: Platform.select({
    ios: {
      shadowColor: '#6366f1',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
    },
    default: { elevation: 2 },
  }),
  level2: Platform.select({
    ios: {
      shadowColor: '#6366f1',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
    },
    default: { elevation: 8 },
  }),
} as const;
