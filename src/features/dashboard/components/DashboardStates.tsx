import { StyleSheet, View } from 'react-native';

import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

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
      accessibilityLabel={t('dashboard.loadingAccessibility')}
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
  const { t } = useTranslation();

  return (
    <View
      style={[styles.centred, { gap: theme.spacing.md, paddingVertical: theme.spacing.xl }]}
      testID="dashboard-error"
    >
      <Icon color="error" name="error" size={40} />
      <Text variant="titleLg">{t('dashboard.errorTitle')}</Text>
      {/*
        The underlying error is deliberately not shown: a DatabaseError carries
        the failing SQL, which is not something to put in front of a user.
      */}
      <Text color="onSurfaceVariant" style={styles.centredText} variant="bodyMd">
        {t('dashboard.errorBody')}
      </Text>
      <Button label={t('common.tryAgain')} onPress={onRetry} testID="dashboard-retry" />
    </View>
  );
}

export interface DashboardEmptyProps {
  onAdd: () => void;
}

/** A genuinely empty vault, as on first launch. */
export function DashboardEmpty({ onAdd }: DashboardEmptyProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={[styles.centred, { gap: theme.spacing.md, paddingVertical: theme.spacing.xl }]}
      testID="dashboard-empty"
    >
      <Icon color="onSurfaceVariant" name="empty" size={40} />
      <Text variant="titleLg">{t('dashboard.emptyTitle')}</Text>
      <Text color="onSurfaceVariant" style={styles.centredText} variant="bodyMd">
        {t('dashboard.emptyBody')}
      </Text>
      <Button label={t('dashboard.addDocument')} onPress={onAdd} testID="empty-add-button" />
    </View>
  );
}

export interface NoMatchesProps {
  onClear: () => void;
}

/** Documents exist, but the current filter or search matches none of them. */
export function DashboardNoMatches({ onClear }: NoMatchesProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={[styles.centred, { gap: theme.spacing.md, paddingVertical: theme.spacing.xl }]}
      testID="dashboard-no-matches"
    >
      <Icon color="onSurfaceVariant" name="search" size={40} />
      <Text variant="titleLg">{t('dashboard.noMatchesTitle')}</Text>
      <Text color="onSurfaceVariant" style={styles.centredText} variant="bodyMd">
        {t('dashboard.noMatchesBody')}
      </Text>
      <Button
        label={t('dashboard.clearFilters')}
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
