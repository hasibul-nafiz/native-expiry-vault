import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text, type IconName } from '@/components';
import { minTouchTarget, useTheme } from '@/theme';

/**
 * The PIN keypad.
 *
 * The export prints dialler letters under each digit (ABC, DEF, …) and a "+"
 * under the zero. Those are telephone affordances; nothing here dials, and a
 * PIN cannot be spelled. They are not ported — see docs/PROGRESS.md.
 *
 * Keys are 56pt tall, which clears both the 44pt iOS and 48dp Android minimums
 * without needing the floor, but it is applied anyway so a future size change
 * cannot quietly drop below them.
 */

const KEY_HEIGHT = 56;

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

const DIGIT_NAMES: Record<string, string> = {
  '0': 'Zero',
  '1': 'One',
  '2': 'Two',
  '3': 'Three',
  '4': 'Four',
  '5': 'Five',
  '6': 'Six',
  '7': 'Seven',
  '8': 'Eight',
  '9': 'Nine',
};

export interface KeypadAction {
  icon: IconName;
  label: string;
  onPress: () => void;
}

export interface KeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  /** Bottom-left key. Omitted leaves the slot empty, as the grid needs it filled. */
  action?: KeypadAction;
  disabled?: boolean;
}

export function Keypad({ onDigit, onBackspace, action, disabled = false }: KeypadProps) {
  const theme = useTheme();

  const keyStyle = (pressed: boolean, tinted: boolean) => [
    styles.key,
    {
      backgroundColor: tinted
        ? theme.colors.surfaceContainerLow
        : theme.colors.surfaceContainerLowest,
      borderRadius: theme.radius.md,
      minHeight: Math.max(KEY_HEIGHT, minTouchTarget),
    },
    pressed && !disabled
      ? { backgroundColor: theme.colors.surfaceContainer, opacity: theme.interaction.pressedOpacity }
      : null,
    disabled ? { opacity: theme.interaction.disabledOpacity } : null,
  ];

  return (
    <View style={[styles.grid, { gap: theme.spacing.md }]} testID="keypad">
      {DIGITS.map((digit) => (
        <Pressable
          accessibilityLabel={DIGIT_NAMES[digit]}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          android_ripple={disabled ? undefined : { color: theme.colors.surfaceContainerHighest }}
          disabled={disabled}
          key={digit}
          onPress={() => {
            onDigit(digit);
          }}
          style={({ pressed }) => keyStyle(pressed, false)}
          testID={`keypad-${digit}`}
        >
          <Text maxFontSizeMultiplier={1.4} variant="headlineMd">
            {digit}
          </Text>
        </Pressable>
      ))}

      {action ? (
        <Pressable
          accessibilityLabel={action.label}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          android_ripple={disabled ? undefined : { color: theme.colors.surfaceContainerHighest }}
          disabled={disabled}
          onPress={action.onPress}
          style={({ pressed }) => keyStyle(pressed, true)}
          testID="keypad-action"
        >
          <Icon color="primary" name={action.icon} size={26} />
        </Pressable>
      ) : (
        <View style={styles.key} />
      )}

      <Pressable
        accessibilityLabel={DIGIT_NAMES['0']}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        android_ripple={disabled ? undefined : { color: theme.colors.surfaceContainerHighest }}
        disabled={disabled}
        onPress={() => {
          onDigit('0');
        }}
        style={({ pressed }) => keyStyle(pressed, false)}
        testID="keypad-0"
      >
        <Text maxFontSizeMultiplier={1.4} variant="headlineMd">
          0
        </Text>
      </Pressable>

      <Pressable
        accessibilityLabel="Delete last digit"
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        android_ripple={disabled ? undefined : { color: theme.colors.surfaceContainerHighest }}
        disabled={disabled}
        onPress={onBackspace}
        style={({ pressed }) => keyStyle(pressed, true)}
        testID="keypad-backspace"
      >
        <Icon color="onSurfaceVariant" name="backspace" size={24} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  // Three columns with two 16pt gaps between them.
  key: { alignItems: 'center', flexBasis: '30%', justifyContent: 'center' },
});
