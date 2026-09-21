import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Text } from '@/components';
import { useTheme } from '@/theme';

import { Keypad } from './components/Keypad';
import { PinDots } from './components/PinDots';
import { biometricIcon, biometricLabel, lockoutMessage, wrongPinMessage } from './labels';
import { useLockScreen, type UseLockScreenOptions } from './useLockScreen';

/**
 * The gate.
 *
 * Recreated from design/stitch_expiryvault_mobile_app/biometric_lock_login_expiryvault.
 * Six things the export draws are deliberately absent, each logged in
 * docs/PROGRESS.md: the "AES-256 GCM" claim (the vault is SQLCipher, which is
 * AES-256-CBC), the "Zero-Knowledge Storage" badge, the profile card for a
 * profile that exists nowhere in the schema, the invented "v2.4" pill, the
 * seed-phrase restore for a seed phrase that does not exist, and "Forgot PIN?"
 * for a recovery path that cannot exist while the data is local-only.
 *
 * What the export does not draw and this needs: the wrong-PIN state, the
 * timeout state, and the absence of the biometric button on hardware that has
 * none.
 */

export type LockScreenProps = UseLockScreenOptions;

export function LockScreen(props: LockScreenProps) {
  const theme = useTheme();
  const {
    entry,
    capability,
    attempts,
    error,
    lockoutMs,
    lockedOut,
    busy,
    pressDigit,
    pressBackspace,
    promptBiometric,
  } = useLockScreen(props);

  const kindLabel = biometricLabel(capability.kind);

  const message = lockedOut
    ? lockoutMessage(lockoutMs)
    : error === 'wrong-pin'
      ? wrongPinMessage(attempts)
      : error === 'biometric-failed'
        ? `${kindLabel} was not recognised. Enter your PIN.`
        : null;

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: theme.colors.surface }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { padding: theme.spacing.margin, gap: theme.spacing.lg },
        ]}
      >
        <View style={[styles.header, { gap: theme.spacing.sm }]}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: theme.colors.primaryContainer,
                borderRadius: theme.radius.lg,
              },
            ]}
          >
            <Icon color="onPrimaryContainer" name="lock" size={28} />
          </View>
          <Text variant="headlineMd">Welcome back</Text>
          <Text color="onSurfaceVariant" style={styles.centred} variant="bodySm">
            Your documents are encrypted on this device.
          </Text>
        </View>

        <View style={[styles.header, { gap: theme.spacing.sm }]}>
          <PinDots filled={entry.length} invalid={error === 'wrong-pin'} label="Master PIN" />
          <Text
            // Announced when it changes, so a screen reader hears the rejection
            // and the timeout rather than only seeing them.
            accessibilityLiveRegion="polite"
            color={message === null ? 'onSurfaceVariant' : 'error'}
            style={styles.centred}
            variant="labelSm"
          >
            {message ?? 'Enter your 6-digit Master PIN'}
          </Text>
        </View>

        {capability.enrolled ? (
          <Button
            accessibilityHint="Opens the system biometric prompt"
            disabled={lockedOut || busy}
            label={`Unlock with ${kindLabel}`}
            onPress={promptBiometric}
            size="lg"
            testID="biometric-button"
          />
        ) : null}

        <Keypad
          action={
            capability.enrolled
              ? {
                  icon: biometricIcon(capability.kind),
                  label: `Unlock with ${kindLabel}`,
                  onPress: promptBiometric,
                }
              : undefined
          }
          disabled={lockedOut || busy}
          onBackspace={pressBackspace}
          onDigit={pressDigit}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', height: 56, justifyContent: 'center', width: 56 },
  centred: { textAlign: 'center' },
  content: { flexGrow: 1, justifyContent: 'center' },
  fill: { flex: 1 },
  header: { alignItems: 'center' },
});
