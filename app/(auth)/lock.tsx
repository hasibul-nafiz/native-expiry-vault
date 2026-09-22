import { Redirect } from 'expo-router';

import { LockScreen } from '@/features/lock/LockScreen';
import { useLockState } from '@/features/lock/useLockState';

/**
 * The gate. `(app)/_layout.tsx` redirects here whenever the vault is locked;
 * this redirects back once it is not, which is what makes a successful unlock
 * navigate without the screen itself knowing any routes.
 *
 * It returns to the root rather than to wherever the user was. A pending
 * notification deep link is picked up by `ReminderRuntime` as it remounts
 * behind the gate, so a reminder tapped on a locked phone still lands on its
 * document.
 */
export default function LockRoute() {
  const { isLocked } = useLockState();

  if (!isLocked) {
    return <Redirect href="/" />;
  }

  return <LockScreen />;
}
