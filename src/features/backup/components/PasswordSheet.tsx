import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BottomSheet, Button, Input, Text } from '@/components';
import {
  MIN_PASSWORD_LENGTH,
  validatePasswordConfirmation,
  type PasswordValidation,
} from '@/services/backup';
import { useTheme } from '@/theme';

import { passwordProblemKey } from '../labels';

/**
 * Passphrase entry, for both directions.
 *
 * Exporting asks twice, importing asks once. There is no way to recover a
 * backup whose passphrase was mistyped — no reset, no hint, nothing held on a
 * server — so the file is not written until the same words have been entered
 * twice, and that asymmetry is the whole reason `confirm` exists.
 */

export interface PasswordSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Requires the passphrase twice and warns that it cannot be recovered. */
  confirm: boolean;
  submitLabel: string;
  onSubmit: (password: string) => void;
  testID?: string;
}

export function PasswordSheet({
  visible,
  onClose,
  title,
  confirm,
  submitLabel,
  onSubmit,
  testID,
}: PasswordSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [touched, setTouched] = useState(false);

  /**
   * The policy applies when creating a backup, not when opening one. A file
   * made by an older build could have any passphrase at all, and refusing to
   * even try it because it is eleven characters would lock someone out of their
   * own backup over a rule that did not exist when they wrote it.
   */
  const validation: PasswordValidation | null = confirm
    ? validatePasswordConfirmation(password, confirmation)
    : null;

  const canSubmit = validation === null ? password.length > 0 : validation.ok;

  /**
   * `length`, not `count`: i18next reserves `count` for plural selection, and a
   * key carrying it without `_one`/`_other` siblings resolves to nothing at
   * all. The same trap cost F11 its PIN-length strings.
   */
  const error =
    touched && validation !== null && !validation.ok
      ? t(passwordProblemKey(validation.problem), { length: MIN_PASSWORD_LENGTH })
      : undefined;

  const close = () => {
    setPassword('');
    setConfirmation('');
    setTouched(false);
    onClose();
  };

  return (
    <BottomSheet onClose={close} title={title} visible={visible}>
      <View style={{ gap: theme.spacing.md }} testID={testID}>
        {confirm ? (
          <Text color="onSurfaceVariant" variant="bodySm">
            {t('backup.passwordExplainer', { length: MIN_PASSWORD_LENGTH })}
          </Text>
        ) : null}

        <Input
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
          error={error}
          label={t('backup.password')}
          onChangeText={setPassword}
          secureTextEntry
          testID={`${testID ?? 'password'}-field`}
          textContentType="none"
          value={password}
        />

        {confirm ? (
          <Input
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect={false}
            label={t('backup.passwordConfirm')}
            onChangeText={setConfirmation}
            secureTextEntry
            testID={`${testID ?? 'password'}-confirm`}
            textContentType="none"
            value={confirmation}
          />
        ) : null}

        {confirm ? (
          <Text color="error" variant="bodySm">
            {t('backup.passwordWarning')}
          </Text>
        ) : null}

        <Button
          label={submitLabel}
          onPress={() => {
            setTouched(true);

            if (!canSubmit) {
              return;
            }

            const entered = password;
            setPassword('');
            setConfirmation('');
            setTouched(false);
            onSubmit(entered);
          }}
          testID={`${testID ?? 'password'}-submit`}
        />
      </View>
    </BottomSheet>
  );
}
