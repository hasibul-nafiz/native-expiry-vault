import { StyleSheet, View } from 'react-native';

import { useTranslation } from 'react-i18next';

import { Button, Icon, Text } from '@/components';
import { useTheme } from '@/theme';

/**
 * Loading, error and the two empty states. The export defines none of them — it
 * is static markup with a hardcoded feed — so all four are designed here from
 * the kit's tokens, as F4 did for the dashboard.
 */

export function TimelineLoading() {
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
      accessibilityLabel={t('timeline.loading')}
      accessibilityRole="progressbar"
      style={{ gap: theme.spacing.md }}
      testID="timeline-loading"
    >
      {block(40, '55%')}
      {block(84)}
      {block(84)}
      {block(40, '45%')}
      {block(84)}
    </View>
  );
}

export interface TimelineErrorProps {
  onRetry: () => void;
}

export function TimelineError({ onRetry }: TimelineErrorProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={[styles.centred, { gap: theme.spacing.md, paddingVertical: theme.spacing.xl }]}
      testID="timeline-error"
    >
      <Icon color="error" name="error" size={40} />
      <Text variant="titleLg">{t('timeline.errorTitle')}</Text>
      <Text color="onSurfaceVariant" style={styles.centredText} variant="bodyMd">
        {t('timeline.errorBody')}
      </Text>
      <Button label={t('common.tryAgain')} onPress={onRetry} testID="timeline-retry" />
    </View>
  );
}

export interface TimelineEmptyProps {
  onAdd: () => void;
}

export function TimelineEmpty({ onAdd }: TimelineEmptyProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={[styles.centred, { gap: theme.spacing.md, paddingVertical: theme.spacing.xl }]}
      testID="timeline-empty"
    >
      <Icon color="onSurfaceVariant" name="reminder" size={40} />
      <Text variant="titleLg">{t('timeline.emptyTitle')}</Text>
      <Text color="onSurfaceVariant" style={styles.centredText} variant="bodyMd">
        {t('timeline.emptyBody')}
      </Text>
      <Button label={t('timeline.emptyAction')} onPress={onAdd} testID="timeline-empty-add" />
    </View>
  );
}

export interface TimelineNoMatchesProps {
  onClear: () => void;
}

export function TimelineNoMatches({ onClear }: TimelineNoMatchesProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={[styles.centred, { gap: theme.spacing.md, paddingVertical: theme.spacing.xl }]}
      testID="timeline-no-matches"
    >
      <Icon color="onSurfaceVariant" name="empty" size={40} />
      <Text variant="titleLg">{t('timeline.noMatchesTitle')}</Text>
      <Text color="onSurfaceVariant" style={styles.centredText} variant="bodyMd">
        {t('timeline.noMatchesBody')}
      </Text>
      <Button
        label={t('timeline.clearFilter')}
        onPress={onClear}
        testID="timeline-clear-filter"
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centred: { alignItems: 'center' },
  centredText: { textAlign: 'center' },
});
