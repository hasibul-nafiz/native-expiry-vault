import type { Database } from '@/db';
import { itemsRepository, reminderRulesRepository } from '@/db';
import type { NotificationPort, PermissionState } from '@/services/notifications';

import { computeReminders, type ReminderOptions } from './computeReminders';

/**
 * Brings the OS's pending notifications in line with what the database says.
 *
 * The strategy is cancel-everything-then-reschedule rather than a diff. A diff
 * would have to reconcile three views that can each be stale — what the OS
 * holds, what `notification_id` records, and what the rules now imply — and
 * every bug in that reconciliation is a reminder that silently never arrives.
 * Rescheduling from scratch cannot drift. It costs at most `PENDING_BUDGET`
 * native calls, only on launch, resume, or a mutation, and the gap where
 * nothing is pending is microseconds wide while the soonest notification is
 * days away.
 */

export interface SyncOutcome {
  /** Notifications now pending with the OS. */
  scheduled: number;
  /** Rules whose date passed undelivered, now closed off. */
  stale: number;
  /** Beyond the budget; the vault is scheduled this far ahead and no further. */
  deferred: number;
  /** The last date covered, for the reminders sheet. */
  scheduledThrough: string | null;
  /**
   * Reported back rather than only acted on, so the UI can explain why nothing
   * is pending without asking the OS a second time.
   */
  permission: PermissionState;
}

export interface SyncOptions extends ReminderOptions {
  /** Injected so tests can pin the clock. */
  now?: Date;
}

export async function syncNotifications(
  db: Database,
  port: NotificationPort,
  options: SyncOptions = {},
): Promise<SyncOutcome> {
  const now = options.now ?? new Date();
  const permission = await port.getPermission();

  if (permission !== 'granted') {
    // The rules stay in the database untouched. Nothing is lost by not
    // scheduling: granting permission later runs this again and catches up.
    return { scheduled: 0, stale: 0, deferred: 0, scheduledThrough: null, permission };
  }

  const [items, rules] = await Promise.all([
    itemsRepository.listItems(db),
    reminderRulesRepository.listSchedulableRules(db),
  ]);

  const plan = computeReminders(items, rules, now, options);

  // Closed off first. These are already in the past, so if the scheduling below
  // fails they should still not be reconsidered on the next launch.
  for (const ruleId of plan.stale) {
    await reminderRulesRepository.markReminderDelivered(db, ruleId);
  }

  await port.cancelAll();

  // Every stored handle is now stale, whether or not the reschedule below
  // succeeds. Cleared across all rules rather than just the schedulable ones:
  // archiving a document removes its rules from that set while leaving their
  // handles behind, pointing at notifications this cancellation just destroyed.
  await reminderRulesRepository.clearAllNotificationIds(db);

  for (const notification of plan.scheduled) {
    const identifier = await port.schedule(notification);

    // Every rule in the digest points at the one notification that satisfies it.
    for (const ruleId of notification.ruleIds) {
      await reminderRulesRepository.setReminderNotificationId(db, ruleId, identifier);
    }
  }

  const last = plan.scheduled.at(-1);

  return {
    scheduled: plan.scheduled.length,
    stale: plan.stale.length,
    deferred: plan.deferred.length,
    scheduledThrough: last?.fireDate ?? null,
    permission,
  };
}
