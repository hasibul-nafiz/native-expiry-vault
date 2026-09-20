import { StyleSheet, View } from 'react-native';

import { Button, Icon, Text } from '@/components';
import { useTheme } from '@/theme';

/**
 * Loading, error and the two empty states.
 *
 * None of these exist anywhere in the Stitch export — it is entirely static
 * markup with no skeleton, no empty copy and no error path — so they are
 * designed here from the kit's tokens and logged as a design gap.
 */

/** Skeleton blocks laid out in roughly the shape of the loaded screen. */
export function DashboardLoading() {
  const theme = useTheme();

  const block = (height: number, width: string | number = '100%') => (
    <View
      style={{
        backgroundColor: theme.colors.surfaceContainerHigh,
        borderRadius: theme.radius.md,
        height,
        width: width as number,
      }}
    />
  );

  return (
    <View
      accessibilityLabel="Loading your vault"
      accessibilityRole="progressbar"
      style={{ gap: theme.spacing.md }}
      testID="dashboard-loading"
    >
      {block(120)}
      {block(48)}
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        {block(88, '32%')}
        {block(88, '32%')}
        {block(88, '32%')}
      </View>
      {block(72)}
      {block(72)}
    </View>
  );
}

export interface DashboardErrorProps {
  onRetry: () => void;
}

export function DashboardError({ onRetry }: DashboardErrorProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.centred, { gap: theme.spacing.md, paddingVertical: theme.spacing.xl }]}
      testID="dashboard-error"
    >
      <Icon color="error" name="error" size={40} />
      <Text variant="titleLg">Could not open your vault</Text>
      {/*
        The underlying error is deliberately not shown: a DatabaseError carries
        the failing SQL, which is not something to put in front of a user.
      */}
      <Text color="onSurfaceVariant" style={styles.centredText} variant="bodyMd">
        Something went wrong reading your documents. Your data has not been changed.
      </Text>
      <Button label="Try again" onPress={onRetry} testID="dashboard-retry" />
    </View>
  );
}

export interface DashboardEmptyProps {
  onAdd: () => void;
}

/** A genuinely empty vault, as on first launch. */
export function DashboardEmpty({ onAdd }: DashboardEmptyProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.centred, { gap: theme.spacing.md, paddingVertical: theme.spacing.xl }]}
      testID="dashboard-empty"
    >
      <Icon color="onSurfaceVariant" name="empty" size={40} />
      <Text variant="titleLg">No documents yet</Text>
      <Text color="onSurfaceVariant" style={styles.centredText} variant="bodyMd">
        Add a passport, visa, insurance policy or warranty and ExpiryVault will remind you before it
        expires.
      </Text>
      <Button label="Add document" onPress={onAdd} testID="empty-add-button" />
    </View>
  );
}

export interface NoMatchesProps {
  onClear: () => void;
}

/** Documents exist, but the current filter or search matches none of them. */
export function DashboardNoMatches({ onClear }: NoMatchesProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.centred, { gap: theme.spacing.md, paddingVertical: theme.spacing.xl }]}
      testID="dashboard-no-matches"
    >
      <Icon color="onSurfaceVariant" name="search" size={40} />
      <Text variant="titleLg">No matches</Text>
      <Text color="onSurfaceVariant" style={styles.centredText} variant="bodyMd">
        No documents match the current filters.
      </Text>
      <Button
        label="Clear filters"
        onPress={onClear}
        testID="clear-filters-button"
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centred: { alignItems: 'center' },
  centredText: { textAlign: 'center' },
  row: { flexDirection: 'row' },
});
