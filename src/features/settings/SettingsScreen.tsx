import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Screen, Text } from '@/components';
import { requestReminderSync } from '@/features/reminders';
import { biometricLabelKey } from '@/features/lock/labels';
import { useLockState } from '@/features/lock/useLockState';
import { formatHour } from '@/i18n';
import { useLocale } from '@/i18n/useLocale';
import { biometricPort, type BiometricKind } from '@/services/biometrics';
import {
  autoLockDelays,
  languagePreferences,
  themePreferences,
  type AutoLockDelay,
  type LanguagePreference,
  type ThemePreference,
} from '@/settings/preferences';
import { updatePreferences, usePreferences } from '@/settings/store';
import { useTheme } from '@/theme';
import { useTranslation } from 'react-i18next';

import { OptionSheet } from './components/OptionSheet';
import { SettingsRow } from './components/SettingsRow';

/** Reminder hours offered. Hourly across the day would be a 24-row sheet. */
const REMINDER_HOURS = [7, 8, 9, 10, 12, 15, 18, 20] as const;

type OpenSheet = 'language' | 'theme' | 'reminderHour' | 'autoLock' | null;

export function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocale();
  const preferences = usePreferences();
  const { enrolled } = useLockState();
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [biometric, setBiometric] = useState<BiometricKind>('none');

  useEffect(() => {
    let active = true;

    void biometricPort.getCapability().then((capability) => {
      if (active) {
        setBiometric(capability.enrolled ? capability.kind : 'none');
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const closeSheet = useCallback(() => {
    setSheet(null);
  }, []);

  /**
   * Changing the delivery hour invalidates every scheduled notification, so the
   * scheduler is asked to rebuild. F7 rebuilds wholesale rather than diffing.
   */
  const setReminderHour = useCallback((reminderHour: number) => {
    void updatePreferences({ reminderHour }).then(() => {
      requestReminderSync();
    });
  }, []);

  const themeLabels: Record<ThemePreference, string> = {
    system: t('settings.themeSystem'),
    light: t('settings.themeLight'),
    dark: t('settings.themeDark'),
  };

  const languageLabels: Record<LanguagePreference, string> = {
    system: t('settings.languageSystem'),
    en: t('settings.languageEn'),
    bn: t('settings.languageBn'),
  };

  const autoLockLabel = useCallback(
    (ms: AutoLockDelay): string =>
      ms === 0
        ? t('settings.autoLockImmediately')
        : t('settings.autoLockMinutes', { count: ms / 60_000 }),
    [t],
  );

  const version = Constants.expoConfig?.version ?? '';

  return (
    <Screen scroll tabBar testID="settings-screen">
      <View style={{ gap: theme.spacing.lg }}>
        <Text accessibilityRole="header" variant="headlineMd">
          {t('settings.title')}
        </Text>

        <Section title={t('settings.sectionPreferences')}>
          <SettingsRow
            icon="language"
            onPress={() => setSheet('language')}
            subtitle={t('settings.languageSub')}
            testID="settings-language"
            title={t('settings.language')}
            value={languageLabels[preferences.language]}
          />
          <SettingsRow
            icon="theme"
            onPress={() => setSheet('theme')}
            subtitle={t('settings.themeSub')}
            testID="settings-theme"
            title={t('settings.theme')}
            value={themeLabels[preferences.theme]}
          />
        </Section>

        <Section title={t('settings.sectionNotifications')}>
          <SettingsRow
            icon="reminder"
            onPress={() => setSheet('reminderHour')}
            subtitle={t('settings.reminderTimeSub')}
            testID="settings-reminder-time"
            title={t('settings.reminderTime')}
            value={formatHour(preferences.reminderHour, locale)}
          />
          <Text color="onSurfaceVariant" variant="bodySm">
            {t('settings.reminderTimeNote')}
          </Text>
        </Section>

        <Section title={t('settings.sectionSecurity')}>
          <SettingsRow
            icon="lock"
            onPress={() => router.push('/set-pin')}
            testID="settings-app-lock"
            title={t('settings.appLock')}
            value={enrolled ? t('settings.appLockOn') : t('settings.appLockOff')}
          />
          <SettingsRow
            disabled={biometric === 'none' || !enrolled}
            icon="biometricFingerprint"
            subtitle={
              biometric === 'none'
                ? t('settings.biometricUnavailable')
                : t('settings.biometricUnlockSub', { method: t(biometricLabelKey(biometric)) })
            }
            testID="settings-biometric"
            title={t('settings.biometricUnlock')}
            toggle={{
              value: preferences.biometricUnlock,
              onValueChange: (biometricUnlock) => {
                void updatePreferences({ biometricUnlock });
              },
            }}
          />
          <SettingsRow
            icon="nextUp"
            onPress={() => setSheet('autoLock')}
            subtitle={t('settings.autoLockSub')}
            testID="settings-auto-lock"
            title={t('settings.autoLock')}
            value={autoLockLabel(preferences.autoLockDelayMs)}
          />
        </Section>

        <Section title={t('settings.sectionData')}>
          <SettingsRow
            icon="backup"
            onPress={() => router.push('/backup')}
            subtitle={t('settings.backupSub')}
            testID="settings-backup"
            title={t('settings.backup')}
          />
        </Section>

        <Section title={t('settings.sectionAbout')}>
          <SettingsRow
            icon="vault"
            onPress={() => router.push('/privacy')}
            subtitle={t('settings.privacyPolicySub')}
            testID="settings-privacy"
            title={t('settings.privacyPolicy')}
          />
          <SettingsRow
            icon="document"
            testID="settings-version"
            title={t('settings.version')}
            value={version}
          />
          <View
            style={{
              backgroundColor: theme.colors.primaryFixed,
              borderRadius: theme.radius.lg,
              gap: theme.spacing.xs,
              padding: theme.spacing.md,
            }}
          >
            <Text color="primary" uppercase variant="labelSm">
              {t('settings.offlineTitle')}
            </Text>
            <Text color="onSurfaceVariant" variant="bodySm">
              {t('settings.offlineBody')}
            </Text>
          </View>
        </Section>

        {__DEV__ ? (
          <Section title={t('settings.sectionDeveloper')}>
            <SettingsRow
              icon="category"
              onPress={() => router.push('/dev-gallery')}
              testID="settings-gallery"
              title={t('settings.uiGallery')}
            />
            <SettingsRow
              icon="add"
              onPress={() => router.push('/dev-seed')}
              testID="settings-seed"
              title={t('settings.sampleData')}
            />
          </Section>
        ) : null}
      </View>

      <OptionSheet
        items={languagePreferences.map((value) => ({ value, label: languageLabels[value] }))}
        onClose={closeSheet}
        onSelect={(language) => {
          void updatePreferences({ language });
        }}
        selected={preferences.language}
        testID="language-sheet"
        title={t('settings.language')}
        visible={sheet === 'language'}
      />

      <OptionSheet
        items={themePreferences.map((value) => ({ value, label: themeLabels[value] }))}
        onClose={closeSheet}
        onSelect={(next) => {
          void updatePreferences({ theme: next });
        }}
        selected={preferences.theme}
        testID="theme-sheet"
        title={t('settings.theme')}
        visible={sheet === 'theme'}
      />

      <OptionSheet
        items={REMINDER_HOURS.map((value) => ({ value, label: formatHour(value, locale) }))}
        onClose={closeSheet}
        onSelect={setReminderHour}
        selected={preferences.reminderHour}
        testID="reminder-hour-sheet"
        title={t('settings.reminderTime')}
        visible={sheet === 'reminderHour'}
      />

      <OptionSheet
        items={autoLockDelays.map((value) => ({ value, label: autoLockLabel(value) }))}
        onClose={closeSheet}
        onSelect={(autoLockDelayMs) => {
          void updatePreferences({ autoLockDelayMs });
        }}
        selected={preferences.autoLockDelayMs}
        testID="auto-lock-sheet"
        title={t('settings.autoLock')}
        visible={sheet === 'autoLock'}
      />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text accessibilityRole="header" color="onSurfaceVariant" uppercase variant="labelSm">
        {title}
      </Text>
      {children}
    </View>
  );
}
