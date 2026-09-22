import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Card, Icon, Screen, Text } from '@/components';
import { useLocale } from '@/i18n/useLocale';
import { useTheme } from '@/theme';

import { PasswordSheet } from './components/PasswordSheet';
import { RestorePreviewSheet } from './components/RestorePreviewSheet';
import { backupErrorKey, exportSummary, formatBytes } from './labels';
import { useBackup } from './useBackup';

/**
 * Backup and restore.
 *
 * The Stitch export has no backup screen anywhere — only a settings row reading
 * "Backup & Cloud-Free Export / Encrypted .evault file generation" — so every
 * state here is designed rather than recreated, including all four the export
 * never defines for any screen.
 *
 * The two halves are deliberately asymmetric. Exporting is one button and a
 * passphrase. Restoring puts a preview and a destructive confirmation between
 * the file and the vault, because it is the only action in the app that can
 * destroy data the user cannot get back any other way.
 */

type OpenSheet = 'export' | 'import' | 'preview' | null;

export function BackupScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useLocale();
  const backup = useBackup();
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const { stage } = backup;

  const busy = stage.kind === 'exporting' || stage.kind === 'opening' || stage.kind === 'restoring';

  return (
    <Screen scroll testID="backup-screen">
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text accessibilityRole="header" variant="headlineMd">
          {t('backup.title')}
        </Text>
          <Text color="onSurfaceVariant" variant="bodyMd">
            {t('backup.intro')}
          </Text>
        </View>

        <Card testID="backup-export-card">
          <View style={{ gap: theme.spacing.sm }}>
            <Header icon="vault" title={t('backup.exportTitle')} />
            <Text color="onSurfaceVariant" variant="bodySm">
              {t('backup.exportBody')}
            </Text>
            <Button
              disabled={!backup.databaseReady || busy}
              label={t('backup.exportAction')}
              loading={stage.kind === 'exporting'}
              onPress={() => setSheet('export')}
              testID="backup-export"
            />
          </View>
        </Card>

        <Card testID="backup-restore-card">
          <View style={{ gap: theme.spacing.sm }}>
            <Header icon="document" title={t('backup.restoreTitle')} />
            <Text color="onSurfaceVariant" variant="bodySm">
              {t('backup.restoreBody')}
            </Text>
            <Button
              disabled={!backup.databaseReady || busy}
              label={t('backup.restoreAction')}
              loading={stage.kind === 'opening' || stage.kind === 'restoring'}
              onPress={() => setSheet('import')}
              testID="backup-restore"
              variant="secondary"
            />
          </View>
        </Card>

        {stage.kind === 'exported' ? (
          <Notice testID="backup-exported" tone="primary">
            <Text color="primary" variant="labelLg">
              {t('backup.exportedTitle')}
            </Text>
            <Text color="onSurfaceVariant" variant="bodySm">
              {exportSummary(stage.result, t)}
            </Text>
            <Text color="onSurfaceVariant" variant="bodySm">
              {t('backup.exportedSize', {
                name: stage.result.fileName,
                size: formatBytes(stage.result.byteSize, locale, t),
              })}
            </Text>
            {stage.result.orphanFiles > 0 ? (
              <Text color="onSurfaceVariant" variant="bodySm">
                {t('backup.exportedOrphans', { count: stage.result.orphanFiles })}
              </Text>
            ) : null}
            <Button
              label={t('backup.shareAction')}
              onPress={() => {
                void backup.shareExport(t('backup.shareDialogTitle')).then(backup.reset);
              }}
              testID="backup-share"
            />
          </Notice>
        ) : null}

        {stage.kind === 'restored' ? (
          <Notice testID="backup-restored" tone="primary">
            <Text color="primary" variant="labelLg">
              {t('backup.restoredTitle')}
            </Text>
            <Text color="onSurfaceVariant" variant="bodySm">
              {t('backup.restoredBody', { count: stage.itemCount })}
            </Text>
            {stage.missingFiles.length > 0 ? (
              <Text color="error" variant="bodySm">
                {t('backup.restoredMissing', { count: stage.missingFiles.length })}
              </Text>
            ) : null}
          </Notice>
        ) : null}

        {stage.kind === 'failed' ? (
          <Notice testID="backup-error" tone="error">
            <Text color="onErrorContainer" variant="labelLg">
              {t('backup.errorTitle')}
            </Text>
            <Text color="onErrorContainer" variant="bodySm">
              {t(backupErrorKey(stage.reason))}
            </Text>
            <Button label={t('common.dismiss')} onPress={backup.reset} testID="backup-dismiss" variant="ghost" />
          </Notice>
        ) : null}

        <Notice testID="backup-safety" tone="surface">
          <Text variant="labelLg">{t('backup.safetyTitle')}</Text>
          <Text color="onSurfaceVariant" variant="bodySm">
            {t('backup.safetyBody')}
          </Text>
        </Notice>
      </View>

      <PasswordSheet
        confirm
        onClose={() => setSheet(null)}
        onSubmit={(password) => {
          setSheet(null);
          void backup.runExport(password);
        }}
        submitLabel={t('backup.exportAction')}
        testID="export-password"
        title={t('backup.exportTitle')}
        visible={sheet === 'export'}
      />

      <PasswordSheet
        confirm={false}
        onClose={() => setSheet(null)}
        onSubmit={(password) => {
          setSheet(null);
          void backup.pickAndOpen(password).then(() => setSheet('preview'));
        }}
        submitLabel={t('backup.chooseFile')}
        testID="import-password"
        title={t('backup.restoreTitle')}
        visible={sheet === 'import'}
      />

      <RestorePreviewSheet
        busy={stage.kind === 'restoring'}
        onClose={() => {
          setSheet(null);
          backup.reset();
        }}
        onConfirm={() => {
          void backup.confirmRestore().then(() => setSheet(null));
        }}
        preview={stage.kind === 'previewing' ? stage.preview : null}
        visible={sheet === 'preview' && stage.kind === 'previewing'}
      />
    </Screen>
  );
}

function Header({ icon, title }: { icon: 'vault' | 'document'; title: string }) {
  const theme = useTheme();

  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.sm }}>
      <Icon color="primary" name={icon} size={22} />
      <Text variant="titleMd">{title}</Text>
    </View>
  );
}

function Notice({
  children,
  tone,
  testID,
}: {
  children: React.ReactNode;
  tone: 'primary' | 'error' | 'surface';
  testID: string;
}) {
  const theme = useTheme();

  const backgroundColor =
    tone === 'error'
      ? theme.colors.errorContainer
      : tone === 'primary'
        ? theme.colors.primaryFixed
        : theme.colors.surfaceContainer;

  return (
    <View
      style={{
        backgroundColor,
        borderRadius: theme.radius.lg,
        gap: theme.spacing.xs,
        padding: theme.spacing.md,
      }}
      testID={testID}
    >
      {children}
    </View>
  );
}
