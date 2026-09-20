# ExpiryVault Progress

## Current
Feature: none started (F1 complete)
Branch: main
Next: F2 Data layer (SQLite schema, migrations, repositories)

## Features
Status: [ ] todo, [~] in progress, [x] done (tests green, reviewed, merged)

- [x] F0  Foundation (TS strict, lint, Jest, expo-router, dev client, EAS config)
- [x] F1  Theme tokens + UI kit (light/dark)
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
- 2026-09-20: DESIGN.md frontmatter is the canonical palette; the export's other two palettes (dashboard violet, item-detail indigo) are drift to reconcile at F4/F5/F6/F11.
- 2026-09-20: Status triad added as explicit tokens — DESIGN.md has no amber and the export expresses status as raw Tailwind utilities, so it had no token source.
- 2026-09-20: Status foregrounds darkened one Tailwind step (emerald/amber/rose 600 -> 700); the values the export renders fail WCAG AA on their own containers (3.6:1, 3.1:1, 4.3:1).
- 2026-09-20: `Input` borders use `outline`, not the design's `outline-variant` — the latter is M3's decorative divider and fails the 3:1 minimum for interactive boundaries.
- 2026-09-20: Button ships a solid `primary` fill; the design's gradient CTA is deferred rather than adding `expo-linear-gradient` before it is seen on device.
- 2026-09-20: `IconButton` takes its glyph as a prop — `@expo/vector-icons` is not bundled with SDK 57, so the icon library choice is deferred to the feature that needs it.
- 2026-09-20: Fonts load at runtime via `useFonts` rather than the expo-font config plugin, so the app runs without a native rebuild; weights are baked into family names so both platforms resolve them identically.
- 2026-09-20: BottomSheet built on `Modal` + `Animated` + `PanResponder` (all RN core) — no new dependency, and `useState`/`useMemo` instead of `useRef.current` because `reactCompiler` forbids reading refs during render.
- 2026-09-20: BottomSheet's scrim is deliberately outside the accessibility tree (the sheet sets `accessibilityViewIsModal`); it is a pointer affordance only.

### F1 dark-palette assumptions
The Stitch export has no dark reference at all, so the dark palette is derived. Tier 1 is verbatim; tiers 2 and 3 are the assumptions:
- Dark `primary`/`secondary`/`tertiary` and their containers are lifted verbatim from the `inverse-*` and `*-fixed*` tokens, which are M3's dark-side values — not invented.
- The neutral surface ramp is interpolated from the light ramp (hue ~255deg), holding hue and chroma and dropping lightness to M3's dark tones. No source value existed.
- Dark `onPrimary`/`onSecondary`/`onTertiary` need tone 20; DESIGN.md carries tone 10 and tone 30 only, so each is interpolated between them.
- Dark `error`/`onError` use the M3 baseline error palette (`#ffb4ab`/`#690005`) — DESIGN.md has no dark error tone.
- Dark `onSurface` reuses `inverse-on-surface` (tone 95) where strict M3 wants tone 90; accepted because it tests clean.
- The palette is not strict M3 (light `primary-container` is a brighter primary with white text, not a tone-90 container), so the derivation preserves the relationships actually present rather than imposing textbook tones.
- Every derived pair is asserted against WCAG AA in `src/theme/__tests__/contrast.test.ts`, so a bad value fails CI rather than shipping.

## Known issues / tech debt
- Six unused template dependencies left from F0: `@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-image`, `expo-device`, `expo-web-browser`.
- DESIGN.md's two-layer shadows with negative spread cannot be expressed in RN (iOS has one shadow, no spread; Android only `elevation`) — `src/theme/tokens/layout.ts` holds a per-platform approximation.
- `app/dev-gallery.tsx` still occupies a route in production builds (expo-router registers every file under `app/`); it renders null there and is never linked outside `__DEV__`.
- F1 was verified by tests and by inspecting the rendered DOM, not by eye on a device or simulator — no visual confirmation yet.

## Design gaps
- No Android variants or dark mode in the Stitch export
- Design system is named "Lumina FinTech" (rename to ExpiryVault)
- DESIGN.md contradicts itself: frontmatter says primary `#4648d4`, its own prose says `#6366f1`
- Three palettes across eight screens — frontmatter (4 screens), dashboard violet `#6d28d9`, item-detail indigo `#6366f1`
- `rounded-xl` means 12px, 16px or 24px depending on the screen; frontmatter's 24px matches the rendered cards best
- No bottom sheet, modal or drag handle exists anywhere in the export
- Status colours are never declared tokens, only raw Tailwind utilities, and three of them fail WCAG AA

## Device test log
(Feature, iOS version/device, Android version/device, result)
-