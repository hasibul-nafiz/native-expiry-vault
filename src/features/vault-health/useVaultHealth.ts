import { useCallback } from 'react';

import type { Database } from '@/db';
import { itemsRepository, reminderRulesRepository, travelStaysRepository } from '@/db';
import type { IsoDate } from '@/db/models';
import { notificationPort, type NotificationPort } from '@/services/notifications';

import { statusWindow, todayLocal } from '../expiry';
import { schengenUsage, type WindowUsage } from '../expiry/travel';
import { useAsyncData, type AsyncResult } from '../dashboard/useAsyncData';

import { vaultHealth, type VaultHealth } from './healthScore';

/**
 * Everything the vault-health screen renders.
 *
 * The score is computed here from repository counts and handed to the pure
 * `vaultHealth`, so the formula itself never touches the database and stays
 * testable on plain numbers.
 */

export interface VaultHealthData {
  today: IsoDate;
  health: VaultHealth;
  totalItems: number;
  soonCount: number;
  itemsWithoutReminders: number;
  /** Null when no travel has been recorded — the card is hidden rather than zeroed. */
  schengen: WindowUsage | null;
}

export function useVaultHealth(
  db: Database | null,
  port: NotificationPort = notificationPort,
): AsyncResult<VaultHealthData> {
  const load = useCallback(async (): Promise<VaultHealthData> => {
    if (db === null) {
      return new Promise<VaultHealthData>(() => {});
    }

    const today = todayLocal();
    const window = statusWindow(today);

    const [counts, totalItems, itemsWithoutReminders, rules, stays, permission] = await Promise.all(
      [
        itemsRepository.countItemsByStatus(db, window),
        itemsRepository.countItems(db),
        itemsRepository.countItemsWithoutReminders(db),
        reminderRulesRepository.listSchedulableRules(db),
        travelStaysRepository.listStayPeriods(db),
        port.getPermission(),
      ],
    );

    return {
      today,
      totalItems,
      soonCount: counts.soon,
      itemsWithoutReminders,
      health: vaultHealth({
        totalItems,
        expiredCount: counts.expired,
        soonCount: counts.soon,
        itemsWithoutReminders,
        notificationsGranted: permission === 'granted',
        hasReminderRules: rules.length > 0,
      }),
      // Nothing writes travel stays yet, so an empty table means "not tracked"
      // rather than "zero days used".
      schengen: stays.length === 0 ? null : schengenUsage(stays, today),
    };
  }, [db, port]);

  return useAsyncData(load);
}
