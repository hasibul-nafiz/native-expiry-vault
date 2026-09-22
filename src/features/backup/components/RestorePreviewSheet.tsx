import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BottomSheet, Button, Text } from '@/components';
import { formatDateLong } from '@/i18n';
import { useLocale } from '@/i18n/useLocale';
import type { BackupPreview } from '@/services/backup';
import { useTheme } from '@/theme';

import { formatBytes } from '../labels';

/**
 * What is in the file, and what accepting it will cost.
 *
 * These numbers are not in the plaintext header — deliberately, so an encrypted
 * backup does not advertise its contents — which is why this can only be shown
 * after the passphrase has already opened the file. The confirmation is worded
 * around what will be *lost*, not what will be gained: the gain is why they are
 * here, the loss is the part they might not have thought about.
 */

export interface RestorePreviewSheetProps {
  visible: boolean;
  preview: BackupPreview | null;
  onConfirm: () => void;
  onClose: () => void;
  busy: boolean;
}

export function RestorePreviewSheet({
  visible,
  preview,
  onConfirm,
  onClose,
  busy,
}: RestorePreviewSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useLocale();

  if (preview === null) {
    return null;
  }

  return (
    <BottomSheet onClose={onClose} title={t('backup.restoreTitle')} visible={visible}>
      <View style={{ gap: theme.spacing.md }} testID="restore-preview">
        <View style={{ gap: theme.spacing.xs }}>
          <Row
            label={t('backup.previewCreated')}
            value={formatDateLong(preview.createdAt.slice(0, 10), locale)}
          />
          <Row label={t('backup.previewItems')} value={t('backup.countItems', { count: preview.itemCount })} />
          {preview.archivedItemCount > 0 ? (
            <Row
              label={t('backup.previewArchived')}
              value={t('backup.countItems', { count: preview.archivedItemCount })}
            />
          ) : null}
          <Row
            label={t('backup.previewAttachments')}
            value={t('backup.countAttachments', { count: preview.attachmentCount })}
          />
          <Row
            label={t('backup.previewSize')}
            value={formatBytes(preview.attachmentBytes, locale, t)}
          />
          <Row label={t('backup.previewAppVersion')} value={preview.appVersion} />
        </View>

        {preview.migrated ? (
          <Text color="onSurfaceVariant" variant="bodySm">
            {t('backup.previewMigrated')}
          </Text>
        ) : null}

        <View
          style={{
            backgroundColor: theme.colors.errorContainer,
            borderRadius: theme.radius.lg,
            gap: theme.spacing.xs,
            padding: theme.spacing.md,
          }}
        >
          <Text color="onErrorContainer" variant="labelLg">
            {t('backup.restoreWarningTitle')}
          </Text>
          <Text color="onErrorContainer" variant="bodySm">
            {t('backup.restoreWarningBody')}
          </Text>
        </View>

        <Button
          accessibilityHint={t('backup.restoreConfirmHint')}
          label={t('backup.restoreConfirm')}
          loading={busy}
          onPress={onConfirm}
          testID="restore-confirm"
        />
        <Button
          label={t('common.cancel')}
          onPress={onClose}
          testID="restore-cancel"
          variant="ghost"
        />
      </View>
    </BottomSheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.spacing.sm,
        justifyContent: 'space-between',
      }}
    >
      <Text color="onSurfaceVariant" variant="bodyMd">
        {label}
      </Text>
      <Text variant="labelLg">{value}</Text>
    </View>
  );
}
