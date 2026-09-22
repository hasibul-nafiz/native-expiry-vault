import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { Database } from '@/db';
import { itemsRepository } from '@/db';
import type { DocumentCategory, IsoDate, Item } from '@/db/models';
import type { DocumentStatus } from '@/theme';

import { statusWindow, todayLocal } from '../expiry';

import { buildCategoryFilters, selectUrgentItems, type CategoryFilter } from './selectors';
import { useAsyncData, type AsyncResult } from './useAsyncData';

/**
 * Everything the dashboard renders, in one load.
 *
 * All SQL lives in F2's repositories; this composes their already-tested,
 * index-backed queries. `today` is resolved once per load and threaded through
 * every derived value, so the counters, the countdowns and the status bands can
 * never disagree about what day it is — even across a midnight boundary.
 */

export interface DashboardFilters {
  category: DocumentCategory | null;
  search: string;
}

export interface DashboardData {
  today: IsoDate;
  /** Global counts — a category filter narrows the record list, not the tiles. */
  counts: Record<DocumentStatus, number>;
  total: number;
  categoryFilters: CategoryFilter[];
  nextRenewal: Item | null;
  urgent: Item[];
  records: Item[];
}

export function useDashboardData(
  db: Database | null,
  filters: DashboardFilters,
): AsyncResult<DashboardData> {
  const { category, search } = filters;
  const { t } = useTranslation();

  const load = useCallback(async (): Promise<DashboardData> => {
    if (db === null) {
      // The provider is still opening; useAsyncData keeps reporting `loading`.
      return new Promise<DashboardData>(() => {});
    }

    const today = todayLocal();
    const window = statusWindow(today);

    const [counts, countsByCategory, total, nextRenewal, expired, soon, records] =
      await Promise.all([
        itemsRepository.countItemsByStatus(db, window),
        itemsRepository.countItemsByCategory(db),
        itemsRepository.countItems(db),
        itemsRepository.getNextExpiringItem(db, today),
        itemsRepository.listItems(db, { status: 'expired', window }),
        itemsRepository.listItems(db, { status: 'soon', window }),
        itemsRepository.listItems(db, {
          category: category ?? undefined,
          search: search.trim() === '' ? undefined : search,
        }),
      ]);

    return {
      today,
      counts,
      total,
      categoryFilters: buildCategoryFilters(countsByCategory, total, t),
      nextRenewal,
      urgent: selectUrgentItems(expired, soon),
      records,
    };
  }, [db, category, search, t]);

  return useAsyncData(load);
}
