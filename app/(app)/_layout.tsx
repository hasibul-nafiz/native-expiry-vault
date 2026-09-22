import { Redirect, Stack } from 'expo-router';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { useLockState } from '@/features/lock/useLockState';
import { ReminderRuntime } from '@/features/reminders/ReminderRuntime';

/**
 * Everything behind the lock gate.
 *
 * The redirect sits above the tabs on purpose: a deep link into a locked app
 * lands on the gate rather than briefly rendering the content behind it.
 */
/** Keeps a throw inside the vault from unmounting the lock gate above it. */
export { AppErrorBoundary as ErrorBoundary };

export default function AppLayout() {
  const { t } = useTranslation();
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
        <Stack.Screen name="item/[id]" options={{ title: t('itemDetail.detailsTab') }} />
        {/*
          Modal: on iOS this is the native sheet, whose drag-to-dismiss grabber
          is the handle the export draws by hand. On Android it is a full-screen
          push dismissed with the hardware back button.
        */}
        <Stack.Screen
          name="add"
          options={{ presentation: 'modal', title: t('addItem.newDocument') }}
        />
        {/*
          Full-screen: the camera needs the whole display and the export draws
          it with no chrome at all. Its own Close button dismisses it, since a
          header bar over a viewfinder is neither in the design nor useful.
        */}
        <Stack.Screen
          name="scan"
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="set-pin"
          options={{ presentation: 'modal', title: t('settings.appLock') }}
        />
        {/*
          Dev-only routes. They sit inside this group rather than beside it so
          the gate is total — F3 logged that their old home at the root made
          them reachable without unlocking.
        */}
        <Stack.Screen name="dev-gallery" options={{ title: t('settings.uiGallery') }} />
        <Stack.Screen name="dev-seed" options={{ title: t('settings.sampleData') }} />
      </Stack>
    </Fragment>
  );
}
