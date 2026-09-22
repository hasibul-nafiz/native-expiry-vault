import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import { addDeepLinkListener, consumeInitialDeepLink } from '@/services/notifications';

/**
 * Sends a tapped reminder to the document it is about.
 *
 * Mounted inside the lock gate, so a notification tapped on a locked vault
 * lands on the gate rather than opening a document. The route is dropped in
 * that case rather than queued — F9 owns holding a pending destination across
 * an unlock, and guessing at it here would mean navigating somewhere the user
 * asked for minutes earlier, after authenticating for something else.
 */

export interface UseNotificationDeepLinkOptions {
  /** Injected by tests. */
  getInitial?: typeof consumeInitialDeepLink;
  subscribe?: typeof addDeepLinkListener;
}

export function useNotificationDeepLink({
  getInitial = consumeInitialDeepLink,
  subscribe = addDeepLinkListener,
}: UseNotificationDeepLinkOptions = {}): void {
  const router = useRouter();

  useEffect(() => {
    // A cold start from a tapped notification: the response is already waiting.
    const initial = getInitial();

    if (initial !== null) {
      // The route came from a payload this app wrote and `readDeepLink` has
      // already rejected anything that is not an in-app path.
      router.push(initial as Href);
    }

    return subscribe((deepLink) => {
      router.push(deepLink as Href);
    });
  }, [getInitial, router, subscribe]);
}
