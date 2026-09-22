import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Icon, Text } from '@/components';
import { compareDates, ESCALATION_THRESHOLD_DAYS, fireDateFor } from '@/features/expiry';
import { minTouchTarget, useTheme } from '@/theme';

import { presetFor } from '../categoryPresets';
import type { AddItemFormValues } from '../schema';
import { useTranslation } from 'react-i18next';

/**
 * The reminder step.
 *
 * Every fire date here is computed from the chosen expiry. The export hardcodes
 * all four as text and recomputes nothing when the date changes.
 */

/** Human labels for the offsets the presets use. */
function offsetLabel(days: number): string {
  if (days === 0) {
    return 'On the day';
  }

  if (days % 30 === 0 && days >= 30) {
    const months = days / 30;

    return months === 1 ? '1 month before' : `${months} months before`;
  }

  return days === 1 ? '1 day before' : `${days} days before`;
}

export interface RemindersStepProps {
  category: AddItemFormValues['category'] | undefined;
  expiryDate: string | undefined;
  today: string;
  selected: readonly number[];
  onToggle: (offset: number) => void;
  escalationEnabled: boolean;
  onEscalationChange: (value: boolean) => void;
}

export function RemindersStep({
  category,
  expiryDate,
  today,
  selected,
  onToggle,
  escalationEnabled,
  onEscalationChange,
}: RemindersStepProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const offsets = category === undefined ? [] : presetFor(category).offsets;

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text accessibilityRole="header" variant="titleLg">
          {t('addItem.remindersTitle')}
        </Text>
        <Text color="onSurfaceVariant" variant="bodyMd">
          {t('addItem.remindersNote')}
        </Text>
      </View>

      {offsets.map((offset) => {
        const checked = selected.includes(offset);
        const fireDate = expiryDate === undefined ? null : fireDateFor(expiryDate, offset);
        const inThePast = fireDate !== null && compareDates(fireDate, today) < 0;

        return (
          <Pressable
            accessibilityLabel={offsetLabel(offset)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled: inThePast }}
            disabled={inThePast}
            key={offset}
            onPress={() => {
              onToggle(offset);
            }}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: theme.colors.surfaceContainerLowest,
                borderColor:
                  checked && !inThePast ? theme.colors.primary : theme.colors.outlineVariant,
                borderRadius: theme.radius.md,
                borderWidth: checked && !inThePast ? 2 : StyleSheet.hairlineWidth,
                gap: theme.spacing.sm,
                minHeight: minTouchTarget,
                opacity: inThePast ? theme.interaction.disabledOpacity : 1,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
              },
              pressed ? { opacity: theme.interaction.pressedOpacity } : null,
            ]}
            testID={`reminder-${offset}`}
          >
            <Icon
              color={checked && !inThePast ? 'primary' : 'outline'}
              name={checked && !inThePast ? 'safe' : 'reminder'}
              size={20}
            />
            <View style={styles.rowText}>
              <Text variant="labelLg">{offsetLabel(offset)}</Text>
              <Text color="onSurfaceVariant" variant="bodySm">
                {fireDate === null
                  ? 'Choose an expiry date first'
                  : inThePast
                    ? `Would have fired ${fireDate}`
                    : `Fires on ${fireDate}`}
              </Text>
            </View>
          </Pressable>
        );
      })}

      <View
        style={[
          styles.row,
          {
            backgroundColor: theme.colors.surfaceContainerLowest,
            borderColor: theme.colors.outlineVariant,
            borderRadius: theme.radius.md,
            borderWidth: StyleSheet.hairlineWidth,
            gap: theme.spacing.sm,
            minHeight: minTouchTarget,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          },
        ]}
      >
        <View style={styles.rowText}>
          <Text variant="labelLg">{t('addItem.escalationLabel')}</Text>
          <Text color="onSurfaceVariant" variant="bodySm">
            {t('addItem.escalationBody', { count: ESCALATION_THRESHOLD_DAYS })}
          </Text>
        </View>
        <Switch
          accessibilityLabel="{t('addItem.escalationLabel')}"
          onValueChange={onEscalationChange}
          testID="escalation-switch"
          thumbColor={theme.colors.surfaceContainerLowest}
          trackColor={{ false: theme.colors.outlineVariant, true: theme.colors.primary }}
          value={escalationEnabled}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row' },
  rowText: { flex: 1 },
});
