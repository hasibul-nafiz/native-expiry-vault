import { router } from 'expo-router';

import { Button, Screen, Text } from '@/components';
import { useLockState } from '@/features/lock/useLockState';

/**
 * Placeholder gate. F9 replaces the body with the biometric prompt, PIN keypad
 * and recovery options the export draws; the route and the unlock contract stay
 * as they are.
 */
export default function LockScreen() {
  const { unlock } = useLockState();

  const handleUnlock = () => {
    unlock();
    router.replace('/');
  };

  return (
    <Screen>
      <Text variant="headlineMd">Locked</Text>
      <Button label="Unlock" onPress={handleUnlock} testID="unlock-button" />
    </Screen>
  );
}
