# ExpiryVault Progress

## Current
Feature: none started (F0 complete)
Branch: main
Next: F1 Theme tokens + UI kit

## Features
Status: [ ] todo, [~] in progress, [x] done (tests green, reviewed, merged)

- [x] F0  Foundation (TS strict, lint, Jest, expo-router, dev client, EAS config)
- [ ] F1  Theme tokens + UI kit (light/dark)
- [ ] F2  Data layer (SQLite schema, migrations, repositories)
- [ ] F3  Navigation shell + tabs
- [ ] F4  Dashboard
- [ ] F5  Add item (manual)
- [ ] F6  Item detail, edit, delete, mark renewed
- [ ] F7  Reminder engine + notifications
- [ ] F8  Scan + OCR + date parser
- [ ] F9  App lock (biometric + PIN)
- [ ] F10 Timeline + vault health screens
- [ ] F11 Settings, i18n, 
- [ ] F12 Backup/export/restore
- [ ] F13 Accessibility + platform polish
- [ ] F14 Store readiness (assets, 
permissions strings, privacy policy, EAS submit)

## Decisions
(Claude adds one line per decision: date, decision, why)
- 2026-09-20: Routes moved to top-level `app/` (not SDK 57's default `src/app/`), per CLAUDE.md's explicit structure spec.
- 2026-09-20: F0 root layout is a plain Stack (no tabs) so F3 owns the real nav shell design, not F0.
- 2026-09-20: `ios.bundleIdentifier`/`android.package` set to placeholder `com.expiryvault.app` — must be replaced with the real reverse-DNS id before any store submission.
- 2026-09-20: ESLint uses `eslint-config-prettier` (not `eslint-plugin-prettier`) to keep lint and format as separate concerns.
- 2026-09-20: Sample test lives at `__tests__/index.test.tsx` (repo root), not inside `app/` — expo-router's `require.context` has no built-in exclusion for `.test.tsx` files, so a test colocated in `app/` would be registered as a real route.
- 2026-09-20: `scripts/reset-project.js` deleted along with `src/hooks/`, `src/constants/`, and all template assets/components — none are part of CLAUDE.md's target structure.

## Known issues / tech debt
- 

## Design gaps
- No Android variants or dark mode in the Stitch export
- Design system is named "Lumina FinTech" (rename to ExpiryVault)

## Device test log
(Feature, iOS version/device, Android version/device, result)
-