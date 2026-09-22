import { Fragment } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet, Button, Icon, Text } from '@/components';
import type { IsoDate } from '@/db/models';
import { useTheme } from '@/theme';

import type { DateCandidate } from './parseDates';
import type { ScanResult } from './scanImage';
import { useTranslation } from 'react-i18next';

/**
 * Where a scan becomes a date the user has agreed to.
 *
 * Nothing from OCR is ever saved without passing through here. That is not
 * caution for its own sake: `03/04/2028` has two readings and this app refuses
 * to guess between them, so there has to be a place where a person chooses.
 *
 * The export's result card is a single row reading "98.4% Confidence", which
 * is fabricated — ML Kit returns no confidence of any kind. What replaces it
 * is the one thing that can actually be checked: whether the MRZ's check digit
 * passed.
 */

export interface ScanConfirmSheetProps {
  visible: boolean;
  result: ScanResult | null;
  /** The captured frame, shown so the user can see what was read. */
  imageUri: string | null;
  onConfirm: (candidate: DateCandidate, date: IsoDate) => void;
  /** Dismiss and go back to the camera. */
  onRetake: () => void;
  /** Give up on scanning and type the details in instead. */
  onEnterManually: () => void;
}

export function ScanConfirmSheet({
  visible,
  result,
  imageUri,
  onConfirm,
  onRetake,
  onEnterManually,
}: ScanConfirmSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const found = result !== null && result.candidates.length > 0;

  return (
    <BottomSheet
      onClose={onRetake}
      testID="scan-confirm-sheet"
      title={found ? 'Check the date' : 'No date found'}
      visible={visible}
    >
      <View style={{ gap: theme.spacing.md }}>
        {imageUri === null ? null : (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={t('scan.capturedAlt')}
            source={{ uri: imageUri }}
            style={[styles.preview, { borderRadius: theme.radius.md }]}
            testID="scan-preview"
          />
        )}

        {found ? (
          <Fragment>
            <Text color="onSurfaceVariant" variant="bodyMd">
              {t('scan.confirmBody')}
            </Text>

            <View style={{ gap: theme.spacing.sm }} testID="scan-candidates">
              {result.candidates.map((candidate) => (
                <CandidateRows
                  candidate={candidate}
                  key={`${candidate.date}-${candidate.source}`}
                  onConfirm={onConfirm}
                />
              ))}
            </View>

            {result.mrz === null ? null : <MrzSummary result={result} />}
          </Fragment>
        ) : (
          <Text color="onSurfaceVariant" testID="scan-nothing-found" variant="bodyMd">
            {t('scan.noDateFound')} {t('scan.retryBody')}
          </Text>
        )}

        <Button
          label={found ? 'Retake' : 'Try again'}
          onPress={onRetake}
          testID="scan-retake"
          variant="secondary"
        />
        <Button
          label={t('scan.typeItIn')}
          onPress={onEnterManually}
          testID="scan-manual"
          variant="ghost"
        />
      </View>
    </BottomSheet>
  );
}

interface CandidateRowsProps {
  candidate: DateCandidate;
  onConfirm: (candidate: DateCandidate, date: IsoDate) => void;
}

/**
 * One candidate, or two rows when it reads both ways.
 *
 * An ambiguous reading is not shown as a single date with a warning attached —
 * it is shown as the two dates it could be, each selectable. A warning is easy
 * to dismiss without reading; two buttons cannot be answered without choosing.
 */
function CandidateRows({ candidate, onConfirm }: CandidateRowsProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (!candidate.ambiguous || candidate.alternative === undefined) {
    return <CandidateRow candidate={candidate} date={candidate.date} onConfirm={onConfirm} />;
  }

  return (
    <View
      style={[
        styles.ambiguous,
        {
          borderColor: theme.colors.outlineVariant,
          borderRadius: theme.radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          gap: theme.spacing.sm,
          padding: theme.spacing.sm,
        },
      ]}
      testID="scan-ambiguous"
    >
      <View style={[styles.row, { gap: theme.spacing.xs }]}>
        <Icon color="error" name="expired" size={16} />
        <Text color="onSurfaceVariant" style={styles.rowText} variant="bodySm">
          {t('scan.ambiguousPrompt', { source: candidate.source })}
        </Text>
      </View>
      <CandidateRow candidate={candidate} date={candidate.date} onConfirm={onConfirm} />
      <CandidateRow candidate={candidate} date={candidate.alternative} onConfirm={onConfirm} />
    </View>
  );
}

interface CandidateRowProps {
  candidate: DateCandidate;
  date: IsoDate;
  onConfirm: (candidate: DateCandidate, date: IsoDate) => void;
}

function CandidateRow({ candidate, date, onConfirm }: CandidateRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const verified = candidate.format === 'mrz';

  return (
    <Pressable
      accessibilityHint={t('scan.candidateSource', { source: candidate.source })}
      accessibilityLabel={t('scan.useDateHint', { date })}
      accessibilityRole="button"
      onPress={() => {
        onConfirm(candidate, date);
      }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.surfaceContainer,
          borderRadius: theme.radius.md,
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
        },
        pressed ? { opacity: theme.interaction.pressedOpacity } : null,
      ]}
      testID={`scan-candidate-${date}`}
    >
      <Icon color={verified ? 'primary' : 'onSurfaceVariant'} name="reminder" size={20} />
      <View style={styles.rowText}>
        <Text variant="labelLg">{date}</Text>
        <Text color="onSurfaceVariant" variant="bodySm">
          {verified
            ? 'From the machine-readable zone, checksum verified'
            : `Read as "${candidate.source}"`}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * The extra fields an MRZ supplies, shown before they are applied so the user
 * knows what the scan is about to fill in. Each is marked by whether its own
 * check digit passed — the document number is the one worth checking, since a
 * single misread character makes it useless.
 */
function MrzSummary({ result }: { result: ScanResult }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const mrz = result.mrz;

  if (mrz === null) {
    return null;
  }

  const rows: { label: string; value: string; verified: boolean }[] = [];

  if (mrz.documentNumber !== null) {
    rows.push({
      label: 'Document number',
      value: mrz.documentNumber,
      verified: mrz.verified.documentNumber,
    });
  }

  if (mrz.issuingCountry !== null) {
    // Not check-digit protected in the MRZ, so it is reported as read.
    rows.push({ label: 'Issued by', value: mrz.issuingCountry, verified: true });
  }

  if (rows.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: theme.spacing.xs }} testID="scan-mrz">
      <Text color="onSurfaceVariant" uppercase variant="labelSm">
        {t('scan.alsoRead')}
      </Text>
      {rows.map((row) => (
        <View key={row.label} style={[styles.row, { gap: theme.spacing.xs }]}>
          <Icon
            color={row.verified ? 'tertiary' : 'error'}
            name={row.verified ? 'safe' : 'expired'}
            size={16}
          />
          <Text color="onSurfaceVariant" style={styles.rowText} variant="bodySm">
            {row.verified ? t('scan.readRow', { label: row.label, value: row.value }) : t('scan.readRowUnverified', { label: row.label, value: row.value })}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ambiguous: { flexDirection: 'column' },
  preview: { height: 140, width: '100%' },
  row: { alignItems: 'center', flexDirection: 'row' },
  rowText: { flex: 1 },
});
