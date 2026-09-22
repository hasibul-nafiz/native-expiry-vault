/**
 * The vault-health score.
 *
 * Deduction-based rather than a ratio, and that is the whole design: the score
 * is an action list, not a grade. Four expired documents is four things to do
 * whether the vault holds five or fifty, so each deduction is a flat, countable
 * penalty the card can name — "3 documents expired, -36" — instead of a number
 * the user has to take on trust.
 *
 * The caps exist so a large, long-neglected vault does not sit at zero with no
 * way to see progress: clearing the first few items always moves the number.
 *
 * The export's "92%" is not reproducible from any data it shows and nothing in
 * it computes a score, so these weights are designed, not ported. It is also a
 * points total rather than a percentage of anything, which is why nothing here
 * or in the UI renders a `%`.
 */

export type HealthBand = 'good' | 'attention' | 'risk' | 'critical';

export type DeductionReason = 'expired' | 'soon' | 'missingReminders' | 'notificationsDenied';

interface Weight {
  points: number;
  cap: number;
}

export const HEALTH_WEIGHTS: Record<DeductionReason, Weight> = {
  expired: { points: 12, cap: 48 },
  soon: { points: 4, cap: 20 },
  missingReminders: { points: 6, cap: 24 },
  // A flat penalty, not per-item: the permission is a property of the vault.
  notificationsDenied: { points: 15, cap: 15 },
};

export const MAX_SCORE = 100;

/** Lower bound of each band, checked from the top down. */
export const HEALTH_BANDS: readonly { band: HealthBand; minScore: number }[] = [
  { band: 'good', minScore: 90 },
  { band: 'attention', minScore: 70 },
  { band: 'risk', minScore: 40 },
  { band: 'critical', minScore: 0 },
];

export interface Deduction {
  reason: DeductionReason;
  /** How many items triggered it; 1 for the flat notification penalty. */
  count: number;
  pointsLost: number;
  /** True when the cap bit, so the card can say the penalty stopped growing. */
  capped: boolean;
}

export interface VaultHealthInput {
  /** Active, non-archived items. */
  totalItems: number;
  expiredCount: number;
  soonCount: number;
  itemsWithoutReminders: number;
  notificationsGranted: boolean;
  /** No rules means nothing to deliver, so a denied permission costs nothing. */
  hasReminderRules: boolean;
}

export interface VaultHealth {
  /** Null for an empty vault: a vault with nothing in it is not 100% healthy. */
  score: number | null;
  band: HealthBand | null;
  /** Only the penalties that actually applied, heaviest first. */
  deductions: Deduction[];
}

function deduct(reason: DeductionReason, count: number): Deduction | null {
  if (count <= 0) {
    return null;
  }

  const { points, cap } = HEALTH_WEIGHTS[reason];
  const uncapped = count * points;

  return {
    reason,
    count,
    pointsLost: Math.min(uncapped, cap),
    capped: uncapped > cap,
  };
}

export function healthBand(score: number): HealthBand {
  const match = HEALTH_BANDS.find(({ minScore }) => score >= minScore);

  // The last band starts at 0 and the score is clamped, so this cannot miss.
  return match?.band ?? 'critical';
}

export function vaultHealth(input: VaultHealthInput): VaultHealth {
  if (input.totalItems === 0) {
    return { score: null, band: null, deductions: [] };
  }

  const deductions = [
    deduct('expired', input.expiredCount),
    deduct('soon', input.soonCount),
    deduct('missingReminders', input.itemsWithoutReminders),
    deduct('notificationsDenied', !input.notificationsGranted && input.hasReminderRules ? 1 : 0),
  ]
    .filter((deduction): deduction is Deduction => deduction !== null)
    .sort((a, b) => b.pointsLost - a.pointsLost);

  const lost = deductions.reduce((total, deduction) => total + deduction.pointsLost, 0);
  const score = Math.max(0, Math.min(MAX_SCORE, MAX_SCORE - lost));

  return { score, band: healthBand(score), deductions };
}
