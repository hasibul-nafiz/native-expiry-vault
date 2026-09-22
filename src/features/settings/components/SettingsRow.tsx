import { StyleSheet, Switch, View } from 'react-native';

import { Card, Icon, Text, type IconName } from '@/components';
import { minTouchTarget, useStackedLayout, useTheme } from '@/theme';

/**
 * One settings row: glyph, title, optional subtitle, and either a trailing
 * value with a chevron or a switch.
 *
 * The export draws a tinted circle behind each glyph in a different hue per
 * row; those hues are raw Tailwind utilities with no token source, so every row
 * uses the same `primary` on `surfaceContainer` pair instead.
 */

export interface SettingsRowProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  /** Trailing text, for a row that opens a picker. */
  value?: string;
  onPress?: () => void;
  /** Supplying this makes the row a switch rather than a link. */
  toggle?: { value: boolean; onValueChange: (next: boolean) => void };
  disabled?: boolean;
  testID?: string;
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  toggle,
  disabled = false,
  testID,
}: SettingsRowProps) {
  const theme = useTheme();
  const stacked = useStackedLayout();

  const body = (
    <View
      style={[
        stacked ? styles.stack : styles.row,
        { gap: theme.spacing.sm, minHeight: minTouchTarget },
      ]}
    >
      <View
        style={[
          styles.glyph,
          { backgroundColor: theme.colors.surfaceContainer, borderRadius: theme.radius.md },
        ]}
      >
        <Icon color="primary" name={icon} size={20} />
      </View>
      <View style={stacked ? styles.growStacked : styles.grow}>
        <Text variant="titleMd">{title}</Text>
        {subtitle === undefined ? null : (
          <Text color="onSurfaceVariant" variant="bodySm">
            {subtitle}
          </Text>
        )}
      </View>
      {value === undefined ? null : (
        <Text color="onSurfaceVariant" variant="labelLg">
          {value}
        </Text>
      )}
      {toggle === undefined ? null : (
        <Switch
          accessibilityLabel={title}
          disabled={disabled}
          onValueChange={toggle.onValueChange}
          testID={`${testID ?? title}-switch`}
          trackColor={{ true: theme.colors.primary, false: theme.colors.outlineVariant }}
          value={toggle.value}
        />
      )}
      {onPress === undefined ? null : (
        <Icon color="onSurfaceVariant" name="chevronRight" size={20} />
      )}
    </View>
  );

  if (onPress === undefined) {
    return <Card testID={testID}>{body}</Card>;
  }

  return (
    <Card
      accessibilityLabel={subtitle === undefined ? title : `${title}, ${subtitle}`}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
    >
      {body}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row' },
  stack: { alignItems: 'flex-start', flexDirection: 'column' },
  glyph: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  grow: { flex: 1 },
  growStacked: { alignSelf: 'stretch' },
});
