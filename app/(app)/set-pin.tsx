import { router } from 'expo-router';
import { useCallback } from 'react';

import { SetPinScreen } from '@/features/lock/SetPinScreen';

/** Enrol, change or turn off the app lock. Reached from Settings. */
export default function SetPinRoute() {
  const handleDone = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    }
  }, []);

  return <SetPinScreen onDone={handleDone} />;
}
