import { zodResolver } from '@hookform/resolvers/zod';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components';
import { useDatabaseState } from '@/db/DatabaseProvider';
import type { DocumentCategory } from '@/db/models';
import { todayLocal } from '@/features/expiry';
import { PhotoPermissionError, pickImagesFromLibrary } from '@/services/imagePicker';
import { notificationPort, type NotificationPort } from '@/services/notifications';
import { useTheme } from '@/theme';

import { consumeScan } from '../ocr/scanHandoff';
import { RemindersSheet } from '../reminders/RemindersSheet';
import { requestReminderSync } from '../reminders/reminderStore';

import { defaultOffsetsFor } from './categoryPresets';
import { CaptureStep } from './components/CaptureStep';
import { CategoryStep } from './components/CategoryStep';
import { DetailsStep } from './components/DetailsStep';
import { RemindersStep } from './components/RemindersStep';
import { StepProgress } from './components/StepProgress';
import { saveNewItem } from './saveItem';
import { addItemSchema, stepFields, type AddItemFormValues, type StepNumber } from './schema';

/** The CTA label for each step, verbatim in spirit from the export. */
const ctaLabels: Record<StepNumber, string> = {
  1: 'Next: capture document',
  2: 'Continue to details',
  3: 'Set up reminders',
  4: 'Save to vault',
};

export interface AddItemScreenProps {
  /** Injected by tests; production uses the library picker. */
  pickImages?: typeof pickImagesFromLibrary;
  port?: NotificationPort;
}

