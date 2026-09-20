import { useState } from 'react';
import { View } from 'react-native';

import { BottomSheet, Button, Text } from '@/components';
import type { IsoDate } from '@/db/models';
import { addDays, compareDates } from '@/features/expiry';
import { useTheme } from '@/theme';

import { DateField } from '../../add-item/components/DateField';

/**
 * Asks for the new expiry date before recording a renewal.
 *
 * The export's "Mark as Renewed" button only recolours itself and fills the
 * ring — it never asks for, or changes, any date. Renewing without a new expiry
 * date would be meaningless, so this is designed rather than ported.
 */

/** A renewed document usually runs about as long as it did before. */
export function suggestRenewalDate(
  expiryDate: IsoDate,
  issueDate: IsoDate | null,
  today: IsoDate,
): IsoDate {
  const base = compareDates(expiryDate, today) > 0 ? expiryDate : today;

  if (issueDate === null) {
    return addDays(base, 365);
  }

  const previousTermDays = Math.max(
    1,
    Math.round(
      (new Date(`${expiryDate}T12:00:00Z`).getTime() -
        new Date(`${issueDate}T12:00:00Z`).getTime()) /
        86_400_000,
    ),
  );

  return addDays(base, previousTermDays);
}

export interface RenewSheetProps {
  visible: boolean;
  expiryDate: IsoDate;
  issueDate: IsoDate | null;
  today: IsoDate;
  onCancel: () => void;
  onConfirm: (newExpiryDate: IsoDate) => void;
  saving: boolean;
}

export function RenewSheet({
  visible,
  expiryDate,
  issueDate,
  today,
  onCancel,
  onConfirm,
  saving,
}: RenewSheetProps) {
  const theme = useTheme();
  const [newExpiry, setNewExpiry] = useState<IsoDate>(() =>
    suggestRenewalDate(expiryDate, issueDate, today),
  );

  const movesForward = compareDates(newExpiry, expiryDate) > 0;

  return (
    <BottomSheet onClose={onCancel} testID="renew-sheet" title="Mark as renewed" visible={visible}>
      <View style={{ gap: theme.spacing.md }}>
        <Text color="onSurfaceVariant" variant="bodyMd">
          {`The current expiry is ${expiryDate}. Choose the new one — the old date is kept in this document's history.`}
        </Text>

        <DateField
          helperText={
            movesForward ? undefined : 'The new date is not later than the current expiry.'
          }
          label="New expiry date"
          onChange={setNewExpiry}
          required
          testID="renew-date"
          value={newExpiry}
        />

        <Button
          disabled={saving}
          label="Confirm renewal"
          loading={saving}
          onPress={() => {
            onConfirm(newExpiry);
          }}
          testID="confirm-renewal"
        />
        <Button
          disabled={saving}
          label="Cancel"
          onPress={onCancel}
          testID="cancel-renewal"
          variant="ghost"
        />
      </View>
    </BottomSheet>
  );
}
