# Permissions audit

Every native permission the current `app.config.ts` plugin configuration can
produce, cross-checked against what's declared vs. blocked today. Conclusion
up front: **nothing new needs blocking** — F7 and F9 already closed the
known gaps. This doc exists so that's a documented conclusion, not an
assumption, and so the one open verification step is tracked in one place.

## Declared (needed, and why)

| Permission | Source plugin | Why it's needed |
|---|---|---|
| iOS `NSCameraUsageDescription` | `expo-camera` | Scanner reads expiry dates off a photographed document (F8) |
| iOS `NSPhotoLibraryUsageDescription` | `expo-image-picker` | Attaching an existing photo to a document (F5) |
| iOS `NSFaceIDUsageDescription` | `expo-local-authentication` | Biometric unlock (F9) |
| Android `CAMERA` | `expo-camera` | Same as iOS camera reason |
| Android `USE_BIOMETRIC` / `USE_FINGERPRINT` | `expo-local-authentication` | Same as iOS Face ID reason |
| Android `POST_NOTIFICATIONS` | `expo-notifications` | Local expiry reminders (F7) |
| Android `RECEIVE_BOOT_COMPLETED` | `expo-notifications` | Re-arms scheduled local notifications after a device reboot |

## Explicitly declined at the plugin level (no permission generated)

| Would-be permission | Plugin option already set | Why declined |
|---|---|---|
| iOS `NSMicrophoneUsageDescription` | `expo-camera` → `microphonePermission: false`, `expo-image-picker` → `microphonePermission: false` | Scanner takes stills only, never records |
| Android `RECORD_AUDIO` | `expo-camera` → `recordAudioAndroid: false` | Same reason |
| Android camera via image-picker | `expo-image-picker` → `cameraPermission: false` | `expo-camera` alone declares the camera permission, so two plugins don't merge two different usage strings for the same permission |

## Blocked (`android.blockedPermissions` in `app.config.ts`)

| Permission | Declared by | Why blocked |
|---|---|---|
| `SCHEDULE_EXACT_ALARM` | `expo-notifications` transitively supports it | CLAUDE.md requires inexact scheduling only; this guards against a future dependency upgrade silently requesting it |
| `READ_EXTERNAL_STORAGE` | `expo-screen-capture` (for its screenshot-*detection* API, unused here) | App only calls `preventScreenCaptureAsync`, which needs no permission; leaving this in would falsely advertise gallery access on the Play listing |
| `READ_MEDIA_IMAGES` | `expo-screen-capture`, same as above | Same reason — also would force an unnecessary Play Console data-safety declaration |
| `DETECT_SCREEN_CAPTURE` | `expo-screen-capture` | Same unused-API reason |

## Not yet verified against a real build

PROGRESS.md already logs this gap and it stands: `blockedPermissions` has
only been checked against the `expo-screen-capture` package's own
`AndroidManifest.xml`, never against a real `npx expo prebuild` merge
output. Before submission:

```
npx expo prebuild --clean
# then diff:
android/app/src/main/AndroidManifest.xml   — confirm the four blocked
                                              permissions are actually absent
                                              and the seven declared ones are
                                              present with no surprises
ios/*/Info.plist                           — confirm exactly three
                                              NS*UsageDescription keys exist
                                              and match docs/store/ios-usage-strings.md
```

If prebuild surfaces a permission not in either table above (e.g. from a
transitive dependency of `@react-native-ml-kit/text-recognition` or another
library), add it to this doc rather than silently accepting it.