export function AddItemScreen({
  pickImages = pickImagesFromLibrary,
  port = notificationPort,
}: AddItemScreenProps = {}) {
  const theme = useTheme();
  const router = useRouter();
  const databaseState = useDatabaseState();
  const [today] = useState(() => todayLocal());

  const [step, setStep] = useState<StepNumber>(1);
  const [furthest, setFurthest] = useState<StepNumber>(1);
  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [askingPermission, setAskingPermission] = useState(false);

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
      ocr: undefined,
    },
  });

  const { control, formState, handleSubmit, setValue, trigger } = form;

  // `useWatch` rather than `watch()`: the React Compiler cannot safely memoize
  // around the function `watch()` returns, and warns about stale UI.
  const category = useWatch({ control, name: 'category' });
  const expiryDate = useWatch({ control, name: 'expiryDate' });
  const attachments = useWatch({ control, name: 'attachments' });
  const reminderOffsets = useWatch({ control, name: 'reminderOffsets' });
  const escalationEnabled = useWatch({ control, name: 'escalationEnabled' });

  const close = useCallback(() => {
    router.back();
  }, [router]);

  /**
   * A modal sheet can be swiped away, so a dirty form confirms before closing.
   * A pristine one just closes — prompting over nothing is noise.
   */
  const requestClose = useCallback(() => {
    if (!formState.isDirty) {
      close();

      return;
    }

    Alert.alert('Discard this document?', 'The details you have entered will not be saved.', [
      { style: 'cancel', text: 'Keep editing' },
      { onPress: close, style: 'destructive', text: 'Discard' },
    ]);
  }, [close, formState.isDirty]);

  const selectCategory = useCallback(
    (next: DocumentCategory) => {
      setValue('category', next, { shouldDirty: true, shouldValidate: true });
      // Selecting a category pre-checks its preset offsets, which is what the
      // export's "Presets calibrate smart reminders automatically" describes.
      setValue('reminderOffsets', [...defaultOffsetsFor(next)], { shouldDirty: true });
    },
    [setValue],
  );

  const handlePick = useCallback(async () => {
    setPickError(undefined);
    setPicking(true);

    try {
      const picked = await pickImages();

      if (picked.length > 0) {
        setValue('attachments', [...attachments, ...picked], { shouldDirty: true });
      }
    } catch (error) {
      setPickError(
        error instanceof PhotoPermissionError
          ? 'ExpiryVault needs access to your photos to attach an image. You can grant it in Settings.'
          : 'Could not open the photo library.',
      );
    } finally {
      setPicking(false);
    }
  }, [attachments, pickImages, setValue]);

  const openScanner = useCallback(() => {
    // `from=add` tells the scanner this form is waiting underneath, so a
    // confirmed scan comes back here rather than opening a second form.
    router.push('/scan?from=add');
  }, [router]);

  /**
   * Applies a scan that came back from the scanner route.
   *
   * The scanner cannot return a value — expo-router navigates, it does not
   * call back — so the result is left in the handoff store and collected on
   * the way back. `useFocusEffect` rather than `useEffect` because that is
   * precisely the moment it arrives: the scanner dismissed and this form came
   * forward again. It also keeps the wizard's step out of a render-time
   * effect, which the React Compiler rightly objects to.
   *
   * Every field is `shouldDirty`, so the discard prompt knows the form has
   * content even if the user typed none of it, and every one is editable in
   * the Verify step: the scan prefills, it does not decide.
   */
  useFocusEffect(
    useCallback(() => {
      const scan = consumeScan();

      if (scan === null) {
        return;
      }

      setValue('expiryDate', scan.expiryDate, { shouldDirty: true, shouldValidate: true });
      setValue(
        'ocr',
        { rawText: scan.rawText, confidence: scan.confidence },
        { shouldDirty: true },
      );

      if (scan.documentNumber !== undefined) {
        setValue('documentNumber', scan.documentNumber, { shouldDirty: true });
      }

      if (scan.country !== undefined) {
        setValue('country', scan.country, { shouldDirty: true });
      }

      if (scan.issueDate !== undefined) {
        setValue('issueDate', scan.issueDate, { shouldDirty: true });
      }

      // Straight to Verify: the point of scanning is to check what was read.
      setStep(3);
      setFurthest((previous) => (previous > 3 ? previous : 3));
    }, [setValue]),
  );

  const removeAttachment = useCallback(
    (uri: string) => {
      setValue(
        'attachments',
        attachments.filter((attachment) => attachment.uri !== uri),
        { shouldDirty: true },
      );
    },
    [attachments, setValue],
  );

  const toggleOffset = useCallback(
    (offset: number) => {
      const next = reminderOffsets.includes(offset)
        ? reminderOffsets.filter((value) => value !== offset)
        : [...reminderOffsets, offset].sort((a, b) => b - a);

      setValue('reminderOffsets', next, { shouldDirty: true });
    },
    [reminderOffsets, setValue],
  );

  /** Advancing validates only the current step's fields — the export gates nothing. */
  const goNext = useCallback(async () => {
    const valid = await trigger([...stepFields[step]]);

    if (!valid) {
      return;
    }

    if (step < 4) {
      const next = (step + 1) as StepNumber;
      setStep(next);
      setFurthest((previous) => (next > previous ? next : previous));

      return;
    }

    await handleSubmit(async (values) => {
      if (databaseState.status !== 'ready') {
        setSaveError('The vault is not open yet. Try again in a moment.');

        return;
      }

      setSaveError(undefined);
      setSaving(true);

      try {
        await saveNewItem(databaseState.db, addItemSchema.parse(values), { today });
        // New reminder rules exist; the schedule has to take them in.
        requestReminderSync();

        // The just-in-time moment for the notification prompt: the user has
        // asked to be reminded about something concrete, which is the only
        // point at which the request explains itself. Asking on first launch,
        // before the vault holds anything, is the prompt everyone declines.
        if ((await port.getPermission()) === 'undetermined') {
          setAskingPermission(true);

          return;
        }

        close();
      } catch {
        // The raw error can carry SQL, so it is not surfaced.
        setSaveError('Could not save this document. Nothing was changed.');
      } finally {
        setSaving(false);
      }
    })();
  }, [close, databaseState, handleSubmit, port, step, today, trigger]);

  const goBack = useCallback(() => {
    setStep((previous) => (previous > 1 ? ((previous - 1) as StepNumber) : previous));
  }, []);

  const jumpTo = useCallback((target: StepNumber) => {
    setStep(target);
  }, []);

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
          label="Cancel"
          onPress={requestClose}
          size="sm"
          testID="cancel-button"
          variant="ghost"
        />
        <Text numberOfLines={1} style={styles.title} variant="titleLg">
          New document
        </Text>
        <Button
          // The export's header Save is always enabled and bypasses the wizard;
          // here it only lights up once the whole form validates.
          disabled={!formState.isValid || saving}
          label="Save"
          loading={saving}
          onPress={() => {
            void goNext();
          }}
          size="sm"
          testID="header-save"
          variant="ghost"
        />
      </View>

      <ScrollView
        contentContainerStyle={{ gap: theme.spacing.lg, padding: theme.spacing.margin }}
        keyboardShouldPersistTaps="handled"
        testID="add-item-scroll"
      >
        <StepProgress current={step} furthestReached={furthest} onJump={jumpTo} />

        {step === 1 ? <CategoryStep onSelect={selectCategory} value={category} /> : null}

        {step === 2 ? (
          <CaptureStep
            attachments={attachments}
            error={pickError}
            onPick={() => {
              void handlePick();
            }}
            onRemove={removeAttachment}
            onScan={openScanner}
            picking={picking}
          />
        ) : null}

        {step === 3 ? (
          <DetailsStep
            control={control}
            errors={formState.errors}
            expiryDate={expiryDate}
            today={today}
          />
        ) : null}

        {step === 4 ? (
          <RemindersStep
            category={category}
            escalationEnabled={escalationEnabled}
            expiryDate={expiryDate}
            onEscalationChange={(value) => {
              setValue('escalationEnabled', value, { shouldDirty: true });
            }}
            onToggle={toggleOffset}
            selected={reminderOffsets}
            today={today}
          />
        ) : null}

        {saveError === undefined ? null : (
          <Text color="error" testID="save-error" variant="bodyMd">
            {saveError}
          </Text>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: theme.colors.outlineVariant,
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.margin,
            paddingVertical: theme.spacing.md,
          },
        ]}
      >
        {step > 1 ? (
          <Button label="Back" onPress={goBack} testID="back-button" variant="secondary" />
        ) : null}
        <View style={styles.cta}>
          <Button
            disabled={saving}
            label={ctaLabels[step]}
            loading={saving && step === 4}
            onPress={() => {
              void goNext();
            }}
            testID="primary-cta"
          />
        </View>
      </View>

      {/*
        Shown after a successful save, so the document is already stored before
        anything is asked of the user. Dismissing it, whatever they chose,
        closes the form.
      */}
      <RemindersSheet
        onClose={close}
        onPermissionResolved={close}
        port={port}
        visible={askingPermission}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cta: { flex: 1 },
  footer: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row' },
  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  title: { flex: 1, textAlign: 'center' },
});
