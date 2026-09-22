import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import type { DocumentStatus } from '@/theme';

import { Text } from './Text';

export interface StatusBadgeProps {
  status: DocumentStatus;
  /** Always rendered: status must never be conveyed by colour alone. */
  label: string;
  testID?: string;
}

export function StatusBadge({ status, label, testID }: StatusBadgeProps) {
  const theme = useTheme();
  const { foreground, container } = theme.status[status];

  return (
    <View
      accessibilityRole="text"
      style={[
        styles.base,
        {
          backgroundColor: container,
          borderRadius: theme.radius.full,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
        },
      ]}
      testID={testID}
    >
      <Text maxFontSizeMultiplier={1.4} style={{ color: foreground }} variant="labelSm">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start' },
});
