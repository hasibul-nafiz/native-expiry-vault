import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  ScrollView,
  SectionList,
  StyleSheet,
  View,
  type SectionListRenderItemInfo,
  type ViewStyle,
} from 'react-native';

import { Chip, Icon, Screen, Text } from '@/components';
import { useDatabaseState } from '@/db/DatabaseProvider';
import type { Item } from '@/db/models';
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
import { groupByMonth, toSections, type MonthSection } from './groupByMonth';
import { rangeLabel, urgentSummary } from './labels';
import { useTimelineData } from './useTimelineData';

/**
 * The rail's geometry, unchanged from the single-view version it replaces.
 *
 * `MonthHeader` draws a 36pt node, so a 2pt stripe at x=17 runs through its
 * centre; the cards clear it by 44.
 */
const RAIL_LEFT = 17;
const RAIL_WIDTH = 2;
const RAIL_INSET = 16;
const ENTRY_INDENT = 44;

function keyExtractor(item: Item): string {
  return item.id;
}

interface RailCellProps {
  children: ReactNode;
  /** Starts the stripe below the cell's top edge. The first cell only. */
  capTop?: boolean;
  /** Ends the stripe above the cell's bottom edge. The last cell only. */
  capBottom?: boolean;
  style?: ViewStyle;
}

/**
 * One cell of the feed, painting its own segment of the rail.
 *
 * The rail used to be a single absolutely-positioned line behind the whole
 * feed. A virtualized list has cells and no wrapper to hang that on, so each
 * cell paints the same stripe at the same offset instead; the segments abut and
 * read as one line.
 *
 * That only holds while the cells themselves abut. Every gap between the
 * months, the headers and the cards is therefore padding *inside* a cell rather
 * than `gap` on a parent — space between cells is space nothing paints, which
 * is exactly where the rail would break.
 */
function RailCell({ children, capTop = false, capBottom = false, style }: RailCellProps) {
  const theme = useTheme();

  return (
    <View style={style}>
      <View
        style={[
          styles.railStripe,
          {
            backgroundColor: theme.colors.surfaceContainerHighest,
            top: capTop ? RAIL_INSET : 0,
            bottom: capBottom ? RAIL_INSET : 0,
          },
        ]}
        testID="timeline-rail"
      />
      {children}
    </View>
  );
}

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

  const sections = useMemo(() => toSections(groups), [groups]);

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

  const today = data?.today ?? null;
  const lastSectionKey = sections.at(-1)?.key ?? null;

  const renderSectionHeader = useCallback(
    ({ section }: { section: MonthSection }) => (
      <RailCell
        // The rail starts inside the first cell rather than at its very top.
        capTop={section.key === sections[0]?.key}
        style={{
          paddingBottom: theme.spacing.sm,
          paddingTop: section.key === sections[0]?.key ? 0 : theme.spacing.lg,
        }}
      >
        <MonthHeader
          band={section.band}
          month={section.month}
          testID={`timeline-month-${section.key}`}
          year={section.year}
        />
      </RailCell>
    ),
    [sections, theme.spacing.lg, theme.spacing.sm],
  );

  const renderEntry = useCallback(
    ({ item, index, section }: SectionListRenderItemInfo<Item, MonthSection>) => {
      const lastInSection = index === section.data.length - 1;

      return (
        <RailCell
          capBottom={lastInSection && section.key === lastSectionKey}
          style={{
            paddingLeft: ENTRY_INDENT,
            // The next section header supplies its own top spacing, so the last
            // card in a month adds none of its own.
            paddingBottom: lastInSection ? 0 : theme.spacing.sm,
          }}
        >
          <TimelineEntryCard
            item={item}
            onPress={openItem}
            testID={`timeline-item-${item.id}`}
            today={today ?? item.expiryDate}
          />
        </RailCell>
      );
    },
    [lastSectionKey, openItem, theme.spacing.sm, today],
  );

  // A database that never opened leaves `db` null forever, so this is handled
  // here rather than waiting on a load that can never start. The header stays
  // up in every state, as it does on the dashboard.
  const databaseFailed = databaseState.status === 'error';

  const listHeader = (
    <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text color="primary" uppercase variant="labelSm">
          {t('timeline.eyebrow')}
        </Text>
        <Text accessibilityRole="header" variant="headlineMd">
          {t('timeline.title')}
        </Text>
        <Text color="onSurfaceVariant" variant="bodyMd">
          {t('timeline.subtitle')}
        </Text>
      </View>

      {databaseFailed ? (
        <TimelineError onRetry={databaseState.status === 'error' ? databaseState.retry : reload} />
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
    </View>
  );

  /**
   * Every state that is not a populated feed. They ride in `ListEmptyComponent`
   * rather than above the list, so the header still scrolls with them and the
   * screen keeps one scroller in all five states.
   */
  const listEmpty = (
    <View testID="timeline-states">
      {!databaseFailed && status === 'loading' ? <TimelineLoading /> : null}
      {!databaseFailed && status === 'error' ? <TimelineError onRetry={reload} /> : null}
      {status === 'ready' && data.counts.all === 0 ? <TimelineEmpty onAdd={addItem} /> : null}
      {status === 'ready' && data.counts.all > 0 && groups.length === 0 ? (
        <TimelineNoMatches onClear={clearFilter} />
      ) : null}
    </View>
  );

  return (
    <Screen padded={false} tabBar testID="timeline-screen">
      <SectionList
        contentContainerStyle={{ padding: theme.spacing.margin }}
        keyExtractor={keyExtractor}
        ListEmptyComponent={listEmpty}
        ListHeaderComponent={listHeader}
        renderItem={renderEntry}
        renderSectionHeader={renderSectionHeader}
        sections={sections}
        /*
          A sticky header would float the month node away from the rail segment
          it is painted on, leaving a line running out from under it.
        */
        stickySectionHeadersEnabled={false}
        testID="timeline-list"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { alignItems: 'center', flexDirection: 'row' },
  bannerBody: { flex: 1 },
  railStripe: { left: RAIL_LEFT, position: 'absolute', width: RAIL_WIDTH },
});
