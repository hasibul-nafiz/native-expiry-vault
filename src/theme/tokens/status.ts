/**
 * The safe/soon/expired triad is the one token set with no DESIGN.md equivalent —
 * its frontmatter has no amber at all, and the Stitch screens express status with
 * raw Tailwind emerald/amber/rose utilities rather than declared tokens.
 *
 * Values are the Tailwind ramps the export renders, with one correction: the
 * foregrounds the export uses (emerald-600, amber-600, rose-600) all fail WCAG AA
 * for body text on their own containers (3.6:1, 3.1:1, 4.3:1). Each is darkened
 * one step to the -700 ramp, which passes. Asserted in contrast.test.ts.
 */
export type DocumentStatus = 'safe' | 'soon' | 'expired';

export interface StatusTone {
  foreground: string;
  container: string;
}

export type StatusPalette = Record<DocumentStatus, StatusTone>;

export const statusLight: StatusPalette = {
  safe: { foreground: '#047857', container: '#ecfdf5' },
  soon: { foreground: '#b45309', container: '#fffbeb' },
  expired: { foreground: '#be123c', container: '#fff1f2' },
};

/** Derived by the same rule as the dark palette, then contrast-verified. */
export const statusDark: StatusPalette = {
  safe: { foreground: '#34d399', container: '#022c22' },
  soon: { foreground: '#fbbf24', container: '#451a03' },
  expired: { foreground: '#fb7185', container: '#4c0519' },
};

export const documentStatuses: readonly DocumentStatus[] = ['safe', 'soon', 'expired'];
