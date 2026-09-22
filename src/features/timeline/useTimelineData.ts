import { useCallback } from 'react';

import type { Database } from '@/db';
import { itemsRepository } from '@/db';
import type { IsoDate, Item } from '@/db/models';

import { useAsyncData, type AsyncResult } from '../dashboard/useAsyncData';
import { todayLocal } from '../expiry';

import { countsByRange, type TimelineRange } from './filters';

/**
 * One read for the whole screen: every active item, sorted by expiry.
 *
 * Grouping and filtering happen in memory rather than as extra queries, so the
 * chip counts and the feed are always derived from the same rows and the same
 * `today` — they cannot disagree across a midnight boundary. This is the rule
 * F4 established for the dashboard, and the vault sizes involved are tens of
 * rows, not thousands.
 */

export interface TimelineData {
  today: IsoDate;
  items: Item[];
  counts: Record<TimelineRange, number>;
  expiredCount: number;
}

export function useTimelineData(db: Database | null): AsyncResult<TimelineData> {
  const load = useCallback(async (): Promise<TimelineData> => {
    if (db === null) {
      // The provider is still opening; useAsyncData keeps reporting `loading`.
      return new Promise<TimelineData>(() => {});
    }

    const today = todayLocal();
    const items = await itemsRepository.listItems(db);

    return {
      today,
      items,
      counts: countsByRange(items, today),
      expiredCount: items.filter((item) => item.expiryDate < today).length,
    };
  }, [db]);

  return useAsyncData(load);
}
