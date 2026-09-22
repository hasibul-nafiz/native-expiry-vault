import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { PIN_LENGTH } from '../pin';

export interface PinDotsProps {
  filled: number;
  /** Tints the dots to signal a rejected entry. */
  invalid?: boolean;
  /** What is being entered, e.g. "Master PIN". Read before the count. */
  label: string;
}

const DOT_SIZE = 14;

/**
 * The six-dot entry indicator.
 *
 * Exposed to a screen reader as one element reading "Master PIN, 4 of 6 digits
 * entered" rather than as six anonymous views. The count is safe to announce:
 * it is visible to anyone in the room anyway, and without it a non-sighted user
 * gets no confirmation that a key registered at all.
 */
export function PinDots({ filled, invalid = false, label }: PinDotsProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const fillColour = invalid ? theme.colors.error : theme.colors.secondary;

  return (
    <View
      accessibilityLabel={t('lock.pinProgress', { label, filled, total: PIN_LENGTH })}
      accessible
      style={[styles.container, { gap: theme.spacing.md }]}
      testID="pin-dots"
    >
      {Array.from({ length: PIN_LENGTH }, (_unused, index) => (
        <View
          key={index}
          style={{
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: theme.radius.full,
            backgroundColor: index < filled ? fillColour : theme.colors.surfaceContainerHighest,
          }}
          testID={index < filled ? 'pin-dot-filled' : 'pin-dot-empty'}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
});
