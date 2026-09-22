import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTranslation } from 'react-i18next';

import { Button, Screen, Text } from '@/components';
import { useTheme } from '@/theme';

import { Keypad } from './components/Keypad';
import { PinDots } from './components/PinDots';
import { PIN_LENGTH } from './pin';
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

const PROMPT_KEYS: Record<SetPinStage, string> = {
  current: 'lock.promptCurrent',
  manage: 'lock.promptManage',
  create: 'lock.promptCreate',
  confirm: 'lock.promptConfirm',
};

const DOT_LABEL_KEYS: Record<SetPinStage, string> = {
  current: 'lock.dotsCurrent',
  manage: 'lock.masterPin',
  create: 'lock.dotsNew',
  confirm: 'lock.dotsConfirm',
};

export function SetPinScreen({ onDone, storage }: SetPinScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();
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
          <Text variant="headlineMd">{t('settings.appLock')}</Text>
          <Text color="onSurfaceVariant" style={styles.centred} variant="bodySm">
            {stage === 'manage' ? t('lock.manageBody') : t('lock.createBody')}
          </Text>
        </View>

        {stage === 'manage' ? (
          <View style={{ gap: theme.spacing.md }}>
            <Button label={t('lock.changePin')} onPress={chooseChange} testID="change-pin" />
            <Button
              accessibilityHint={t('lock.removePinHint')}
              disabled={busy}
              label={t('lock.removePin')}
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
                label={t(DOT_LABEL_KEYS[stage])}
              />
              <Text
                accessibilityLiveRegion="polite"
                color={message === null ? 'onSurfaceVariant' : 'error'}
                style={styles.centred}
                variant="labelSm"
              >
                {message === null ? t(PROMPT_KEYS[stage], { digits: PIN_LENGTH }) : t(message)}
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
