import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * The OS "Reduce Motion" switch, as a subscription.
 *
 * Read once on mount and then kept in step: iOS and Android both let the
 * setting change while the app is running, and a user who turns it on because
 * something made them queasy should not have to relaunch.
 *
 * The initial read is asynchronous, so the first frame always reports `false`.
 * That is the safe default — a missed animation is preferable to suppressing
 * every animation on a device where the setting is off.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setReduced(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
