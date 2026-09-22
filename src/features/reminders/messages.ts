import type { PlannedContent } from './computeReminders';

/**
 * Renders a planned notification's data into the text the OS shows.
 *
 * Separate from `computeReminders` so the plan stays data and the wording stays
 * in one place: F11 swaps the bodies of these two functions for i18n lookups
 * without touching the engine or its tests. Strings are inline English until
 * then, as everywhere else in the app.
 */

export interface NotificationText {
  title: string;
  body: string;
}

export function notificationText(content: PlannedContent): NotificationText {
  if (content.kind === 'digest') {
    return {
      title: `${content.count} documents need attention`,
      body: 'Several of your documents are approaching their expiry date.',
    };
  }

  return {
    title: content.itemTitle,
    body: expiryPhrase(content.daysUntilExpiry),
  };
}

/**
 * Deliberately not "in 0 days". A notification that fires on the expiry date
 * itself is the most important one the app sends, and it should read like it.
 */
function expiryPhrase(daysUntilExpiry: number): string {
  if (daysUntilExpiry <= 0) {
    return 'Expires today.';
  }

  if (daysUntilExpiry === 1) {
    return 'Expires tomorrow.';
  }

  return `Expires in ${daysUntilExpiry} days.`;
}
