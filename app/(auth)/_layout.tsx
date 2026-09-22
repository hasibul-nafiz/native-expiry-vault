import { Stack } from 'expo-router';

/**
 * The lock gate. `gestureEnabled` is off and there is no header: a security gate
 * must not be swipeable or dismissable, on either platform.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />;
}
