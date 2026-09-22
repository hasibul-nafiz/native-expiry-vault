import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, IconButton, Text } from '@/components';
import type { IsoDate, Item, ReminderRule } from '@/db/models';
import { compareDates, daysUntilExpiry } from '@/features/expiry';
import { useTheme } from '@/theme';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/i18n';
import { useLocale } from '@/i18n/useLocale';

/**
 * The Issued / Expires / Document ID grid and the reminder strip.
 *
 * The document number is masked as the export draws it, but with a reveal
 * control the export lacks — a masked field with no way to read it is just a
 * hidden field.
 */

export interface DetailFactsProps {
  item: Item;
  today: IsoDate;
  reminders: readonly ReminderRule[];
}

function maskNumber(value: string): string {
  const tail = value.slice(-4);

  return `•••• ${tail}`;
}

export function DetailFacts({ item, today, reminders }: DetailFactsProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const theme = useTheme();
  const [revealed, setRevealed] = useState(false);
  const remaining = daysUntilExpiry(item.expiryDate, today);

  // The first undelivered rule that has come due is the one currently armed.
  const nextDue = reminders.find(
    (rule) => rule.enabled && rule.deliveredAt === null && compareDates(rule.fireDate, today) >= 0,
  );

  return (
    <View style={{ gap: theme.spacing.md }} testID="detail-facts">
      <View style={[styles.grid, { gap: theme.spacing.sm }]}>
        <Fact label={t('itemDetail.issued')} secondary={item.country ?? undefined} value={item.issueDate === null ? '—' : formatDate(item.issueDate, locale)} />
        <Fact
          label={t('itemDetail.expires')}
          secondary={remaining < 0 ? `${Math.abs(remaining)} days ago` : `${remaining} days left`}
          tone={theme.status[remaining < 0 ? 'expired' : 'safe'].foreground}
          value={formatDate(item.expiryDate, locale)}
        />
        <Fact
          label={t('itemDetail.renewed')}
          secondary={item.renewedAt === null ? 'Never' : undefined}
          value={item.renewedAt === null ? '—' : formatDate(item.renewedAt, locale)}
        />
      </View>

      {item.documentNumber === null ? null : (
        <View
          style={[
            styles.numberRow,
            {
              backgroundColor: theme.colors.surfaceContainer,
              borderRadius: theme.radius.md,
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
            },
          ]}
        >
          <View style={styles.numberText}>
            <Text color="onSurfaceVariant" variant="labelSm">
              {t('itemDetail.documentNumberLabel').toUpperCase()}
            </Text>
            <Text testID="document-number" variant="labelLg">
              {revealed ? item.documentNumber : maskNumber(item.documentNumber)}
            </Text>
          </View>
          <IconButton
            accessibilityLabel={revealed ? 'Hide document number' : 'Show document number'}
            icon={<Icon color="onSurfaceVariant" name={revealed ? 'clear' : 'search'} size={18} />}
            onPress={() => {
              setRevealed((previous) => !previous);
            }}
            testID="toggle-document-number"
          />
        </View>
      )}

      {reminders.length === 0 ? null : (
        <View style={{ gap: theme.spacing.xs }}>
          <Text color="onSurfaceVariant" variant="labelSm">
            {t('itemDetail.reminderScheduleLabel').toUpperCase()}
          </Text>
          <View style={[styles.reminders, { gap: theme.spacing.xs }]}>
            {reminders.map((rule) => {
              const sent = rule.deliveredAt !== null;
              const armed = rule.id === nextDue?.id;
              const tone = sent
                ? theme.status.safe.foreground
                : armed
                  ? theme.status.soon.foreground
                  : theme.colors.onSurfaceVariant;

              return (
                <View
                  key={rule.id}
                  style={[
                    styles.reminder,
                    {
                      backgroundColor: theme.colors.surfaceContainer,
                      borderRadius: theme.radius.sm,
                      opacity: sent || armed ? 1 : theme.interaction.pressedOpacity,
                      paddingVertical: theme.spacing.xs,
                    },
                  ]}
                  testID={`reminder-chip-${rule.offsetDays}`}
                >
                  <Text style={{ color: tone }} variant="labelSm">
                    {t('itemDetail.offsetDays', { count: rule.offsetDays })}
                  </Text>
                  <Icon
                    name={sent ? 'safe' : armed ? 'alertActive' : 'soon'}
                    size={14}
                    tone={tone}
                  />
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

interface FactProps {
  label: string;
  value: string;
  secondary?: string;
  tone?: string;
}

function Fact({ label, value, secondary, tone }: FactProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.fact,
        {
          backgroundColor: theme.colors.surfaceContainer,
          borderRadius: theme.radius.md,
          padding: theme.spacing.sm,
        },
      ]}
    >
      <Text color="onSurfaceVariant" variant="labelSm">
        {label.toUpperCase()}
      </Text>
      <Text
        numberOfLines={1}
        style={tone === undefined ? undefined : { color: tone }}
        variant="labelMd"
      >
        {value}
      </Text>
      {secondary === undefined ? null : (
        <Text color="onSurfaceVariant" numberOfLines={1} variant="bodySm">
          {secondary}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fact: { alignItems: 'center', flex: 1 },
  grid: { flexDirection: 'row' },
  numberRow: { alignItems: 'center', flexDirection: 'row' },
  numberText: { flex: 1 },
  reminder: { alignItems: 'center', flex: 1 },
  reminders: { flexDirection: 'row' },
});
