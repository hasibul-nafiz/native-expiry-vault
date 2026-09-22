import { StyleSheet, View } from 'react-native';

import { BottomSheet, Icon, Text } from '@/components';
import { minTouchTarget, useTheme } from '@/theme';
import { Pressable } from 'react-native';

/**
 * A single-choice picker for a settings row.
 *
 * The export shows each of these as a chevron leading somewhere undrawn, so the
 * picker itself is designed here. A sheet rather than a pushed screen: every
 * one of these lists is short enough to fit, and a whole route for four radio
 * options is more navigation than the choice deserves.
 */

export interface OptionSheetItem<T extends string | number> {
  value: T;
  label: string;
}

export interface OptionSheetProps<T extends string | number> {
  visible: boolean;
  title: string;
  items: readonly OptionSheetItem<T>[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
  testID?: string;
}

export function OptionSheet<T extends string | number>({
  visible,
  title,
  items,
  selected,
  onSelect,
  onClose,
  testID,
}: OptionSheetProps<T>) {
  const theme = useTheme();

  return (
    <BottomSheet onClose={onClose} title={title} visible={visible}>
      <View testID={testID}>
        {items.map((item) => {
          const isSelected = item.value === selected;

          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              android_ripple={{ color: theme.colors.surfaceContainerHighest }}
              key={String(item.value)}
              onPress={() => {
                onSelect(item.value);
                onClose();
              }}
              style={({ pressed }) => [
                styles.row,
                {
                  gap: theme.spacing.sm,
                  minHeight: minTouchTarget,
                  opacity: pressed ? theme.interaction.pressedOpacity : 1,
                  paddingVertical: theme.spacing.sm,
                },
              ]}
              testID={`${testID ?? 'option'}-${item.value}`}
            >
              <Text style={styles.grow} variant="bodyLg">
                {item.label}
              </Text>
              {isSelected ? <Icon color="primary" name="safe" size={22} /> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row' },
  grow: { flex: 1 },
});
