import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components';
import { useTheme } from '@/theme';

import { stepNames, stepNumbers, type StepNumber } from '../schema';
import { useTranslation } from 'react-i18next';

/**
 * "Step N of 4" with the cumulative bars and the jump pills.
 *
 * Unlike the export, where `goToStep()` lets you jump anywhere at any time, a
 * pill is only tappable for a step already reached — otherwise the user could
 * skip straight to Save past every validation gate.
 */

export interface StepProgressProps {
  current: StepNumber;
  furthestReached: StepNumber;
  onJump: (step: StepNumber) => void;
}

export function StepProgress({ current, furthestReached, onJump }: StepProgressProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View
      accessibilityLabel={t('addItem.stepProgress', { current, total: 4, name: stepNames[current] })}
      accessibilityRole="progressbar"
      accessibilityValue={{ max: 4, min: 1, now: current }}
      style={{ gap: theme.spacing.sm }}
      testID="step-progress"
    >
      <Text color="onSurfaceVariant" variant="labelSm">
        {t('addItem.stepProgress', { current, total: 4, name: stepNames[current] })}
      </Text>

      <View style={[styles.bars, { gap: theme.spacing.xs }]}>
        {stepNumbers.map((step) => (
          <View
            key={step}
            style={[
              styles.bar,
              {
                backgroundColor:
                  step <= current ? theme.colors.primary : theme.colors.surfaceContainerHighest,
                borderRadius: theme.radius.full,
              },
            ]}
          />
        ))}
      </View>

      <View style={[styles.pills, { gap: theme.spacing.md }]}>
        {stepNumbers.map((step) => {
          const reachable = step <= furthestReached;

          return (
            <Pressable
              accessibilityLabel={`Go to step ${step}, ${stepNames[step]}`}
              accessibilityRole="tab"
              accessibilityState={{ disabled: !reachable, selected: step === current }}
              disabled={!reachable}
              key={step}
              onPress={() => {
                onJump(step);
              }}
              testID={`step-pill-${step}`}
            >
              <Text
                color={
                  step === current ? 'primary' : reachable ? 'onSurfaceVariant' : 'outlineVariant'
                }
                variant="labelSm"
              >
                {stepNames[step]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flex: 1, height: 6 },
  bars: { flexDirection: 'row' },
  pills: { flexDirection: 'row', flexWrap: 'wrap' },
});
