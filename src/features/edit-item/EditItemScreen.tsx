import { zodResolver } from '@hookform/resolvers/zod';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components';
import { itemsRepository } from '@/db';
import { useDatabaseState } from '@/db/DatabaseProvider';
import { todayLocal } from '@/features/expiry';
import { useTheme } from '@/theme';

import { CategoryStep } from '../add-item/components/CategoryStep';
import { DetailsStep } from '../add-item/components/DetailsStep';
import { addItemSchema, type AddItemFormValues } from '../add-item/schema';
import { DashboardError, DashboardLoading } from '../dashboard/components/DashboardStates';
import { useItemDetail } from '../item-detail/useItemDetail';
import { requestReminderSync } from '../reminders/reminderStore';
import { useTranslation } from 'react-i18next';

/**
 * Editing an existing document.
 *
 * One scrolling page rather than F5's wizard: step gating exists to walk someone
 * through creating a record from nothing, and is friction when correcting one
 * field on a complete one.
 *
 * It reuses F5's `addItemSchema` and its field components, so add and edit
 * cannot drift apart on what counts as valid. Attachments and reminders are
 * managed on the detail screen, so this covers the item's own fields only.
 */

export interface EditItemScreenProps {
  itemId: string;
}

export function EditItemScreen({ itemId }: EditItemScreenProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const databaseState = useDatabaseState();
  const [today] = useState(() => todayLocal());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  const db = databaseState.status === 'ready' ? databaseState.db : null;
  const result = useItemDetail(db, itemId);
  const { reload } = result;

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const form = useForm<AddItemFormValues>({
    resolver: zodResolver(addItemSchema),
    mode: 'onTouched',
    defaultValues: {
      category: undefined,
      title: '',
      issuer: '',
      documentNumber: '',
      country: '',
      issueDate: undefined,
      expiryDate: undefined,
      reminderOffsets: [],
      escalationEnabled: true,
      attachments: [],
    },
  });

  const { control, formState, handleSubmit, reset, setValue } = form;
  const item = result.status === 'ready' ? result.data.item : null;
  const loadedId = item?.id;

  // Populate once the item arrives. Keyed on the id so a different document
  // repopulates, but typing is never overwritten by a background reload.
  useEffect(() => {
    if (item === null || item === undefined) {
      return;
    }

    reset({
      category: item.category,
      title: item.title,
      issuer: item.issuer ?? '',
      documentNumber: item.documentNumber ?? '',
      country: item.country ?? '',
      issueDate: item.issueDate ?? undefined,
      expiryDate: item.expiryDate,
      reminderOffsets: [],
      escalationEnabled: item.escalationEnabled,
      attachments: [],
    });
    // `item` is deliberately excluded: it is a fresh object on every reload, so
    // depending on it would reset the form — and wipe whatever the user was
    // typing — each time the screen refetches. Keying on the id means the form
    // is populated once per document, which is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId, reset]);

  const category = useWatch({ control, name: 'category' });
  const expiryDate = useWatch({ control, name: 'expiryDate' });

  const close = useCallback(() => {
    router.back();
  }, [router]);

  const requestClose = useCallback(() => {
    if (!formState.isDirty) {
      close();

      return;
    }

    Alert.alert('Discard your changes?', 'The edits you have made will not be saved.', [
      { style: 'cancel', text: 'Keep editing' },
      { onPress: close, style: 'destructive', text: 'Discard' },
    ]);
  }, [close, formState.isDirty]);

  const onSave = handleSubmit(async (values) => {
    if (db === null) {
      return;
    }

    setSaveError(undefined);
    setSaving(true);

    try {
      const parsed = addItemSchema.parse(values);
      await itemsRepository.updateItem(db, itemId, {
        title: parsed.title,
        category: parsed.category,
        issuer: parsed.issuer ?? null,
        documentNumber: parsed.documentNumber ?? null,
        country: parsed.country ?? null,
        issueDate: parsed.issueDate ?? null,
        expiryDate: parsed.expiryDate,
        escalationEnabled: parsed.escalationEnabled,
      });
      // The expiry may have moved, which moves every fire date with it.
      requestReminderSync();
      close();
    } catch {
      setSaveError('Could not save your changes. Nothing was modified.');
    } finally {
      setSaving(false);
    }
  });

  if (databaseState.status === 'error') {
    return (
      <Screen>
        <DashboardError onRetry={databaseState.retry} />
      </Screen>
    );
  }

  if (result.status === 'loading') {
    return (
      <Screen>
        <DashboardLoading />
      </Screen>
    );
  }

  if (result.status === 'error') {
    return (
      <Screen>
        <DashboardError onRetry={reload} />
      </Screen>
    );
  }

  if (item === null) {
    return (
      <Screen>
        <Text variant="titleLg">{t('itemDetail.notFoundTitle')}</Text>
        <Button label={t('common.back')} onPress={close} variant="secondary" />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View
        style={[
          styles.header,
          {
            borderBottomColor: theme.colors.outlineVariant,
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.margin,
            paddingVertical: theme.spacing.sm,
          },
        ]}
      >
        <Button
          label={t('common.cancel')}
          onPress={requestClose}
          size="sm"
          testID="edit-cancel"
          variant="ghost"
        />
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title} variant="titleLg">
          {t('editItem.header')}
        </Text>
        <Button
          disabled={!formState.isValid || saving}
          label={t('common.save')}
          loading={saving}
          onPress={() => {
            void onSave();
          }}
          size="sm"
          testID="edit-save"
          variant="ghost"
        />
      </View>

      <ScrollView
        contentContainerStyle={{ gap: theme.spacing.lg, padding: theme.spacing.margin }}
        keyboardShouldPersistTaps="handled"
        testID="edit-item-scroll"
      >
        <DetailsStep
          control={control}
          errors={formState.errors}
          expiryDate={expiryDate}
          today={today}
        />

        <CategoryStep
          onSelect={(next) => {
            setValue('category', next, { shouldDirty: true, shouldValidate: true });
          }}
          value={category}
        />

        {saveError === undefined ? null : (
          <Text color="error" testID="edit-error" variant="bodyMd">
            {saveError}
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  title: { flex: 1, textAlign: 'center' },
});
