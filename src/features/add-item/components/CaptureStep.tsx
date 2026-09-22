import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Icon, IconButton, Text } from '@/components';
import { useTheme } from '@/theme';

import type { PickedAttachment } from '../schema';
import { useTranslation } from 'react-i18next';

/**
 * The capture step: how the document's image gets in.
 *
 * The scan tile was rendered disabled from F5 until F8 built the scanner,
 * rather than hidden — the export presents it as the recommended path, so
 * removing it silently would have misrepresented the flow. It now opens the
 * camera, and the date it reads comes back into this form.
 */

export interface CaptureStepProps {
  attachments: readonly PickedAttachment[];
  onPick: () => void;
  onScan: () => void;
  onRemove: (uri: string) => void;
  picking: boolean;
  error?: string;
}

export function CaptureStep({
  attachments,
  onPick,
  onScan,
  onRemove,
  picking,
  error,
}: CaptureStepProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text accessibilityRole="header" variant="titleLg">
          {t('addItem.captureMethod')}
        </Text>
        <Text color="onSurfaceVariant" variant="bodyMd">
          {t('addItem.captureBody')}
        </Text>
      </View>

      <Pressable
        accessibilityHint={t('addItem.scanHint')}
        accessibilityLabel={t('addItem.scanTitle')}
        accessibilityRole="button"
        onPress={onScan}
        style={({ pressed }) => [
          styles.option,
          {
            backgroundColor: theme.colors.surfaceContainer,
            borderColor: theme.colors.primary,
            borderRadius: theme.radius.lg,
            borderWidth: StyleSheet.hairlineWidth,
            gap: theme.spacing.md,
            padding: theme.spacing.md,
          },
          pressed ? { opacity: theme.interaction.pressedOpacity } : null,
        ]}
        testID="capture-scan"
      >
        <Icon color="primary" name="search" size={24} />
        <View style={styles.optionText}>
          <Text variant="labelLg">{t('addItem.scanTile')}</Text>
          <Text color="onSurfaceVariant" variant="bodySm">
            {t('addItem.scanBody')}
          </Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityHint={t('addItem.addPhotosHint')}
        accessibilityLabel={t('addItem.addPhotos')}
        accessibilityRole="button"
        accessibilityState={{ busy: picking }}
        disabled={picking}
        onPress={onPick}
        style={({ pressed }) => [
          styles.option,
          {
            backgroundColor: theme.colors.surfaceContainerLowest,
            borderColor: theme.colors.outline,
            borderRadius: theme.radius.lg,
            borderWidth: StyleSheet.hairlineWidth,
            gap: theme.spacing.md,
            padding: theme.spacing.md,
          },
          pressed ? { opacity: theme.interaction.pressedOpacity } : null,
        ]}
        testID="capture-pick-photos"
      >
        <Icon color="primary" name="document" size={24} />
        <View style={styles.optionText}>
          <Text variant="labelLg">{t('addItem.uploadTile')}</Text>
          <Text color="onSurfaceVariant" variant="bodySm">
            {t('addItem.uploadBody')}
          </Text>
        </View>
      </Pressable>

      {error === undefined ? null : (
        <Text color="error" testID="capture-error" variant="bodySm">
          {error}
        </Text>
      )}

      {attachments.length === 0 ? (
        <Text color="onSurfaceVariant" testID="capture-none" variant="bodySm">
          {t('addItem.noImages')}
        </Text>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          <Text color="onSurfaceVariant" uppercase variant="labelSm">
            {t('addItem.attachedCount', { count: attachments.length })}
          </Text>
          {attachments.map((attachment) => (
            <View
              key={attachment.uri}
              style={[
                styles.attachment,
                {
                  backgroundColor: theme.colors.surfaceContainer,
                  borderRadius: theme.radius.md,
                  gap: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                },
              ]}
              testID={`attachment-${attachment.fileName}`}
            >
              <Icon color="onSurfaceVariant" name="document" size={20} />
              <Text numberOfLines={1} style={styles.attachmentName} variant="bodyMd">
                {attachment.fileName}
              </Text>
              <IconButton
                accessibilityLabel={t('addItem.removeAttachment', { name: attachment.fileName })}
                icon={<Icon color="onSurfaceVariant" name="clear" size={18} />}
                onPress={() => {
                  onRemove(attachment.uri);
                }}
                testID={`remove-${attachment.fileName}`}
              />
            </View>
          ))}
        </View>
      )}

      {picking ? (
        <Button disabled label={t('addItem.openingLibrary')} loading onPress={() => undefined} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  attachment: { alignItems: 'center', flexDirection: 'row' },
  attachmentName: { flex: 1 },
  option: { alignItems: 'center', flexDirection: 'row' },
  optionText: { flex: 1 },
});
