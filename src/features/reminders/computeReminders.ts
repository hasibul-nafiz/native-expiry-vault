import type { DocumentCategory, IsoDate, Item, ReminderRule } from '@/db/models';
import {
  addDays,
  atLocalTime,
  compareDates,
  daysBetween,
  DEFAULT_REMINDER_HOUR,
  ESCALATION_THRESHOLD_DAYS,
  todayLocal,
} from '@/features/expiry';

/**
 * Turns stored reminder rules into the set of notifications the OS should be
 * holding right now.
 *
 * Pure by design, and the reason the rest of F7 is thin: every rule that is
 * interesting — what to skip, how to group, what to drop — is decided here
 * against arguments, with no database, no clock and no native module in the
 * path. `now` is passed in rather than read, so a test can place itself either
 * side of a DST transition or an hour past the delivery time.
 *
 * Rules are grouped into one notification per fire date. A person renewing a
 * passport, a visa and an insurance policy in the same month should not get
 * three separate buzzes in the same minute, and the pending-notification budget
 * is then spent per *date* rather than per rule, which is what makes a vault of
 * any realistic size fit inside it.
 */

/**
 * The number of notifications kept pending with the OS.
 *
 * iOS holds at most 64 per app and silently discards the rest, keeping the
 * soonest. Android's alarm-backed scheduling has historically tolerated fewer.
 * 50 sits under both with room for the daily escalation alerts that are
 * deferred, and the plan reports what it dropped rather than losing it quietly.
 */
export const PENDING_BUDGET = 50;

/** What the notification says, as data. Rendered to text by `messages.ts`. */
export type PlannedContent =
  | {
      kind: 'single';
      itemId: string;
      itemTitle: string;
      category: DocumentCategory;
      /** Days between this notification firing and the document expiring. */
      daysUntilExpiry: number;
    }
  | { kind: 'digest'; count: number };

export interface PlannedNotification {
  /** The calendar day it fires on, and the identity of the group. */
  fireDate: IsoDate;
  /** `fireDate` at the delivery hour, in the device's local time. */
  fireAt: Date;
  /** Every rule this one notification satisfies. */
  ruleIds: string[];
  itemIds: string[];
  content: PlannedContent;
  /** Route to open when tapped. */
  deepLink: string;
}

export interface ReminderPlan {
  /** To be handed to the OS, soonest first. */
  scheduled: PlannedNotification[];
  /**
   * Rules whose moment has passed while undelivered. They are marked delivered
   * rather than fired: "expires in 30 days" arriving four days late is worse
   * than nothing, and leaving them undelivered would reconsider them forever.
   */
  stale: string[];
  /** Beyond the budget. Kept so the UI can say how far ahead it is scheduled. */
  deferred: PlannedNotification[];
}

export interface ReminderOptions {
  /** Local hour of delivery. */
  hour?: number;
  budget?: number;
  /**
   * Days before expiry that an escalating document starts alerting daily.
   * Exposed so tests need not construct a 14-day fixture.
   */
  escalationDays?: number;
}

interface Group {
  fireDate: IsoDate;
  ruleIds: string[];
  items: Item[];
  seenItemIds: Set<string>;
}

export function computeReminders(
  items: readonly Item[],
  rules: readonly ReminderRule[],
  now: Date,
  options: ReminderOptions = {},
): ReminderPlan {
  const hour = options.hour ?? DEFAULT_REMINDER_HOUR;
  const budget = options.budget ?? PENDING_BUDGET;
  const escalationDays = options.escalationDays ?? ESCALATION_THRESHOLD_DAYS;

  // Archived documents are hidden from the vault, so they must not be able to
  // speak from it either. Building the lookup from active items only means an
  // archived item's rules fall out as orphans below.
  const activeItems = new Map<string, Item>();

  for (const item of items) {
    if (item.archivedAt === null) {
      activeItems.set(item.id, item);
    }
  }

  const stale: string[] = [];
  const groups = new Map<IsoDate, Group>();

  for (const rule of rules) {
    if (!rule.enabled || rule.deliveredAt !== null) {
      continue;
    }

    const item = activeItems.get(rule.itemId);

    if (item === undefined) {
      // Archived, deleted, or simply not in the set we were given. A rule with
      // nothing to point at is dropped, not a crash.
      continue;
    }

    const fireAt = atLocalTime(rule.fireDate, hour);

    if (fireAt.getTime() <= now.getTime()) {
      stale.push(rule.id);
      continue;
    }

    const group = groups.get(rule.fireDate) ?? {
      fireDate: rule.fireDate,
      ruleIds: [],
      items: [],
      seenItemIds: new Set<string>(),
    };

    group.ruleIds.push(rule.id);

    // Two rules can land on one date for one document — a renewal moves the
    // expiry until a 90-day rule sits where a 30-day rule already is. The
    // document is counted once; both rules are satisfied by the one send.
    if (!group.seenItemIds.has(item.id)) {
      group.seenItemIds.add(item.id);
      group.items.push(item);
    }

    groups.set(rule.fireDate, group);
  }

  addEscalationDays(groups, activeItems, now, hour, escalationDays);

  const planned = [...groups.values()]
    .sort((a, b) => (a.fireDate < b.fireDate ? -1 : 1))
    .map((group) => toPlannedNotification(group, hour));

  return {
    scheduled: planned.slice(0, budget),
    deferred: planned.slice(budget),
    stale,
  };
}

