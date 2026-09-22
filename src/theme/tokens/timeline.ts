import { type StatusPalette, type StatusTone } from './status';

/**
 * The timeline's five month-header tones.
 *
 * The export draws five month bands (red, violet, indigo, green, deep green)
 * where the app has three statuses. Three of the five are the existing
 * safe/soon/expired tones and are *referenced*, not restated, so a month header
 * and a document badge describing the same urgency can never drift apart.
 *
 * Only the two bands with no status equivalent get new values:
 * - `review`   (61-365 days) — beyond the soon window but inside a year.
 * - `secure`   (>3 years)    — further out than "safe" needs to distinguish.
 *
 * DESIGN.md has no source for either, and no dark reference for anything, so
 * both are derived the same way F1 derived its dark ramp and then verified:
 * every pair is asserted against WCAG AA in `contrast.test.ts`.
 */
export type TimelineBand = 'critical' | 'action' | 'review' | 'safeWindow' | 'secure';

export const timelineBands: readonly TimelineBand[] = [
  'critical',
  'action',
  'review',
  'safeWindow',
  'secure',
];

/** The bands that are not already a document status. */
export type TimelineExtraBand = Extract<TimelineBand, 'review' | 'secure'>;

export type TimelineExtraPalette = Record<TimelineExtraBand, StatusTone>;

export const timelineExtraLight: TimelineExtraPalette = {
  review: { foreground: '#4338ca', container: '#eef2ff' },
  secure: { foreground: '#0f766e', container: '#f0fdfa' },
};

export const timelineExtraDark: TimelineExtraPalette = {
  review: { foreground: '#a5b4fc', container: '#1e1b4b' },
  secure: { foreground: '#5eead4', container: '#042f2e' },
};

/**
 * Resolves all five bands from the two palettes, so the shared three have
 * exactly one definition.
 */
export function buildBandPalette(
  status: StatusPalette,
  extra: TimelineExtraPalette,
): Record<TimelineBand, StatusTone> {
  return {
    critical: status.expired,
    action: status.soon,
    review: extra.review,
    safeWindow: status.safe,
    secure: extra.secure,
  };
}
