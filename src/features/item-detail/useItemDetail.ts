import { useCallback } from 'react';

import type { Database } from '@/db';
import {
  attachmentsRepository,
  itemNotesRepository,
  itemsRepository,
  reminderRulesRepository,
  renewalsRepository,
  renewalTasksRepository,
} from '@/db';
import type {
  Attachment,
  IsoDate,
  Item,
  ItemNote,
  ReminderRule,
  Renewal,
  RenewalTask,
} from '@/db/models';
import { todayLocal } from '@/features/expiry';

import { useAsyncData, type AsyncResult } from '../dashboard/useAsyncData';

/** Everything the detail screen renders, loaded in one pass. */

export interface ItemDetailData {
  today: IsoDate;
  item: Item | null;
  attachments: Attachment[];
  notes: ItemNote[];
  reminders: ReminderRule[];
  renewals: Renewal[];
  tasks: RenewalTask[];
}

export function useItemDetail(db: Database | null, itemId: string): AsyncResult<ItemDetailData> {
  const load = useCallback(async (): Promise<ItemDetailData> => {
    if (db === null) {
      // The provider is still opening; useAsyncData keeps reporting `loading`.
      return new Promise<ItemDetailData>(() => {});
    }

    const today = todayLocal();
    const item = await itemsRepository.getItem(db, itemId);

    if (item === null) {
      return {
        today,
        item: null,
        attachments: [],
        notes: [],
        reminders: [],
        renewals: [],
        tasks: [],
      };
    }

    const [attachments, notes, reminders, renewals, tasks] = await Promise.all([
      attachmentsRepository.listAttachmentsForItem(db, itemId),
      itemNotesRepository.listItemNotes(db, itemId),
      reminderRulesRepository.listReminderRulesForItem(db, itemId),
      renewalsRepository.listRenewals(db, itemId),
      renewalTasksRepository.listRenewalTasks(db, itemId),
    ]);

    return { today, item, attachments, notes, reminders, renewals, tasks };
  }, [db, itemId]);

  return useAsyncData(load);
}
