import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/theme';

/**
 * The tab bar, rendered natively: a real `UITabBar` on iOS and Material
 * `BottomNavigation` on Android.
 *
 * Tab set: Vault / Scan / Timeline / Profile / Settings. The Stitch export
 * contains two contradictory tab bars; this is the one three of its four tabbed
 * screens agree on, and every destination here has a mockup of its own. The
 * dashboard's variant (which adds Stats and drops Settings) is logged as drift.
 *
 * Android Material Symbol names are taken verbatim from the export. iOS SF
 * Symbols have no source in the export and are the nearest equivalents.
 *
 * Note: Android caps native tabs at five, which is exactly what this uses.
 * The `unstable-native-tabs` import path becomes `expo-router/native-tabs` in
 * SDK 58.
 */
export default function TabsLayout() {
  const theme = useTheme();

  return (
    <NativeTabs
      backgroundColor={theme.colors.surfaceContainerLowest}
      iconColor={theme.colors.onSurfaceVariant}
      tintColor={theme.colors.primary}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          md={{ default: 'inventory_2', selected: 'inventory_2' }}
          sf={{ default: 'shield', selected: 'shield.fill' }}
        />
        <NativeTabs.Trigger.Label>Vault</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="scan">
        <NativeTabs.Trigger.Icon
          md={{ default: 'qr_code_scanner', selected: 'qr_code_scanner' }}
          sf={{ default: 'viewfinder', selected: 'viewfinder' }}
        />
        <NativeTabs.Trigger.Label>Scan</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="timeline">
        <NativeTabs.Trigger.Icon
          md={{ default: 'event_upcoming', selected: 'event_upcoming' }}
          sf={{ default: 'calendar', selected: 'calendar' }}
        />
        <NativeTabs.Trigger.Label>Timeline</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon
          md={{ default: 'account_circle', selected: 'account_circle' }}
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon
          md={{ default: 'settings', selected: 'settings' }}
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
        />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
