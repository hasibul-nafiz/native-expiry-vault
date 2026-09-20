# ExpiryVault

Offline-first, privacy-first document expiry tracker (passports, visas, permits,
insurance, warranties, subscriptions). Worldwide audience, iOS + Android,
published on App Store and Google Play. Production quality, not a prototype.

## Stack
Expo (managed + dev client, EAS), React Native, TypeScript strict, expo-router,
expo-sqlite, expo-secure-store, expo-local-authentication, expo-notifications,
expo-camera, @react-native-ml-kit/text-recognition, zustand, zod,
react-hook-form, i18next. Tests: jest-expo + React Native Testing Library.

## Structure
app/                 routes only (thin, no logic)
src/features/<name>/ components, hooks, logic, tests per feature
src/components/      shared UI kit
src/db/              schema, migrations, repositories
src/services/        notifications, ocr, crypto, backup
src/theme/           tokens (colors, spacing, radius, type) light + dark
src/i18n/            locale files
design/              Stitch export: reference only, never imported or shipped

## Commands
npm run typecheck | npm run lint | npm test | npx expo start --dev-client

## Design
- Source of truth: design/<screen>/screen.png + design/lumina_fintech/DESIGN.md.
- Recreate as native RN components. Never copy HTML/Tailwind.
- Zero hardcoded colors, sizes or strings. Use theme tokens and i18n keys.
- If the design conflicts with iOS HIG or Material 3, flag it, don't silently fix.

## Platform rules
- Safe areas, 44pt (iOS) / 48dp (Android) touch targets, font scaling supported.
- Native back gesture/button behavior, keyboard avoidance, dark mode.
- VoiceOver/TalkBack labels and roles on every interactive element.
- Platform differences only via Platform.select inside dedicated components.
- Permissions: request just-in-time with rationale. Notifications use inexact
  scheduling only (no exact-alarm permission).

## Code rules
- No `any`, no unused code, no TODO stubs, no console.log.
- Business logic in pure functions (reminder rules, date parsing), fully tested.
- DB: versioned migrations, repository layer, no SQL inside components.
- Sensitive data: encrypted, keys in secure-store, never logged.
- No network calls in v1. No analytics or third-party SDKs without asking.
- Add a dependency only if necessary; state why.

## Workflow
- One feature per session/branch. Plan first, wait for approval before editing.
- Every feature includes tests and handles empty/loading/error states.
- Before finishing: typecheck, lint, tests pass. Then update docs/PROGRESS.md.
- Small, focused changes. Don't refactor unrelated code. Ask when unclear.

## Definition of done
Matches design, works on iOS and Android, accessible, tested, i18n-ready,
typecheck/lint/tests green.

When finishing a feature: tick it in docs/PROGRESS.md, set "Current" and "Next",
and append decisions, known issues, and device test results. Keep entries to one line.