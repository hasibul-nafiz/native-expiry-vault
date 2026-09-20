import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'expiryvault',
  slug: 'expiryvault',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'expiryvault',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: 'com.expiryvault.app',
  },
  android: {
    package: 'com.expiryvault.app',
    /*
      A guard, not a fix. `expo-notifications` 57 does not declare
      SCHEDULE_EXACT_ALARM itself — only RECEIVE_BOOT_COMPLETED and
      POST_NOTIFICATIONS — so reminders are already inexact as CLAUDE.md
      requires. Its Android scheduler checks `canScheduleExactAlarms()` and
      falls back to `setAndAllowWhileIdle` when the permission is absent.

      This keeps it absent. The permission is exactly the kind of thing a
      dependency upgrade reintroduces silently, and nothing else in the build
      would fail if it did. The accepted cost is that Android may batch
      delivery around the 09:00 target, which an expiry reminder can absorb.
    */
    blockedPermissions: ['android.permission.SCHEDULE_EXACT_ALARM'],
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    // SQLCipher encrypts the whole database file — rows, indexes, WAL and free
    // pages. It is unavailable in Expo Go, so a dev client build is required.
    ['expo-sqlite', { useSQLCipher: true }],
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        // Shown at the just-in-time prompt. The camera permission belongs to
        // expo-camera below, so this plugin declares none — two plugins both
        // claiming it would merge two different usage strings.
        photosPermission:
          'ExpiryVault needs access to your photos so you can attach a picture of a document. Images stay on this device.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'ExpiryVault uses the camera to read expiry dates off your documents. Images are processed on this device and never uploaded.',
        // The scanner takes stills and never records, so neither the
        // microphone permission nor RECORD_AUDIO is declared. An app that asks
        // for a microphone to photograph a passport deserves to be refused.
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-notifications',
      {
        // Local scheduling only — no push credentials and no project id. The
        // channel itself is created at runtime so its accent can be a theme
        // token rather than a literal duplicated here.
        defaultChannel: 'reminders',
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
