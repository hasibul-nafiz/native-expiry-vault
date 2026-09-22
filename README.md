# ExpiryVault

An offline-first, privacy-first document expiry tracker for passports, visas,
permits, insurance policies and warranties. Built with Expo and React Native
for iOS and Android.

Every document lives in a local, encrypted database. There is no account, no
server, no analytics, and no network call anywhere in the app — reminders are
scheduled by the OS, backups are files you keep yourself, and nothing about
your documents ever leaves your device unless you explicitly export it.

## What it does

- **Tracks expiry dates** for any document — passport, visa, driving licence,
  health insurance, warranty, contract, or anything else — with per-category
  reminder defaults and a scanner that reads dates off the document itself.
- **Reminds you before it's too late.** Reminders are scheduled locally
  through the OS notification system, with a daily escalation as a document
  gets close to expiring.
- **Scans and reads documents.** The camera captures a document and on-device
  OCR (Google ML Kit) extracts and parses the expiry date, including MRZ
  check-digit verification for passports and IDs. Nothing is uploaded; the
  image never leaves the device.
- **Locks behind a PIN or biometrics.** Face ID / Touch ID / fingerprint, with
  a PIN fallback, backoff after repeated failures, and a screen shield so the
  app doesn't show your documents in the recent-apps switcher.
- **Shows a timeline and a vault health score.** Upcoming expiries grouped by
  month, and a transparent point-deduction score explaining exactly what
  needs attention and why.
- **Backs up and restores.** The whole vault — documents, reminders,
  attachments — can be exported to a single password-encrypted file and
  restored later, with no cloud involved at any point.
- **Speaks your language.** Settings, theme, language and reminder time are
  all real, persisted preferences. Ships in English and Bengali.

## What it deliberately does not do

- No account, no login, no server backend.
- No analytics, no crash reporting, no third-party SDKs phoning home.
- No network requests of any kind in normal use. The privacy policy is a
  bundled, translated screen — not a link — because an app that makes no
  network requests shouldn't need one to explain that it makes no network
  requests.
- No cloud backup. A backup is a file you create, keep, and restore
  yourself.

## Tech stack

- **Expo** (managed workflow + dev client, EAS build) targeting iOS and
  Android
- **React Native** with **TypeScript** in strict mode
- **expo-router** for navigation, with typed routes and route groups
- **expo-sqlite** with SQLCipher (`useSQLCipher: true`) for an encrypted
  local database, keyed by a random value held in the iOS Keychain / Android
  Keystore via `expo-secure-store`
- **expo-local-authentication** for biometric unlock, backed by a PBKDF2
  PIN fallback (`@noble/hashes`)
- **expo-notifications** for local, inexact-scheduled reminders
- **expo-camera** + **@react-native-ml-kit/text-recognition** for on-device
  document scanning and OCR
- **i18next** / **react-i18next** + **expo-localization** for
  internationalisation (English, Bengali)
- **@noble/ciphers** for the backup file's authenticated encryption
  (XChaCha20-Poly1305)
- **zod** for schema validation, **react-hook-form** for forms
- **jest-expo** + **React Native Testing Library** for testing

No analytics, crash reporting, or other third-party SDK is included.

## Project structure

```
app/                    Routes only (expo-router). Thin — no business logic.
src/features/<name>/    Screens, hooks, and logic for one feature, colocated
                         with its tests.
src/components/         Shared UI kit (Button, Card, Input, Text, ...).
src/db/                 SQLite schema, versioned migrations, and a
                         repository layer — no raw SQL outside src/db.
src/services/           Thin wrappers around native modules (notifications,
                         OCR, biometrics, backup, screen capture) — each
                         library has exactly one importer, so the rest of
                         the app talks to a small typed port instead.
src/theme/               Design tokens (colour, spacing, radius, type),
                         light and dark, WCAG AA contrast-tested.
src/i18n/                Locale catalogues and formatting helpers.
docs/PROGRESS.md         Running log of what's built, decisions made, and
                         known issues — the closest thing this repo has to
                         a changelog.
design/                  Reference mockups only. Never imported or shipped.
```

## Getting started

### Prerequisites

- Node.js 20 or later
- npm
- For running on a device or simulator: Xcode (iOS) and/or Android Studio
  (Android), set up per Expo's
  [environment setup guide](https://docs.expo.dev/get-started/set-up-your-environment/)

### Install

```bash
npm install
```

### Run it

This app uses native modules (SQLCipher, biometrics, the camera, ML Kit)
that **do not run in Expo Go**. You need a development build.

```bash
# One-time: generate the native iOS/Android projects
npx expo prebuild

# Then, to run on a simulator/emulator or a connected device:
npx expo run:ios
npx expo run:android

# On subsequent runs, once the native app is installed, just start the
# JS bundler and reload the app on the device:
npx expo start --dev-client
```

### Check your work

```bash
npm run typecheck   # tsc --noEmit
npm run lint         # eslint .
npm test             # jest
```

All three are expected to pass cleanly before anything is considered done.
The test suite is pinned to a fixed, DST-observing timezone
(`America/New_York`) so date and reminder logic is exercised against a real
UTC offset rather than a CI machine's UTC default.

### Building for a store

Builds are configured through EAS (`eas.json`). With the
[EAS CLI](https://docs.expo.dev/eas/) installed and logged in:

```bash
eas build --platform ios
eas build --platform android
```

## Project status

This is an active, feature-by-feature build. See
[`docs/PROGRESS.md`](docs/PROGRESS.md) for exactly what's implemented, what
decisions were made and why, and what's known to still need work — including
that most native functionality has not yet been verified on a real device,
and that the Bengali translation is machine-quality and needs a native
speaker's review before shipping.

## License

See [`LICENSE`](LICENSE).
