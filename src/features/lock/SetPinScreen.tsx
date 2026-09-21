import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components';
import { useTheme } from '@/theme';

import { Keypad } from './components/Keypad';
import { PinDots } from './components/PinDots';
import { useLockState } from './useLockState';
import { useSetPin, type SetPinStage } from './useSetPin';

/**
 * Enrol, change or turn off the master PIN.
 *
 * Nothing in the Stitch export corresponds to this screen; the whole flow is
 * designed. It reuses the gate's keypad and dots so the two cannot drift on
 * what entering a PIN looks or sounds like.
 */

export interface SetPinScreenProps {
  /** Called once the PIN has been saved or removed. The route dismisses. */
  onDone: () => void;
  storage?: Parameters<typeof useSetPin>[0]['storage'];
}

const PROMPTS: Record<SetPinStage, string> = {
  current: 'Enter your current PIN',
  manage: 'App lock is on',
  create: 'Choose a 6-digit PIN',
  confirm: 'Enter it again to confirm',
};

const DOT_LABELS: Record<SetPinStage, string> = {
  current: 'Current PIN',
  manage: 'PIN',
  create: 'New PIN',
  confirm: 'Confirm new PIN',
};

export function SetPinScreen({ onDone, storage }: SetPinScreenProps) {
  const theme = useTheme();
  const { enrolled } = useLockState();
  const { stage, entry, message, busy, done, pressDigit, pressBackspace, chooseChange, chooseRemove } =
    useSetPin({ enrolled, storage });

  useEffect(() => {
    if (done !== null) {
      onDone();
    }
  }, [done, onDone]);

  return (
    <Screen scroll>
      <View style={[styles.content, { gap: theme.spacing.lg }]}>
        <View style={[styles.header, { gap: theme.spacing.sm }]}>
          <Text variant="headlineMd">App lock</Text>
          <Text color="onSurfaceVariant" style={styles.centred} variant="bodySm">
            {stage === 'manage'
              ? 'Your vault asks for this PIN when you open it, and again after a minute in the background.'
              : 'Only this PIN and your device biometrics can open the vault. There is no way to recover it.'}
          </Text>
        </View>

        {stage === 'manage' ? (
          <View style={{ gap: theme.spacing.md }}>
            <Button label="Change PIN" onPress={chooseChange} testID="change-pin" />
            <Button
              accessibilityHint="Removes the PIN. The vault will open without asking."
              disabled={busy}
              label="Turn off app lock"
              onPress={chooseRemove}
              testID="remove-pin"
              variant="secondary"
            />
          </View>
        ) : (
          <>
            <View style={[styles.header, { gap: theme.spacing.sm }]}>
              <PinDots
                filled={entry.length}
                invalid={message !== null}
                label={DOT_LABELS[stage]}
              />
              <Text
                accessibilityLiveRegion="polite"
                color={message === null ? 'onSurfaceVariant' : 'error'}
                style={styles.centred}
                variant="labelSm"
              >
                {message ?? PROMPTS[stage]}
              </Text>
            </View>

            <Keypad disabled={busy} onBackspace={pressBackspace} onDigit={pressDigit} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centred: { textAlign: 'center' },
  content: { flex: 1, justifyContent: 'center' },
  header: { alignItems: 'center' },
});
