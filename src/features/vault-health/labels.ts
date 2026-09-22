import type { TFunction } from 'i18next';

import type { DeductionReason, HealthBand } from './healthScore';

/**
 * Translation-key helpers for the vault-health screen.
 *
 * F10 held the English copy here; F11 moved it to `src/i18n/locales` and kept
 * the mapping, which is what the components call.
 */

export const healthBandKeys: Record<HealthBand, string> = {
  good: 'vaultHealth.bandGood',
  attention: 'vaultHealth.bandAttention',
  risk: 'vaultHealth.bandRisk',
  critical: 'vaultHealth.bandCritical',
};

const deductionKeys: Record<DeductionReason, string> = {
  expired: 'vaultHealth.deductionExpired',
  soon: 'vaultHealth.deductionSoon',
  missingReminders: 'vaultHealth.deductionMissingReminders',
  notificationsDenied: 'vaultHealth.deductionNotificationsDenied',
};

/**
 * The breakdown line for one deduction, with the count pluralised by the
 * locale's own rules rather than an English `s`.
 */
export function deductionLabel(reason: DeductionReason, count: number, t: TFunction): string {
  return t(deductionKeys[reason], { count });
}

/** "-36" for the trailing figure on a breakdown row. */
export function pointsLabel(pointsLost: number, t: TFunction): string {
  return t('vaultHealth.points', { points: pointsLost });
}

export function schengenSummary(
  used: number,
  allowance: number,
  remaining: number,
  t: TFunction,
): string {
  return t('vaultHealth.schengenSummary', { used, allowance, remaining });
}
