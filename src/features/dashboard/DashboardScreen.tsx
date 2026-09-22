import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from 'react-i18next';

import { Chip, Icon, IconButton, Input, Screen, Text } from '@/components';
import { useDatabaseState } from '@/db/DatabaseProvider';
import type { DocumentCategory, Item } from '@/db/models';
import { minTouchTarget, tabBarHeight, useTheme } from '@/theme';
import type { DocumentStatus } from '@/theme';

import { documentStatus } from '../expiry';
import { RemindersSheet } from '../reminders/RemindersSheet';

import {
  DashboardEmpty,
  DashboardError,
  DashboardLoading,
  DashboardNoMatches,
} from './components/DashboardStates';
import { RecordRow } from './components/RecordRow';
import { StatusTiles } from './components/StatusTiles';
import { UrgentRenewalCard } from './components/UrgentRenewalCard';
import { VaultHeroCard } from './components/VaultHeroCard';
import { greetingFor } from './selectors';
import { useDashboardData } from './useDashboardData';

/** The FAB clears the native tab bar, which the safe-area inset does not cover. */
const FAB_SIZE = 56;

function keyExtractor(item: Item): string {
  return item.id;
}


export function DashboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const databaseState = useDatabaseState();

  const [category, setCategory] = useState<DocumentCategory | null>(null);
  const [status, setStatus] = useState<DocumentStatus | null>(null);
  const [search, setSearch] = useState('');
  const [remindersOpen, setRemindersOpen] = useState(false);

  const db = databaseState.status === 'ready' ? databaseState.db : null;
  const result = useDashboardData(db, { category, search });
  const { reload } = result;

  // Re-reads on every return to the tab, which is how F5's add and F6's delete
  // will refresh this screen without a store or any invalidation logic.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const openItem = useCallback(
    (item: Item) => {
      router.push(`/item/${item.id}`);
    },
    [router],
  );

  const openAdd = useCallback(() => {
    router.push('/add');
  }, [router]);

  const openReminders = useCallback(() => {
    setRemindersOpen(true);
  }, []);

  const closeReminders = useCallback(() => {
    setRemindersOpen(false);
  }, []);

  const clearFilters = useCallback(() => {
    setCategory(null);
    setStatus(null);
    setSearch('');
  }, []);

  // The status filter is applied here rather than in SQL: the records query is
  // already filtered by category and search, and re-querying per status band
  // would make the counters and the list disagree at a midnight boundary.
  const ready = result.status === 'ready' ? result.data : null;
  const today = ready?.today ?? null;

  const records = useMemo(() => {
    if (ready === null) {
      return [];
    }

    return status === null
      ? ready.records
      : ready.records.filter((item) => documentStatus(item.expiryDate, ready.today) === status);
  }, [ready, status]);

  /**
   * The rows used to sit inside one bordered container. A virtualized list has
   * no such wrapper — only cells — so each cell carries the side borders and
   * the first and last carry the rounded ends, which draws the same box.
   */
  const renderRecord = useCallback(
    ({ item, index }: ListRenderItemInfo<Item>) => {
      const first = index === 0;
      const last = index === records.length - 1;
      const end = theme.radius.lg;

      return (
        <View
          style={[
            styles.recordCell,
            {
              backgroundColor: theme.colors.surfaceContainerLowest,
              borderColor: theme.colors.outlineVariant,
              borderTopWidth: first ? StyleSheet.hairlineWidth : 0,
              borderBottomWidth: last ? StyleSheet.hairlineWidth : 0,
              borderTopLeftRadius: first ? end : 0,
              borderTopRightRadius: first ? end : 0,
              borderBottomLeftRadius: last ? end : 0,
              borderBottomRightRadius: last ? end : 0,
            },
          ]}
        >
          <RecordRow item={item} onPress={openItem} today={today ?? item.expiryDate} />
        </View>
      );
    },
    [openItem, records.length, theme, today],
  );


  const greeting = greetingFor(new Date(), t);

  const header = (
    <View style={[styles.headerRow, { paddingBottom: theme.spacing.md }]}>
      <Text accessibilityRole="header" variant="headlineMd">
        {greeting}
      </Text>
      <IconButton
        accessibilityLabel={t('dashboard.remindersButton')}
        icon={<Icon color="onSurfaceVariant" name="bell" />}
        onPress={openReminders}
        testID="notifications-button"
      />
    </View>
  );

  const remindersSheet = (
    <RemindersSheet onClose={closeReminders} visible={remindersOpen} />
  );

  if (databaseState.status === 'error') {
    return (
      <Screen tabBar>
        {header}
        <DashboardError onRetry={databaseState.retry} />
        {remindersSheet}
      </Screen>
    );
  }

  if (result.status === 'loading') {
    return (
      <Screen tabBar>
        {header}
        <DashboardLoading />
        {remindersSheet}
      </Screen>
    );
  }

  if (result.status === 'error') {
    return (
      <Screen tabBar>
        {header}
        <DashboardError onRetry={reload} />
        {remindersSheet}
      </Screen>
    );
  }

  const data = result.data;

  const listHeader = (
    <View style={{ gap: theme.spacing.lg }}>
      {header}

      <VaultHeroCard
        nextRenewal={data.nextRenewal}
        onViewNext={openItem}
        today={data.today}
        total={data.total}
      />

      {data.total === 0 ? (
        <DashboardEmpty onAdd={openAdd} />
      ) : (
        <>
          <Input
            accessibilityLabel={t('dashboard.searchAccessibility')}
            label={t('dashboard.searchLabel')}
            onChangeText={setSearch}
            placeholder={t('dashboard.searchPlaceholder')}
            returnKeyType="search"
            testID="dashboard-search"
            value={search}
          />

          <StatusTiles counts={data.counts} onSelect={setStatus} selected={status} />

          {data.urgent.length === 0 ? null : (
            <View style={{ gap: theme.spacing.sm }}>
              <Text accessibilityRole="header" variant="titleLg">
                {t('dashboard.urgentRenewalTitle')}
              </Text>
              {/*
                Horizontal, and capped at a handful of cards by the query, so it
                stays a ScrollView — virtualizing a row of three costs more than
                it saves.
              */}
              <ScrollView
                contentContainerStyle={{ gap: theme.spacing.sm }}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {data.urgent.map((item) => (
                  <UrgentRenewalCard
                    item={item}
                    key={item.id}
                    onPress={openItem}
                    today={data.today}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {data.categoryFilters.length === 0 ? null : (
            <ScrollView
              contentContainerStyle={{ gap: theme.spacing.sm }}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {data.categoryFilters.map((filter) => (
                <Chip
                  count={filter.count}
                  key={filter.label}
                  label={filter.label}
                  onPress={() => {
                    setCategory(filter.category);
                  }}
                  selected={category === filter.category}
                  testID={`category-chip-${filter.category ?? 'all'}`}
                />
              ))}
            </ScrollView>
          )}

          {data.total === 0 ? null : (
            <Text accessibilityRole="header" color="onSurfaceVariant" uppercase variant="labelSm">
              {t('dashboard.vaultRecordsTitle')}
            </Text>
          )}
        </>
      )}
    </View>
  );

  return (
    <View style={styles.fill}>
      <Screen padded={false} tabBar>
        {/*
          A FlatList rather than a ScrollView full of `.map()`: the vault is the
          one list with no upper bound, and every row mounting on every render
          is what makes a large vault feel slow. The page chrome rides along as
          the list header so the whole screen still scrolls as one.
        */}
        <FlatList
          contentContainerStyle={{
            gap: theme.spacing.sm,
            padding: theme.spacing.margin,
            paddingBottom: theme.spacing.margin + FAB_SIZE + tabBarHeight + insets.bottom,
          }}
          data={data.total === 0 ? [] : records}
          keyboardShouldPersistTaps="handled"
          keyExtractor={keyExtractor}
          ListEmptyComponent={
            data.total === 0 ? null : <DashboardNoMatches onClear={clearFilters} />
          }
          ListHeaderComponent={listHeader}
          ListHeaderComponentStyle={{ paddingBottom: theme.spacing.md }}
          renderItem={renderRecord}
          testID="dashboard-scroll"
        />
      </Screen>

      {remindersSheet}

      <Pressable
        accessibilityHint={t('dashboard.addDocumentHint')}
        accessibilityLabel={t('dashboard.addDocument')}
        accessibilityRole="button"
        onPress={openAdd}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.full,
            bottom: insets.bottom + tabBarHeight + theme.spacing.md,
            height: Math.max(FAB_SIZE, minTouchTarget),
            right: theme.spacing.lg,
            width: Math.max(FAB_SIZE, minTouchTarget),
            ...theme.elevation.level2,
          },
          pressed
            ? {
                opacity: theme.interaction.pressedOpacity,
                transform: [{ scale: theme.interaction.pressedScale }],
              }
            : null,
        ]}
        testID="add-fab"
      >
        <Icon color="onPrimary" name="add" size={28} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  fill: { flex: 1 },
  headerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  recordCell: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
