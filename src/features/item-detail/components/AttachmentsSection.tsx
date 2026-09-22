import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Icon, IconButton, Text } from '@/components';
import type { Attachment } from '@/db/models';
import { useTheme } from '@/theme';
import { useTranslation } from 'react-i18next';

/**
 * Attachment thumbnails and a full-screen viewer.
 *
 * The export's scan cards are plain divs that do nothing on tap — an attachment
 * you cannot open is close to useless when the user has just been asked to
 * store passport scans, so the viewer is added here.
 *
 * Uses `expo-image`, which was already installed and unused.
 */

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface AttachmentsSectionProps {
  attachments: readonly Attachment[];
}

export function AttachmentsSection({ attachments }: AttachmentsSectionProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [viewing, setViewing] = useState<Attachment | null>(null);

  return (
    <View style={{ gap: theme.spacing.sm }} testID="attachments-section">
      <View style={styles.header}>
        <Text accessibilityRole="header" variant="titleLg">
          {t('itemDetail.scans')}
        </Text>
        <Text color="onSurfaceVariant" variant="labelSm">
          {attachments.length === 0 ? '' : `${attachments.length}`}
        </Text>
      </View>

      {attachments.length === 0 ? (
        <Text color="onSurfaceVariant" testID="attachments-empty" variant="bodySm">
          {t('itemDetail.noScans')}
        </Text>
      ) : (
        <View style={[styles.grid, { gap: theme.spacing.sm }]}>
          {attachments.map((attachment) => (
            <Pressable
              accessibilityHint={t('itemDetail.attachmentHint')}
              accessibilityLabel={t('itemDetail.viewAttachment', { name: attachment.fileName })}
              accessibilityRole="button"
              key={attachment.id}
              onPress={() => {
                setViewing(attachment);
              }}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: theme.colors.surfaceContainer,
                  borderColor: theme.colors.outlineVariant,
                  borderRadius: theme.radius.md,
                  borderWidth: StyleSheet.hairlineWidth,
                  gap: theme.spacing.xs,
                  padding: theme.spacing.sm,
                },
                pressed ? { opacity: theme.interaction.pressedOpacity } : null,
              ]}
              testID={`attachment-card-${attachment.id}`}
            >
              <Image
                accessibilityIgnoresInvertColors
                contentFit="cover"
                source={{ uri: attachment.fileUri }}
                style={[styles.thumb, { borderRadius: theme.radius.sm }]}
              />
              <Text numberOfLines={1} variant="labelMd">
                {attachment.fileName}
              </Text>
              <Text color="onSurfaceVariant" variant="bodySm">
                {formatBytes(attachment.byteSize)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Modal
        animationType="fade"
        onRequestClose={() => {
          setViewing(null);
        }}
        visible={viewing !== null}
      >
        <View
          // No `scrim` token exists in the palette; `inverseSurface` is the
          // darkest surface available and inverts correctly in dark mode.
          style={[styles.viewer, { backgroundColor: theme.colors.inverseSurface }]}
          testID="attachment-viewer"
        >
          <View style={[styles.viewerBar, { padding: theme.spacing.md }]}>
            <IconButton
              accessibilityLabel={t('common.close')}
              icon={<Icon name="clear" tone={theme.colors.inverseOnSurface} />}
              onPress={() => {
                setViewing(null);
              }}
              testID="close-viewer"
            />
          </View>

          {viewing === null ? null : (
            <Image
              accessibilityIgnoresInvertColors
              accessibilityLabel={viewing.fileName}
              contentFit="contain"
              source={{ uri: viewing.fileUri }}
              style={styles.viewerImage}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexGrow: 1, flexBasis: '46%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  thumb: { height: 96, width: '100%' },
  viewer: { flex: 1 },
  viewerBar: { alignItems: 'flex-end' },
  viewerImage: { flex: 1, width: '100%' },
});
