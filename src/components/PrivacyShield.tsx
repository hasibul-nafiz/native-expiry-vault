import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View, type AppStateStatus } from 'react-native';

import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { shouldShieldContent } from '@/features/lock/autoLock';
import { useLockState } from '@/features/lock/useLockState';
import { screenCapturePort, type ScreenCapturePort } from '@/services/screenCapture';
import { useTheme } from '@/theme';
import { useTranslation } from 'react-i18next';

/**
 * Hides the vault's contents from the app switcher.
 *
 * Two mechanisms, because no single one covers both platforms:
 *
 * Android gets `FLAG_SECURE`, which blanks the recents thumbnail outright. That
 * is a real guarantee from the window manager.
 *
 * iOS gets this overlay, which is best-effort and honestly so. The snapshot is
 * taken at `resignActive`, and React Native has no way to promise a commit
 * before then — a fast enough swipe can capture the frame underneath. Closing
 * that gap needs a native view added in `AppDelegate`, which is a config plugin
 * that cannot be verified without a device build. Logged, not pretended away.
 *
 * Both are conditional on a PIN being enrolled: an unlocked vault has nothing
 * to hide, and blocking every Android screenshot for a user who declined the
 * lock is a cost with no benefit.
 */

export interface PrivacyShieldProps {
  /** Injected by tests. */
  capturePort?: ScreenCapturePort;
}

export function PrivacyShield({ capturePort = screenCapturePort }: PrivacyShieldProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { enrolled } = useLockState();
  // iOS can report `null` here before the first state is determined, despite
  // the type. Anything that is not `active` shields, so an indeterminate
  // launch fails closed — covered rather than exposed.
  const [status, setStatus] = useState<AppStateStatus>(() => AppState.currentState ?? 'unknown');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setStatus);

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (enrolled) {
      void capturePort.prevent();
    } else {
      void capturePort.allow();
    }
  }, [capturePort, enrolled]);

  if (!enrolled || !shouldShieldContent(status)) {
    return null;
  }

  return (
    <View
      // Outside the accessibility tree: it exists for whoever is looking over
      // the user's shoulder, and a screen reader is never reading a snapshot.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.center,
        { backgroundColor: theme.colors.surface, gap: theme.spacing.md },
      ]}
      testID="privacy-shield"
    >
      <Icon color="primary" name="lock" size={40} />
      <Text color="onSurfaceVariant" variant="labelLg">
        {t('privacyShield.locked')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
