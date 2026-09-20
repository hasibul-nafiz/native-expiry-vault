import { Redirect, Stack } from 'expo-router';
import { Fragment } from 'react';

import { useLockState } from '@/features/lock/useLockState';
import { ReminderRuntime } from '@/features/reminders/ReminderRuntime';

/**
 * Everything behind the lock gate.
 *
 * The redirect sits above the tabs on purpose: a deep link into a locked app
 * lands on the gate rather than briefly rendering the content behind it.
 */
export default function AppLayout() {
  const { isLocked } = useLockState();

  if (isLocked) {
    return <Redirect href="/lock" />;
  }

  return (
    <Fragment>
      {/* Headless: keeps the OS's pending reminders in step with the vault. */}
      <ReminderRuntime />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/*
          Pushed: the default native back gives the iOS interactive swipe-back
          gesture and the Android hardware back button for free.
        */}
        <Stack.Screen name="item/[id]" options={{ title: 'Details' }} />
        {/*
          Modal: on iOS this is the native sheet, whose drag-to-dismiss grabber
          is the handle the export draws by hand. On Android it is a full-screen
          push dismissed with the hardware back button.
        */}
        <Stack.Screen name="add" options={{ presentation: 'modal', title: 'New Document' }} />
        {/*
          Full-screen: the camera needs the whole display and the export draws
          it with no chrome at all. Its own Close button dismisses it, since a
          header bar over a viewfinder is neither in the design nor useful.
        */}
        <Stack.Screen
          name="scan"
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
      </Stack>
    </Fragment>
  );
}
