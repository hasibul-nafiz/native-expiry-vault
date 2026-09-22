import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTranslation } from 'react-i18next';

import { Button, Card, Icon, Screen, Text } from '@/components';
import { useDatabaseState } from '@/db/DatabaseProvider';
import { lockVault } from '@/features/lock/useLockState';
import { useTheme } from '@/theme';

import { HealthBreakdown } from './components/HealthBreakdown';
import { HealthCard } from './components/HealthCard';
import { SchengenCard } from './components/SchengenCard';
import { VaultHealthError, VaultHealthLoading } from './components/VaultHealthStates';
import { useVaultHealth } from './useVaultHealth';

/**
 * The vault-health screen behind the Profile tab.
 *
 * The export's identity block (avatar, name, email, PRO badge) needs a profile
 * that exists nowhere in the schema, and its "Emergency Dossier Export" belongs
 * to F12, so neither is rendered. "Log Out of Vault" becomes "Lock now", which
 * is the only honest reading of it in an app with no account.
 */
export function VaultHealthScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const databaseState = useDatabaseState();

  const db = databaseState.status === 'ready' ? databaseState.db : null;
  const { status, data, reload } = useVaultHealth(db);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const openSecurity = useCallback(() => {
    router.push('/set-pin');
  }, [router]);

  // The header stays up in every state, as it does on the dashboard.
  const databaseFailed = databaseState.status === 'error';

  return (
    <Screen scroll testID="vault-health-screen">
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="headlineMd">{t('vaultHealth.title')}</Text>

        {databaseFailed ? (
          <VaultHealthError
            onRetry={databaseState.status === 'error' ? databaseState.retry : reload}
          />
        ) : null}

        {!databaseFailed && status === 'loading' ? <VaultHealthLoading /> : null}
        {!databaseFailed && status === 'error' ? <VaultHealthError onRetry={reload} /> : null}

        {!databaseFailed && status === 'ready' ? (
          <>
            <HealthCard
              band={data.health.band}
              missingAlerts={data.itemsWithoutReminders}
              score={data.health.score}
              soonCount={data.soonCount}
              totalItems={data.totalItems}
            />

            {data.schengen === null ? null : <SchengenCard usage={data.schengen} />}

            {data.health.score === null ? null : (
              <HealthBreakdown deductions={data.health.deductions} />
            )}

            <Card
              accessibilityLabel={t('vaultHealth.securityRow')}
              onPress={openSecurity}
              testID="vault-health-security-row"
            >
              <View style={[styles.row, { gap: theme.spacing.sm }]}>
                <Icon color="primary" name="lock" size={22} />
                <Text style={styles.grow} variant="titleMd">
                  {t('vaultHealth.securityRow')}
                </Text>
                <Icon color="onSurfaceVariant" name="chevronRight" size={22} />
              </View>
            </Card>

            <Button
              label={t('vaultHealth.lockNow')}
              onPress={lockVault}
              testID="vault-health-lock-now"
              variant="secondary"
            />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row' },
  grow: { flex: 1 },
});
