import { contrastRatio, relativeLuminance, WCAG_AA_BODY, WCAG_AA_NON_TEXT } from '../contrast';
import { darkPalette } from '../tokens/palette.dark';
import { lightPalette } from '../tokens/palette.light';
import { documentStatuses, statusDark, statusLight } from '../tokens/status';
import type { ThemeColors } from '../types';

describe('contrast maths', () => {
  it('computes known luminance anchors', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
  });

  it('computes the maximum ratio for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('is symmetric and self-referential', () => {
    expect(contrastRatio('#4648d4', '#faf8ff')).toBeCloseTo(contrastRatio('#faf8ff', '#4648d4'), 5);
    expect(contrastRatio('#4648d4', '#4648d4')).toBeCloseTo(1, 5);
  });

  it('supports shorthand hex', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 1);
  });

  it('rejects values that are not hex colours', () => {
    expect(() => contrastRatio('rebeccapurple', '#ffffff')).toThrow(/hex/i);
  });
});

/** Every foreground/background pair the UI kit actually renders. */
const textPairs: [keyof ThemeColors, keyof ThemeColors][] = [
  ['onSurface', 'surface'],
  ['onSurfaceVariant', 'surface'],
  ['onSurface', 'surfaceContainerLowest'],
  ['onSurfaceVariant', 'surfaceContainerLowest'],
  ['onSurface', 'surfaceContainer'],
  ['onSurfaceVariant', 'surfaceContainer'],
  ['onSurface', 'surfaceContainerHigh'],
  ['primary', 'surface'],
  ['primary', 'surfaceContainerLowest'],
  ['onPrimary', 'primary'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['onSecondary', 'secondary'],
  ['onSecondaryContainer', 'secondaryContainer'],
  ['onTertiary', 'tertiary'],
  ['onTertiaryContainer', 'tertiaryContainer'],
  ['onError', 'error'],
  ['onErrorContainer', 'errorContainer'],
  ['error', 'surface'],
  ['error', 'surfaceContainerLowest'],
  ['inverseOnSurface', 'inverseSurface'],
];

describe.each([
  ['light', lightPalette as ThemeColors],
  ['dark', darkPalette],
])('%s palette meets WCAG AA', (_scheme, palette) => {
  it.each(textPairs)('%s on %s is readable as body text', (foreground, background) => {
    expect(contrastRatio(palette[foreground], palette[background])).toBeGreaterThanOrEqual(
      WCAG_AA_BODY,
    );
  });

  // `outline` delineates interactive controls, so WCAG's 3:1 non-text minimum
  // applies. `outlineVariant` is M3's decorative divider — it carries no meaning
  // and is exempt, so it only has to be perceptible against the surface.
  it('uses outline for boundaries that carry meaning', () => {
    expect(contrastRatio(palette.outline, palette.surface)).toBeGreaterThanOrEqual(
      WCAG_AA_NON_TEXT,
    );
  });

  it('keeps outlineVariant perceptible as a decorative divider', () => {
    expect(contrastRatio(palette.outlineVariant, palette.surface)).toBeGreaterThan(1.2);
  });
});

describe.each([
  ['light', statusLight],
  ['dark', statusDark],
])('%s status tokens meet WCAG AA', (_scheme, status) => {
  it.each(documentStatuses)('%s foreground is readable on its container', (name) => {
    const { foreground, container } = status[name];
    expect(contrastRatio(foreground, container)).toBeGreaterThanOrEqual(WCAG_AA_BODY);
  });
});

describe('palette parity', () => {
  it('defines every light token in dark, so a missing value fails here not in the UI', () => {
    expect(Object.keys(darkPalette).sort()).toEqual(Object.keys(lightPalette).sort());
  });

  it('defines the same status shape in both schemes', () => {
    expect(Object.keys(statusDark).sort()).toEqual(Object.keys(statusLight).sort());
  });

  it('inverts the surface ramp rather than reusing light values', () => {
    expect(relativeLuminance(darkPalette.surface)).toBeLessThan(
      relativeLuminance(lightPalette.surface),
    );
    expect(relativeLuminance(darkPalette.onSurface)).toBeGreaterThan(
      relativeLuminance(lightPalette.onSurface),
    );
  });
});
