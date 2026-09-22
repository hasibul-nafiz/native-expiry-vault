import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip, Icon, Screen, Text } from '@/components';
import { useDatabaseState } from '@/db/DatabaseProvider';
import { useTheme } from '@/theme';

import { MonthHeader } from './components/MonthHeader';
import { TimelineEntryCard } from './components/TimelineEntryCard';
import {
  TimelineEmpty,
  TimelineError,
  TimelineLoading,
  TimelineNoMatches,
} from './components/TimelineStates';
import { filterByRange, timelineRanges, type TimelineRange } from './filters';
import { groupByMonth } from './groupByMonth';
import { rangeLabel, urgentSummary } from './labels';
import { useTimelineData } from './useTimelineData';

/**
 * The expiry timeline: every active document grouped into the month it expires
 * in, oldest first, with a continuous rail running down the left.
 */
export function TimelineScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const databaseState = useDatabaseState();
  const [range, setRange] = useState<TimelineRange>('all');

  const db = databaseState.status === 'ready' ? databaseState.db : null;
  const { status, data, reload } = useTimelineData(db);

  // Re-reads on every return to the tab, so an add, edit or delete elsewhere
  // shows up here with no store and no invalidation logic.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const groups = useMemo(() => {
    if (data === null) {
      return [];
    }

    return groupByMonth(filterByRange(data.items, data.today, range), data.today);
  }, [data, range]);

  const openItem = useCallback(
    (id: string) => {
      router.push(`/item/${id}`);
    },
    [router],
  );

  const addItem = useCallback(() => {
    router.push('/add');
  }, [router]);

  const clearFilter = useCallback(() => {
    setRange('all');
  }, []);

  // A database that never opened leaves `db` null forever, so this is handled
  // here rather than waiting on a load that can never start. The header stays
  // up in every state, as it does on the dashboard.
  const databaseFailed = databaseState.status === 'error';

  return (
    <Screen scroll testID="timeline-screen">
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text color="primary" variant="labelSm">
            {t('timeline.eyebrow').toUpperCase()}
          </Text>
          <Text variant="headlineMd">{t('timeline.title')}</Text>
          <Text color="onSurfaceVariant" variant="bodyMd">
            {t('timeline.subtitle')}
          </Text>
        </View>

        {databaseFailed ? (
          <TimelineError
            onRetry={databaseState.status === 'error' ? databaseState.retry : reload}
          />
        ) : null}

        {!databaseFailed && status === 'ready' && data.counts.all > 0 ? (
          <ScrollView
            contentContainerStyle={{ gap: theme.spacing.xs }}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {timelineRanges.map((option) => (
              <Chip
                count={data.counts[option]}
                key={option}
                label={rangeLabel(option, Number(data.today.slice(0, 4)), t)}
                onPress={() => setRange(option)}
                selected={range === option}
                testID={`timeline-chip-${option}`}
              />
            ))}
          </ScrollView>
        ) : null}

        {!databaseFailed && status === 'ready' && data.expiredCount > 0 ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.banner,
              {
                backgroundColor: theme.status.expired.container,
                borderRadius: theme.radius.lg,
                gap: theme.spacing.sm,
                padding: theme.spacing.md,
              },
            ]}
            testID="timeline-urgent-banner"
          >
            <Icon name="expired" size={22} tone={theme.status.expired.foreground} />
            <View style={styles.bannerBody}>
              <Text style={{ color: theme.status.expired.foreground }} variant="titleMd">
                {t('timeline.urgentTitle')}
              </Text>
              <Text color="onSurfaceVariant" variant="bodySm">
                {urgentSummary(data.expiredCount, t)}
              </Text>
            </View>
          </View>
        ) : null}

        {!databaseFailed && status === 'loading' ? <TimelineLoading /> : null}
        {!databaseFailed && status === 'error' ? <TimelineError onRetry={reload} /> : null}

        {status === 'ready' && data.counts.all === 0 ? <TimelineEmpty onAdd={addItem} /> : null}
        {status === 'ready' && data.counts.all > 0 && groups.length === 0 ? (
          <TimelineNoMatches onClear={clearFilter} />
        ) : null}

        {status === 'ready' && groups.length > 0 ? (
          <View style={styles.feed} testID="timeline-feed">
            {/*
              The rail is a single line behind the whole feed rather than a
              border on each node, so it stays continuous across the gaps.
            */}
            <View
              style={[styles.rail, { backgroundColor: theme.colors.surfaceContainerHighest }]}
            />
            <View style={{ gap: theme.spacing.lg }}>
              {groups.map((group) => (
                <View key={group.key} style={{ gap: theme.spacing.sm }}>
                  <MonthHeader
                    band={group.band}
                    month={group.month}
                    testID={`timeline-month-${group.key}`}
                    year={group.year}
                  />
                  <View style={[styles.entries, { gap: theme.spacing.sm }]}>
                    {group.items.map((item) => (
                      <TimelineEntryCard
                        item={item}
                        key={item.id}
                        onPress={openItem}
                        testID={`timeline-item-${item.id}`}
                        today={data.today}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { alignItems: 'center', flexDirection: 'row' },
  bannerBody: { flex: 1 },
  feed: { position: 'relative' },
  rail: { bottom: 16, left: 17, position: 'absolute', top: 16, width: 2 },
  entries: { paddingLeft: 44 },
});
