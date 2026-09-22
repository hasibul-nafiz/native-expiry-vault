import type { TFunction } from 'i18next';

import { formatMonthHeading } from '@/i18n';
import type { SupportedLocale } from '@/settings/preferences';
import type { TimelineBand } from '@/theme';

import { NEXT_RANGE_DAYS, type TimelineRange } from './filters';

/**
 * Translation-key helpers for the timeline.
 *
 * F10 held the English copy here; F11 moved it to `src/i18n/locales` and kept
 * the mapping logic, which is what the components call.
 */

export const bandKeys: Record<TimelineBand, string> = {
  critical: 'timeline.bandCritical',
  action: 'timeline.bandAction',
  review: 'timeline.bandReview',
  safeWindow: 'timeline.bandSafeWindow',
  secure: 'timeline.bandSecure',
};

/**
 * "OCT 2026". Built by `Intl` rather than F10's hardcoded English array, so the
 * month name follows the locale.
 */
export function monthHeading(year: number, month: number, locale: SupportedLocale): string {
  return formatMonthHeading(year, month, locale);
}

export function rangeLabel(range: TimelineRange, year: number, t: TFunction): string {
  switch (range) {
    case 'all':
      return t('timeline.rangeAll');
    case 'next30':
      return t('timeline.rangeNext30', { count: NEXT_RANGE_DAYS });
    case 'thisYear':
      return t('timeline.rangeThisYear');
    case 'later':
      return t('timeline.rangeLater', { year: year + 1 });
  }
}

export function urgentSummary(expiredCount: number, t: TFunction): string {
  return t('timeline.urgentSummary', { count: expiredCount });
}
