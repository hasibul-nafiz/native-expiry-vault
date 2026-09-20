import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components';
import type { DocumentCategory, IsoDate, RenewalTask } from '@/db/models';
import { addDays, compareDates } from '@/features/expiry';
import { minTouchTarget, useTheme } from '@/theme';

import { checklistFor, type ChecklistStep } from '../checklistTemplates';

/**
 * The renewal checklist.
 *
 * Steps come from the static per-category template; the tick state lives in the
 * `renewal_tasks` table. A row is written the first time a step is ticked, so
 * items nobody touches stay clean.
 *
 * The export's counter ("2 of 4 Ready") is a hardcoded string that never moves
 * when its checkboxes are toggled; this one is derived.
 */

export interface ChecklistSectionProps {
  category: DocumentCategory;
  expiryDate: IsoDate;
  today: IsoDate;
  tasks: readonly RenewalTask[];
  onToggle: (step: ChecklistStep, done: boolean) => void;
}

function dueDateFor(step: ChecklistStep, expiryDate: IsoDate): IsoDate | null {
  return step.dueOffsetDays === null ? null : addDays(expiryDate, -step.dueOffsetDays);
}

export function ChecklistSection({
  category,
  expiryDate,
  today,
  tasks,
  onToggle,
}: ChecklistSectionProps) {
  const theme = useTheme();
  const steps = checklistFor(category);

  const doneTitles = new Set(tasks.filter((task) => task.done).map((task) => task.title));
  const doneCount = steps.filter((step) => doneTitles.has(step.title)).length;

  return (
    <View style={{ gap: theme.spacing.sm }} testID="checklist-section">
      <View style={styles.header}>
        <Text accessibilityRole="header" variant="titleLg">
          Renewal roadmap
        </Text>
        <Text color="onSurfaceVariant" testID="checklist-counter" variant="labelSm">
          {`${doneCount} of ${steps.length} ready`}
        </Text>
      </View>

      {steps.map((step) => {
        const done = doneTitles.has(step.title);
        const dueDate = dueDateFor(step, expiryDate);
        const overdue = !done && dueDate !== null && compareDates(dueDate, today) < 0;

        return (
          <Pressable
            accessibilityLabel={step.title}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            key={step.title}
            onPress={() => {
              onToggle(step, !done);
            }}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: theme.colors.surfaceContainerLowest,
                borderColor: overdue
                  ? theme.status.expired.foreground
                  : theme.colors.outlineVariant,
                borderRadius: theme.radius.md,
                borderWidth: overdue ? 2 : StyleSheet.hairlineWidth,
                gap: theme.spacing.sm,
                minHeight: minTouchTarget,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
              },
              pressed ? { opacity: theme.interaction.pressedOpacity } : null,
            ]}
            testID={`checklist-step-${step.title}`}
          >
            <Icon
              color={done ? 'primary' : 'outline'}
              name={done ? 'safe' : 'document'}
              size={20}
            />

            <View style={styles.text}>
              <Text
                color={done ? 'onSurfaceVariant' : 'onSurface'}
                style={done ? styles.doneTitle : undefined}
                variant="labelMd"
              >
                {step.title}
              </Text>
              <Text color="onSurfaceVariant" variant="bodySm">
                {step.detail}
              </Text>
              {dueDate === null || done ? null : (
                <Text
                  style={{
                    color: overdue
                      ? theme.status.expired.foreground
                      : theme.colors.onSurfaceVariant,
                  }}
                  variant="bodySm"
                >
                  {overdue ? `Was due ${dueDate}` : `Due by ${dueDate}`}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  doneTitle: { textDecorationLine: 'line-through' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  row: { alignItems: 'center', flexDirection: 'row' },
  text: { flex: 1 },
});
