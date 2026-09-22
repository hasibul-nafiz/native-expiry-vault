import { useWindowDimensions } from 'react-native';

/**
 * The OS text-size setting, and the two decisions that depend on it.
 *
 * iOS accessibility sizes reach roughly 3.1x and Android's slider reaches 2x.
 * At those sizes a row that puts a title, a badge and a date on one line has no
 * room left for any of them, so the layout has to change rather than truncate.
 * These live in the theme so the threshold is one number, not a guess repeated
 * in five components.
 */

/**
 * Above this, rows that read left-to-right at default size stack vertically.
 * 1.3 is where the design's 20px margins and a two-column row stop coexisting
 * on a 360dp screen, which is the narrowest layout the app targets.
 */
export const STACK_THRESHOLD = 1.3;

/**
 * The ceiling for geometry that scales *with* the text — a fixed-diameter ring,
 * a card width. Past 2x these grow larger than the viewport, so the container
 * stops growing and the text inside it is capped to match.
 */
export const MAX_LAYOUT_SCALE = 2;

/** The raw scale factor. */
export function useFontScale(): number {
  return useWindowDimensions().fontScale;
}

/** True when a horizontal row should reflow to a stack. */
export function useStackedLayout(): boolean {
  return useFontScale() >= STACK_THRESHOLD;
}

/** Scales a fixed dimension alongside the text it contains, up to the ceiling. */
export function useScaledSize(size: number): number {
  return Math.round(size * Math.min(useFontScale(), MAX_LAYOUT_SCALE));
}
