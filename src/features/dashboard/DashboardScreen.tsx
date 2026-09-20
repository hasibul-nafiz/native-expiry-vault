import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip, Icon, IconButton, Input, Screen, Text } from '@/components';
import { useDatabaseState } from '@/db/DatabaseProvider';
import type { DocumentCategory, Item } from '@/db/models';
import { minTouchTarget, useTheme } from '@/theme';
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
const TAB_BAR_ALLOWANCE = 64;

export function DashboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const greeting = greetingFor(new Date());

  const header = (
    <View style={[styles.headerRow, { paddingBottom: theme.spacing.md }]}>
      <Text variant="headlineMd">{greeting}</Text>
      <IconButton
        accessibilityLabel="Reminders"
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
      <Screen>
        {header}
        <DashboardError onRetry={databaseState.retry} />
        {remindersSheet}
      </Screen>
    );
  }

  if (result.status === 'loading') {
    return (
      <Screen>
        {header}
        <DashboardLoading />
        {remindersSheet}
      </Screen>
    );
  }

  if (result.status === 'error') {
    return (
      <Screen>
        {header}
        <DashboardError onRetry={reload} />
        {remindersSheet}
      </Screen>
    );
  }

  const data = result.data;

  // The status filter is applied here rather than in SQL: the records query is
  // already filtered by category and search, and re-querying per status band
  // would make the counters and the list disagree at a midnight boundary.
  const records =
    status === null
      ? data.records
      : data.records.filter((item) => documentStatus(item.expiryDate, data.today) === status);

  return (
    <View style={styles.fill}>
      <Screen padded={false}>
        <ScrollView
          contentContainerStyle={{
            gap: theme.spacing.lg,
            padding: theme.spacing.margin,
            paddingBottom: theme.spacing.margin + FAB_SIZE + TAB_BAR_ALLOWANCE,
          }}
          keyboardShouldPersistTaps="handled"
          testID="dashboard-scroll"
        >
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
                accessibilityLabel="Search documents"
                label="Search"
                onChangeText={setSearch}
                placeholder="Search passport, visa, insurance..."
                returnKeyType="search"
                testID="dashboard-search"
                value={search}
              />

              <StatusTiles counts={data.counts} onSelect={setStatus} selected={status} />

              {data.urgent.length === 0 ? null : (
                <View style={{ gap: theme.spacing.sm }}>
                  <Text accessibilityRole="header" variant="titleLg">
                    Urgent renewal
                  </Text>
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

              <View style={{ gap: theme.spacing.sm }}>
                <Text accessibilityRole="header" color="onSurfaceVariant" variant="labelSm">
                  VAULT RECORDS
                </Text>

                {records.length === 0 ? (
                  <DashboardNoMatches onClear={clearFilters} />
                ) : (
                  <View
                    style={[
                      styles.records,
                      {
                        backgroundColor: theme.colors.surfaceContainerLowest,
                        borderColor: theme.colors.outlineVariant,
                        borderRadius: theme.radius.lg,
                      },
                    ]}
                  >
                    {records.map((item) => (
                      <RecordRow item={item} key={item.id} onPress={openItem} today={data.today} />
                    ))}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </Screen>

      {remindersSheet}

      <Pressable
        accessibilityHint="Opens the add document form"
        accessibilityLabel="Add document"
        accessibilityRole="button"
        onPress={openAdd}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.full,
            bottom: insets.bottom + TAB_BAR_ALLOWANCE,
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
  records: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
