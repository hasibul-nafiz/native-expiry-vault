import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components';
import type { IsoDate } from '@/db/models';
import { fromIsoDateLocal, toIsoDateLocal, todayLocal } from '@/features/expiry';
import { minTouchTarget, useTheme } from '@/theme';
import { useTranslation } from 'react-i18next';

/**
 * A calendar-date field backed by the platform's own picker — a SwiftUI
 * `DatePicker` on iOS and a Material dialog on Android.
 *
 * This is the dedicated component CLAUDE.md's `Platform.select` rule exists for:
 * the two platforms present pickers differently and that difference is confined
 * here. iOS renders inline (the native view ignores `presentation`), Android
 * opens a dialog on mount and expects to be unmounted when it closes.
 *
 * The value is an `IsoDate` throughout; conversion to and from `Date` happens
 * only at this boundary, via the local-calendar helpers, so a user east or west
 * of UTC cannot end up with the neighbouring day.
 */

export interface DateFieldProps {
  label: string;
  value: IsoDate | undefined;
  onChange: (value: IsoDate) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  testID?: string;
}

export function DateField({
  label,
  value,
  onChange,
  error,
  helperText,
  required = false,
  testID,
}: DateFieldProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const invalid = error !== undefined;
  const caption = error ?? helperText;

  const pickerValue = fromIsoDateLocal(value ?? todayLocal());

  const handleChange = (_event: unknown, date: Date) => {
    onChange(toIsoDateLocal(date));

    if (Platform.OS === 'android') {
      setOpen(false);
    }
  };

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text color="onSurfaceVariant" variant="labelMd">
        {required ? `${label} *` : label}
      </Text>

      <Pressable
        accessibilityHint={t('addItem.datePickerHint')}
        accessibilityLabel={
          value === undefined
            ? t('addItem.dateNotChosen', { label })
            : t('addItem.dateChosen', { label, value })
        }
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setOpen((previous) => !previous);
        }}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: theme.colors.surfaceContainerLowest,
            borderColor: invalid ? theme.colors.error : theme.colors.outline,
            borderRadius: theme.radius.lg,
            borderWidth: invalid ? 2 : 1,
            gap: theme.spacing.sm,
            minHeight: minTouchTarget,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          },
          pressed ? { opacity: theme.interaction.pressedOpacity } : null,
        ]}
        testID={testID}
      >
        <Icon color="onSurfaceVariant" name="reminder" size={18} />
        <Text color={value === undefined ? 'onSurfaceVariant' : 'onSurface'} style={styles.value}>
          {value ?? 'Choose a date'}
        </Text>
        <Text color="primary" variant="labelMd">
          {t('addItem.change')}
        </Text>
      </Pressable>

      {open ? (
        <DateTimePicker
          accentColor={theme.colors.primary}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          mode="date"
          onDismiss={() => {
            setOpen(false);
          }}
          onValueChange={handleChange}
          presentation={Platform.OS === 'ios' ? 'inline' : 'dialog'}
          testID={testID === undefined ? undefined : `${testID}-picker`}
          value={pickerValue}
        />
      ) : null}

      {caption === undefined ? null : (
        <Text color={invalid ? 'error' : 'onSurfaceVariant'} variant="bodySm">
          {caption}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { alignItems: 'center', flexDirection: 'row' },
  value: { flex: 1 },
});
