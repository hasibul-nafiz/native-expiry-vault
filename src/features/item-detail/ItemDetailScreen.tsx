import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Icon, IconButton, Screen, Text } from '@/components';
import { itemsRepository, renewalTasksRepository } from '@/db';
import { useDatabaseState } from '@/db/DatabaseProvider';
import type { IsoDate } from '@/db/models';
import { addDays } from '@/features/expiry';
import { useTheme } from '@/theme';

import { DashboardError, DashboardLoading } from '../dashboard/components/DashboardStates';
import { requestReminderSync } from '../reminders/reminderStore';

import type { ChecklistStep } from './checklistTemplates';
import { AttachmentsSection } from './components/AttachmentsSection';
import { ChecklistSection } from './components/ChecklistSection';
import { CountdownHero } from './components/CountdownHero';
import { DetailFacts } from './components/DetailFacts';
import { RenewSheet } from './components/RenewSheet';
import { deleteItemWithFiles } from './deleteItem';
import { useItemDetail } from './useItemDetail';

export interface ItemDetailScreenProps {
  itemId: string;
}

export function ItemDetailScreen({ itemId }: ItemDetailScreenProps) {
  const theme = useTheme();
  const router = useRouter();
  const databaseState = useDatabaseState();

  const [renewing, setRenewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();

  const db = databaseState.status === 'ready' ? databaseState.db : null;
  const result = useItemDetail(db, itemId);
  const { reload } = result;

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const goBack = useCallback(() => {
    router.back();
  }, [router]);

  const confirmDelete = useCallback(
    (title: string) => {
      if (db === null) {
        return;
      }

      // Irreversible, so this is the one action that always confirms.
      Alert.alert(
        `Delete ${title}?`,
        'This removes the document, its scans, notes and reminder history. It cannot be undone.',
        [
          { style: 'cancel', text: 'Keep' },
          {
            onPress: () => {
              setBusy(true);
              deleteItemWithFiles(db, itemId)
                .then(() => {
                  // Its reminders went with it; drop them from the schedule.
                  requestReminderSync();
                  goBack();
                })
                .catch(() => {
                  setActionError('Could not delete this document.');
                })
                .finally(() => {
                  setBusy(false);
                });
            },
            style: 'destructive',
            text: 'Delete',
          },
        ],
      );
    },
    [db, goBack, itemId],
  );

  const toggleArchive = useCallback(
    (archived: boolean) => {
      if (db === null) {
        return;
      }

      setBusy(true);
      const action = archived
        ? itemsRepository.unarchiveItem(db, itemId)
        : itemsRepository.archiveItem(db, itemId);

      action
        .then(() => {
          // Archiving silences the document's reminders, unarchiving revives them.
          requestReminderSync();
          reload();
        })
        .catch(() => {
          setActionError('Could not change this document.');
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [db, itemId, reload],
  );

  const confirmRenewal = useCallback(
    (newExpiryDate: IsoDate, today: IsoDate) => {
      if (db === null) {
        return;
      }

      setBusy(true);
      itemsRepository
        .markItemRenewed(db, itemId, newExpiryDate, today)
        .then(() => {
          // A new expiry date recomputed every fire date.
          requestReminderSync();
          setRenewing(false);
          reload();
        })
        .catch(() => {
          setActionError('Could not record the renewal. Nothing was changed.');
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [db, itemId, reload],
  );

  /** Rows are created lazily, so an untouched checklist writes nothing. */
  const toggleChecklistStep = useCallback(
    (step: ChecklistStep, done: boolean, expiryDate: IsoDate) => {
      if (db === null) {
        return;
      }

      renewalTasksRepository
        .listRenewalTasks(db, itemId)
        .then(async (tasks) => {
          const existing = tasks.find((task) => task.title === step.title);

          if (existing === undefined) {
            await renewalTasksRepository.createRenewalTask(db, {
              itemId,
              title: step.title,
              detail: step.detail,
              dueDate:
                step.dueOffsetDays === null ? null : addDays(expiryDate, -step.dueOffsetDays),
              done,
            });

            return;
          }

          await renewalTasksRepository.updateRenewalTask(db, existing.id, { done });
        })
        .then(() => {
          reload();
        })
        .catch(() => {
          setActionError('Could not update the checklist.');
        });
    },
    [db, itemId, reload],
  );

  const header = (
    <View style={[styles.header, { gap: theme.spacing.sm, paddingBottom: theme.spacing.sm }]}>
      <IconButton
        accessibilityLabel="Back"
        icon={<Icon name="chevronRight" />}
        onPress={goBack}
        testID="detail-back"
      />
      <Text numberOfLines={1} style={styles.headerTitle} variant="titleLg">
        Details
      </Text>
    </View>
  );

  if (databaseState.status === 'error') {
    return (
      <Screen>
        {header}
        <DashboardError onRetry={databaseState.retry} />
      </Screen>
    );
  }

  if (result.status === 'loading') {
    return (
      <Screen>
        {header}
        <DashboardLoading />
      </Screen>
    );
  }

  if (result.status === 'error') {
    return (
      <Screen>
        {header}
        <DashboardError onRetry={reload} />
      </Screen>
    );
  }

  const { item, today, attachments, notes, reminders, renewals, tasks } = result.data;

  if (item === null) {
    return (
      <Screen>
        {header}
        <View style={[styles.missing, { gap: theme.spacing.md }]} testID="item-missing">
          <Icon color="onSurfaceVariant" name="empty" size={40} />
          <Text variant="titleLg">This document no longer exists</Text>
          <Button label="Back to the vault" onPress={goBack} variant="secondary" />
        </View>
      </Screen>
    );
  }

  const archived = item.archivedAt !== null;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ gap: theme.spacing.lg, padding: theme.spacing.margin }}
        testID="item-detail-scroll"
      >
        {header}

        {archived ? (
          <View
            style={[
              styles.banner,
              {
                backgroundColor: theme.colors.surfaceContainerHigh,
                borderRadius: theme.radius.md,
                gap: theme.spacing.sm,
                padding: theme.spacing.md,
              },
            ]}
            testID="archived-banner"
          >
            <Text style={styles.bannerText} variant="bodyMd">
              This document is archived and hidden from your vault.
            </Text>
            <Button
              disabled={busy}
              label="Unarchive"
              onPress={() => {
                toggleArchive(true);
              }}
              size="sm"
              testID="unarchive-button"
              variant="secondary"
            />
          </View>
        ) : null}

        <View style={[styles.identity, { gap: theme.spacing.sm }]}>
          <View style={styles.identityText}>
            <Text numberOfLines={2} testID="item-title" variant="headlineMd">
              {item.title}
            </Text>
            {item.issuer === null ? null : (
              <Text color="onSurfaceVariant" numberOfLines={1} variant="bodyMd">
                {item.issuer}
              </Text>
            )}
          </View>
          <IconButton
            accessibilityLabel="Edit document"
            icon={<Icon color="onSurfaceVariant" name="document" />}
            onPress={() => {
              router.push(`/item/${itemId}/edit`);
            }}
            testID="edit-button"
          />
          <IconButton
            accessibilityLabel="Delete document"
            disabled={busy}
            icon={<Icon name="expired" tone={theme.colors.error} />}
            onPress={() => {
              confirmDelete(item.title);
            }}
            testID="delete-button"
          />
        </View>

        <CountdownHero item={item} today={today} />

        <Button
          disabled={busy}
          label="Mark as renewed"
          onPress={() => {
            setRenewing(true);
          }}
          testID="renew-button"
        />

        <View style={[styles.secondaryActions, { gap: theme.spacing.sm }]}>
          <View style={styles.action}>
            <Button
              disabled={busy}
              label={archived ? 'Unarchive' : 'Archive'}
              onPress={() => {
                toggleArchive(archived);
              }}
              testID="archive-button"
              variant="secondary"
            />
          </View>
        </View>

        <DetailFacts item={item} reminders={reminders} today={today} />

        <ChecklistSection
          category={item.category}
          expiryDate={item.expiryDate}
          onToggle={(step, done) => {
            toggleChecklistStep(step, done, item.expiryDate);
          }}
          tasks={tasks}
          today={today}
        />

        <AttachmentsSection attachments={attachments} />

        <View style={{ gap: theme.spacing.sm }} testID="notes-section">
          <Text accessibilityRole="header" variant="titleLg">
            Notes
          </Text>
          {notes.length === 0 ? (
            <Text color="onSurfaceVariant" testID="notes-empty" variant="bodySm">
              No notes on this document.
            </Text>
          ) : (
            notes.map((note) => (
              <View
                key={note.id}
                style={[
                  {
                    backgroundColor: theme.colors.surfaceContainer,
                    borderRadius: theme.radius.md,
                    gap: theme.spacing.xs,
                    padding: theme.spacing.md,
                  },
                ]}
              >
                <Text color="onSurfaceVariant" variant="labelSm">
                  {note.title.toUpperCase()}
                </Text>
                <Text variant="bodyMd">{note.body}</Text>
              </View>
            ))
          )}
        </View>

        {renewals.length === 0 ? null : (
          <View style={{ gap: theme.spacing.sm }} testID="renewal-history">
            <Text accessibilityRole="header" variant="titleLg">
              Renewal history
            </Text>
            {renewals.map((renewal) => (
              <View
                key={renewal.id}
                style={[
                  styles.historyRow,
                  {
                    backgroundColor: theme.colors.surfaceContainer,
                    borderRadius: theme.radius.md,
                    padding: theme.spacing.md,
                  },
                ]}
                testID={`renewal-${renewal.id}`}
              >
                <Text variant="labelMd">{renewal.renewedOn}</Text>
                <Text color="onSurfaceVariant" variant="bodySm">
                  {`${renewal.previousExpiryDate} → ${renewal.newExpiryDate}`}
                </Text>
              </View>
            ))}
          </View>
        )}

        {actionError === undefined ? null : (
          <Text color="error" testID="action-error" variant="bodyMd">
            {actionError}
          </Text>
        )}
      </ScrollView>

      {renewing ? (
        <RenewSheet
          expiryDate={item.expiryDate}
          issueDate={item.issueDate}
          onCancel={() => {
            setRenewing(false);
          }}
          onConfirm={(newExpiryDate) => {
            confirmRenewal(newExpiryDate, today);
          }}
          saving={busy}
          today={today}
          visible={renewing}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: { flex: 1 },
  banner: { alignItems: 'center', flexDirection: 'row' },
  bannerText: { flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row' },
  headerTitle: { flex: 1 },
  historyRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  identity: { alignItems: 'center', flexDirection: 'row' },
  identityText: { flex: 1 },
  missing: { alignItems: 'center', paddingVertical: 32 },
  secondaryActions: { flexDirection: 'row' },
});
