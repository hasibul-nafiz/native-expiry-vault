import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { View } from 'react-native';

import { Input, Text } from '@/components';
import { documentStatus } from '@/features/expiry';
import { useTheme } from '@/theme';

import type { AddItemFormValues } from '../schema';

import { DateField } from './DateField';

/** The detail fields. `Input` already renders `error` and `required` from F1. */

export interface DetailsStepProps {
  control: Control<AddItemFormValues>;
  errors: FieldErrors<AddItemFormValues>;
  expiryDate: string | undefined;
  today: string;
}

export function DetailsStep({ control, errors, expiryDate, today }: DetailsStepProps) {
  const theme = useTheme();

  // A past expiry is valid — the vault tracks lapsed documents too — so this is
  // a notice, not a validation error.
  const alreadyExpired =
    expiryDate !== undefined &&
    errors.expiryDate === undefined &&
    documentStatus(expiryDate, today) === 'expired';

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text accessibilityRole="header" variant="titleLg">
          Document details
        </Text>
        <Text color="onSurfaceVariant" variant="bodyMd">
          Only the name and the expiry date are required.
        </Text>
      </View>

      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <Input
            autoCapitalize="words"
            error={errors.title?.message}
            label="Document name"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="US Passport"
            required
            testID="field-title"
            value={field.value ?? ''}
          />
        )}
      />

      <Controller
        control={control}
        name="expiryDate"
        render={({ field }) => (
          <DateField
            error={errors.expiryDate?.message}
            helperText={alreadyExpired ? 'This document has already expired.' : undefined}
            label="Expiry date"
            onChange={field.onChange}
            required
            testID="field-expiry"
            value={field.value}
          />
        )}
      />

      <Controller
        control={control}
        name="issueDate"
        render={({ field }) => (
          <DateField
            error={errors.issueDate?.message}
            helperText="Optional. Used to show how much of the document's life has elapsed."
            label="Issue date"
            onChange={field.onChange}
            testID="field-issue"
            value={field.value}
          />
        )}
      />

      <Controller
        control={control}
        name="issuer"
        render={({ field }) => (
          <Input
            error={errors.issuer?.message}
            label="Issuing authority"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Dept of State"
            testID="field-issuer"
            value={field.value ?? ''}
          />
        )}
      />

      <Controller
        control={control}
        name="documentNumber"
        render={({ field }) => (
          <Input
            autoCapitalize="characters"
            error={errors.documentNumber?.message}
            helperText="Stored encrypted. Shown masked on the document page."
            label="Document number"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            testID="field-number"
            value={field.value ?? ''}
          />
        )}
      />

      <Controller
        control={control}
        name="country"
        render={({ field }) => (
          <Input
            autoCapitalize="characters"
            error={errors.country?.message}
            label="Country code"
            maxLength={2}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="US"
            testID="field-country"
            value={field.value ?? ''}
          />
        )}
      />
    </View>
  );
}