/**
 * Adds a daily entry for each escalating document's final stretch.
 *
 * This is what `items.escalation_enabled` has always promised — "daily alerts
 * once inside the escalation window" — and what nothing implemented until now.
 *
 * Synthesised rather than stored as rules, so switching the flag off removes
 * them with no rows to clean up, and so a document cannot accumulate fourteen
 * `reminder_rules` every time it approaches expiry.
 *
 * They carry no `ruleIds`: there is no stored rule behind them, nothing to mark
 * delivered, and nothing to reconsider.
 *
 * Only documents whose window is imminent are materialised, not every
 * escalating document in the vault. A passport expiring in 400 days would
 * otherwise claim fourteen slots for alerts more than a year away, crowding out
 * reminders that matter this month. The schedule is rebuilt on every launch,
 * resume and edit, so a distant window is picked up long before it arrives —
 * there is nothing to gain by booking it now, and a budget to lose.
 */
function addEscalationDays(
  groups: Map<IsoDate, Group>,
  activeItems: Map<string, Item>,
  now: Date,
  hour: number,
  escalationDays: number,
): void {
  if (escalationDays <= 0) {
    return;
  }

  const today = todayLocal(now);

  for (const item of activeItems.values()) {
    if (!item.escalationEnabled) {
      continue;
    }

    // Already expired: daily nagging after the fact is not a reminder.
    if (compareDates(item.expiryDate, today) < 0) {
      continue;
    }

    // One window's worth of lookahead: enough that the window is never missed
    // between syncs, bounded so a distant expiry costs nothing today.
    if (daysBetween(today, item.expiryDate) > escalationDays * 2) {
      continue;
    }

    const windowStart = addDays(item.expiryDate, -(escalationDays - 1));
    // Never before today, so a document added mid-window starts from now.
    const firstDay = compareDates(windowStart, today) > 0 ? windowStart : today;

    for (
      let date = firstDay;
      compareDates(date, item.expiryDate) <= 0;
      date = addDays(date, 1)
    ) {
      if (atLocalTime(date, hour).getTime() <= now.getTime()) {
        continue;
      }

      const group = groups.get(date) ?? {
        fireDate: date,
        ruleIds: [],
        items: [],
        seenItemIds: new Set<string>(),
      };

      // A rule already covering this day for this document wins; the escalation
      // entry would be the same notification twice.
      if (!group.seenItemIds.has(item.id)) {
        group.seenItemIds.add(item.id);
        group.items.push(item);
      }

      groups.set(date, group);
    }
  }
}

function toPlannedNotification(group: Group, hour: number): PlannedNotification {
  // Stable ordering so the same inputs always produce the same plan, which is
  // what lets a repeated sync converge instead of churning.
  const items = [...group.items].sort((a, b) =>
    a.title === b.title ? (a.id < b.id ? -1 : 1) : a.title < b.title ? -1 : 1,
  );

  const single = items.length === 1 ? items[0] : undefined;

  return {
    fireDate: group.fireDate,
    fireAt: atLocalTime(group.fireDate, hour),
    ruleIds: [...group.ruleIds].sort(),
    itemIds: items.map((item) => item.id),
    content:
      single === undefined
        ? { kind: 'digest', count: items.length }
        : {
            kind: 'single',
            itemId: single.id,
            itemTitle: single.title,
            category: single.category,
            daysUntilExpiry: daysBetween(group.fireDate, single.expiryDate),
          },
    deepLink: single === undefined ? '/' : `/item/${single.id}`,
  };
}
