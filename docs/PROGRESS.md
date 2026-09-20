# ExpiryVault Progress

## Current
Feature: none started (F8 complete)
Branch: feat/foundation (F0-F8 all landed here, not on main)
Next: F9 App lock (biometric + PIN)

## Features
Status: [ ] todo, [~] in progress, [x] done (tests green, reviewed, merged)

- [x] F0  Foundation (TS strict, lint, Jest, expo-router, dev client, EAS config)
- [x] F1  Theme tokens + UI kit (light/dark)
- [x] F2  Data layer (SQLite schema, migrations, repositories)
- [x] F3  Navigation shell + tabs
- [x] F4  Dashboard
- [x] F5  Add item (manual)
- [x] F6  Item detail, edit, delete, mark renewed
- [x] F7  Reminder engine + notifications
- [x] F8  Scan + OCR + date parser
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

- 2026-09-20: Whole-DB SQLCipher (`useSQLCipher: true`) over field-level encryption — every queried column (expiry, title, issuer, category) must stay indexable, and field-level would leave expiry plaintext anyway.
- 2026-09-20: DB key is 32 random bytes as hex in secure-store with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (excluded from cloud backups); `requireAuthentication` deferred to F9 so cold start is not gated on biometrics.
- 2026-09-20: A malformed stored key raises rather than regenerating — replacing it would make the existing encrypted database permanently unreadable.
- 2026-09-20: Dates stored as `TEXT` `YYYY-MM-DD` with a `GLOB` + `date(col) IS col` CHECK; the round-trip rejects impossible dates (2026-02-30, 2023-02-29) that a format check alone accepts.
- 2026-09-20: Date arithmetic is integer days-from-civil in `src/features/expiry/dates.ts` with no `Date` in the path; `todayLocal()` is the single impure boundary, asserted identical under UTC+14 and UTC-11.
- 2026-09-20: `SOON_THRESHOLD_DAYS = 60`, from the dashboard's "Review / < 60 Days" tile — the only numeric threshold the export states; day 0 is `soon`, not `expired`.
- 2026-09-20: `DocumentStatus` reused from the theme tokens rather than redeclared, so the status model cannot drift from the colours that render it.
- 2026-09-20: `reminder_rules.fire_date` is denormalised so F7 can range-scan an index; `updateItem`/`markItemRenewed` recompute it in the same transaction as the expiry change.
- 2026-09-20: Repositories depend on a narrow `Database` port; production wraps expo-sqlite, tests wrap in-memory better-sqlite3, so migrations and constraints are executed for real rather than mocked.
- 2026-09-20: Both adapters normalise driver failures to `DatabaseError` — better-sqlite3's native errors are built in the host realm and fail `instanceof Error` inside Jest, which made error assertions pass alone and fail in a full run.
- 2026-09-20: `expo-crypto` added (not in CLAUDE.md's stack) for `getRandomBytesAsync` and `randomUUID`; the alternative was `Math.random` for a cipher key plus a separate UUID dependency.
- 2026-09-20: `categories` and app `settings` tables deferred to F11, which owns their UI and defaults; F2 keeps `category` as a CHECK-constrained column and reminder defaults as a typed constant.
- 2026-09-20: `.prettierrc` gained `printWidth: 100` to match the width F1's code was already written to; the default 80 would have rewrapped the whole repo.

- 2026-09-20: Canonical tab set is Vault/Scan/Timeline/Profile/Settings — three of the export's four tabbed screens agree on it and every destination has a mockup; the dashboard's variant (adds Stats, drops Settings) is drift, and Stats has no mockup at all.
- 2026-09-20: Tab bar uses `NativeTabs` (`expo-router/unstable-native-tabs`) for a real UITabBar / Material BottomNavigation; adds no dependency because the `md` prop is typed by `expo-symbols`, which was already installed.
- 2026-09-20: Android tab icons are the export's Material Symbol names verbatim; iOS SF Symbols have no source in the export and are the nearest equivalents (shield, viewfinder, calendar, person.crop.circle, gearshape) — the one invented mapping in F3.
- 2026-09-20: Route groups `(auth)`/`(app)`/`(tabs)` carry no URL segment, so paths stay `/`, `/scan`, `/item/[id]`, `/lock`; the lock redirect lives above the tabs so a deep link into a locked app cannot flash the content behind the gate.
- 2026-09-20: Lock state is a module-level `useSyncExternalStore` hook, not a zustand store — F9 owns the state-library decision, and the hook is a working default-unlocked implementation rather than a stub.
- 2026-09-20: `add` is `presentation: 'modal'` — the export draws it with a drag handle and a Cancel/Save pair, not a back chevron; iOS gets the native sheet grabber for free.
- 2026-09-20: Scan stays a plain tab placeholder; the export draws the scanner with no tab bar yet puts a Scan tab in every tab bar, so F8 decides the presentation with a real camera in hand.
- 2026-09-20: Icon library deferred again (F1 -> F3 -> F4); `NativeTabs` needs none, and F3's placeholders have no glyphs.
- 2026-09-20: `.expo/types/router.d.ts` was stale from F0 and had to be regenerated by running the dev server before typed routes would accept `/lock`.

- 2026-09-20: Dashboard renders in the canonical indigo tokens, not the mockup's violet `#6d28d9` — F1 already contrast-tested indigo in both schemes, and reskinning for one screen would invalidate that and leave the other four screens wrong. This closes the "reconcile at F4" item.
- 2026-09-20: `@expo/vector-icons` (MaterialIcons) added behind `src/components/Icon.tsx`; the export uses Material Symbols, whose names map almost one-to-one, and no other file imports the icon library so swapping it stays a single-file change.
- 2026-09-20: The database is injected via `DatabaseProvider` rather than each screen calling `getDatabase()` — it gives the async open a loading/error/retry path, and lets tests supply F2's in-memory better-sqlite3 database so dashboard tests run real SQL.
- 2026-09-20: Data reads use `useAsyncData` + `useFocusEffect`, not zustand or a query library; SQLite is local so re-querying is cheap, and refetch-on-focus is how F5/F6 mutations will refresh this screen with no invalidation logic.
- 2026-09-20: `useAsyncData` derives `loading` by comparing the stored result against the current request instead of setting state inside the effect — `reactCompiler` rejects synchronous setState in an effect, and deriving also makes a stale result impossible to render.
- 2026-09-20: Counters and category chips are global while the record list filters; the export's tiles sum to the same total as its "All (12)" chip.
- 2026-09-20: Countdowns switch from days to "N+ years" at 730 days, derived from the export rendering 389 days as "389d left" but ~1,600 as "4+ years".
- 2026-09-20: Status filtering is applied in JS over the already-fetched records, not as a fourth query, so the tiles and the list cannot disagree across a midnight boundary.
- 2026-09-20: Header shows a time-based greeting with no name or avatar — there is no profile anywhere in the schema, and inventing one belongs to F10/F11.
- 2026-09-20: Hero card uses a solid `primary` fill, not the export's three-stop gradient; F1's deferral of `expo-linear-gradient` stands and is not reversed inside a feature.
- 2026-09-20: Category chips show only categories that have items, so an empty vault renders no chip row rather than seven zeroes.

- 2026-09-20: Date picker is `@expo/ui/community/datetime-picker` — already installed and unused, renders a real SwiftUI/Compose picker, and is API-compatible with `@react-native-community/datetimepicker` so the escape from `@expo/ui`'s experimental status is a one-line import change. Retires a second unused dependency.
- 2026-09-20: The zod schema deliberately mirrors migration 001's CHECK constraints and reuses `isIsoDate` for date validity, so nothing the form accepts can be rejected later by SQLite as an unexplained `DatabaseError`.
- 2026-09-20: A past expiry date is valid, not an error — the dashboard has an Expired band and users legitimately add lapsed documents; it shows as a notice instead.
- 2026-09-20: Per-category reminder offsets are invented from the export's subtitle prose (`6-mo airline rule` etc.); there is no data attribute anywhere tying a category to a preset, and `selectCategory()` never records the choice at all.
- 2026-09-20: Step advancement validates that step's fields and jump pills are disabled beyond the furthest step reached; the export's `goToStep()` gates nothing and its header Save bypasses the wizard entirely.
- 2026-09-20: `toIsoDateLocal`/`fromIsoDateLocal` added to `src/features/expiry/dates.ts` so `Date` conversion happens only at the picker boundary, anchored at midday so a DST shift cannot move the chosen day.
- 2026-09-20: Save writes item + reminders in one transaction, then copies files, then inserts attachment rows; any later failure deletes the item and its directory. A filesystem copy cannot join a SQL transaction, so the ordering is what makes failure recoverable.
- 2026-09-20: Attachments come from the photo library only; the camera arrives with F8's scanner, so no camera permission is declared (`cameraPermission: false`).
- 2026-09-20: `AddItemScreen` uses RHF's `useWatch` rather than `watch()` — `reactCompiler` cannot memoize safely around the function `watch()` returns and warns about stale UI.
- 2026-09-20: The export's `Delivery Time` control is omitted: it is static text there, and a global notification time belongs to F11.
- 2026-09-20: Attachment file names and the item id are sanitised before use as paths, so a crafted name cannot escape the item's own directory.

- 2026-09-20: Migration 002 adds `items.archived_at` and a `renewals` table — F6 was the first feature needing schema that did not exist, since `renewed_at` held only the latest renewal and there was no archive concept at all.
- 2026-09-20: Archive is a nullable timestamp, not a boolean, so the record keeps *when* it was archived; `NULL` means active.
- 2026-09-20: `archived_at` carries a format CHECK even though 001's other `*_at` columns do not — the column is new, so nothing existing can violate it.
- 2026-09-20: Every item read takes an explicit `includeArchived` option instead of filtering silently, so each call site states what it wants; each of the six read paths is asserted separately.
- 2026-09-20: `markItemRenewed` writes the history row, moves the expiry and recomputes reminder fire dates in one transaction — history that can disagree with the record it describes is worse than no history.
- 2026-09-20: Deleting goes through `deleteItemWithFiles`, because cascades reach attachment rows but not the image files on disk; files are removed after the row, so a failure orphans bytes rather than leaving a record pointing at nothing.
- 2026-09-20: Edit is a single scrolling page reusing F5's `addItemSchema` and field components, so add and edit cannot drift on what counts as valid; the wizard's step gating is friction when correcting one field.
- 2026-09-20: Checklist templates are static per-category data, invented for six of the seven categories — the export hardcodes four steps for one residence permit with no template or binding. Ticks persist into F2's unused `renewal_tasks` table, with rows created lazily on first tick.
- 2026-09-20: Ring geometry (r=66, viewBox 160, 8px track, 9px rounded progress, -90deg rotation) is taken verbatim from the export; only the colours come from theme tokens. `dashOffsetFor` is pure and reproduces the export's 414.69/394.78 exactly.
- 2026-09-20: The export labels its progress bar "Lifetime Elapsed" but its width matches *remaining*; F6 renders and labels remaining, resolving the contradiction rather than preserving it.
- 2026-09-20: The document number is masked as drawn but gains a reveal control the export lacks — a masked field with no way to read it is just a hidden field.
- 2026-09-20: Attachments use `expo-image` (installed and unused since F0) with a full-screen viewer; the export's scan cards do nothing on tap.
- 2026-09-20: Archive needs no confirm because it is reversible; delete always confirms because it is not.

- 2026-09-20: `expo-notifications` added — named in CLAUDE.md's stack but never installed by F0; the only new dependency in F7.
- 2026-09-20: No migration. F2 built `fire_date`, `delivered_at` and `notification_id` for this feature; `notification_id` non-null means handed to the OS, `delivered_at` means it fired, which is the whole state machine.
- 2026-09-20: `expo-notifications` 57 does NOT declare SCHEDULE_EXACT_ALARM (only RECEIVE_BOOT_COMPLETED and POST_NOTIFICATIONS), so reminders are already inexact per CLAUDE.md; `blockedPermissions` keeps it that way as a guard against a dependency upgrade reintroducing it.
- 2026-09-20: Android delivery is approximate by design — the scheduler falls back to `setAndAllowWhileIdle` without the exact-alarm permission, so 09:00 may be batched. Acceptable for an expiry reminder, would not be for an alarm.
- 2026-09-20: One notification per fire date, not per rule — several documents due the same day become one digest, and the pending budget is then spent per date rather than per rule, which is what makes a realistic vault fit.
- 2026-09-20: `PENDING_BUDGET = 50`, under iOS's hard 64 (it silently drops the rest) and under Android's lower practical alarm limit, leaving headroom for the deferred escalation alerts. Dropped entries are reported as `deferred`, not lost silently.
- 2026-09-20: Syncing cancels everything and reschedules rather than diffing — a diff must reconcile OS state, stored handles and a fresh plan, and every bug in that reconciliation is a reminder that never arrives.
- 2026-09-20: `clearAllNotificationIds` is deliberately unfiltered: cancelling invalidates handles on rules the scheduler can no longer see, such as an archived document's, which a scoped clear would leave pointing at nothing. Found by a test, not by inspection.
- 2026-09-20: Past-dated rules are marked delivered rather than fired late; leaving them undelivered would have them reconsidered on every launch forever.
- 2026-09-20: `atLocalTime` builds the fire instant with the multi-argument `Date` constructor, so 09:00 stays 09:00 across a DST transition; the arithmetic alternative (UTC midnight plus nine hours) is an hour out for half the year.
- 2026-09-20: The Jest suite is pinned to `America/New_York` in `jest.config.js` — DST-observing and non-UTC, which is the only way the transition cases are testable, and it stops a UTC CI machine hiding local-time assumptions.
- 2026-09-20: `DEFAULT_REMINDER_HOUR = 9` is a constant beside the offsets; a configurable delivery time is F11's, and the export's "09:00 AM" is static text.
- 2026-09-20: Android channel importance is DEFAULT, not HIGH — HIGH is a heads-up card with sound, and an expiry months away that interrupts the user is a notification they switch off.
- 2026-09-20: Notification payloads carry the route and nothing else; they are readable on the lock screen and in system logs.
- 2026-09-20: Permission is requested after the first successful save, not at launch — the prompt cannot explain itself until there is a document it is about. The document is saved first, so declining costs nothing.
- 2026-09-20: `src/services/notifications.ts` is the only file importing `expo-notifications`, the same containment `Icon.tsx` gives the icon library; everything above it talks to `NotificationPort`, which is what makes the engine testable without a native module.
- 2026-09-20: Daily escalation implemented, synthesised in `computeReminders` rather than stored as rules — switching the flag off leaves nothing to clean up, and a document cannot accumulate 14 rows each time it nears expiry. Entries carry no `ruleIds`.
- 2026-09-20: Escalation is only materialised for expiries within twice the window (28 days). Booking 14 slots for a document expiring in a year would crowd out reminders that matter this month, and the schedule is rebuilt on every launch, resume and edit, so a distant window is never missed.
- 2026-09-20: `listDueReminderRules` deleted. F7 was its intended consumer and needed past-dated rules too, so `listSchedulableRules` replaced it; leaving a second, subtly different "due" query invites the wrong one being used later.
- 2026-09-20: `expo-camera` and `@react-native-ml-kit/text-recognition` added for F8 — both named in CLAUDE.md's stack, neither installed by F0; no other new dependency.
- 2026-09-20: No migration for F8. `items.ocr_raw_text` and `items.ocr_confidence` have existed since migration 001, annotated for this feature and unused until now.
- 2026-09-20: The scanner is a full-screen modal route (`app/(app)/scan.tsx`) and the Scan tab is a launcher for it. Resolves F3's logged contradiction — the export draws the scanner with no tab bar yet puts a Scan tab in every tab bar — and means the camera is mounted only while it is being looked at.
- 2026-09-20: Date ambiguity is flagged, never resolved. `03/04/2029` returns one candidate with `ambiguous: true` carrying both readings, and the confirm sheet renders both as separate buttons. Guessing by device locale is how a visa reminder ends up nine months wrong.
- 2026-09-20: Two-digit years resolve in a window of 80 years back and 20 forward, the same window the MRZ uses — asymmetric because documents are issued to people born decades ago and expire within a decade or two, so `'95'` is 1995 and `'30'` is 2030.
- 2026-09-20: Label proximity is scored per *line*, not per character window. A window wide enough to catch a field's own label also catches the next field's, which made a receipt's purchase date inherit "valid until" and outrank the warranty date. Found by a fixture test.
- 2026-09-20: MRZ check digits (ICAO 9303, 7-3-1) are computed per field and reported per field rather than collapsed into one boolean. A failed digit lowers the score and marks the field unverified; it does not discard the value, which is still the best reading available.
- 2026-09-20: `items.ocr_confidence` holds the *date parser's* ranking, not an OCR confidence. ML Kit returns no numeric confidence of any kind — the export's "98.4% Confidence" is fabricated — so nothing in the UI presents it as one.
- 2026-09-20: Auto-capture is a capped polling loop (1.5s interval, 12 attempts) because the library has no frame processor: `recognize()` takes an image path. The policy is a pure reducer (`autoCapture.ts`) so the loop's cost controls are tested without a timer or a camera.
- 2026-09-20: `AUTO_LOCK_SCORE` sits above a labelled month-name date and below a bare numeric one, so auto mode never locks on a reading the parser deliberately refuses to guess.
- 2026-09-20: All five GoogleMLKit script packs ship unpatched. Only Latin is used, but trimming needs `patch-package` pinned to a 2025 release that breaks silently on upgrade; the size is logged and revisited once a real binary exists.
- 2026-09-20: The scan result reaches the add-item form through a module-level handoff store read in `useFocusEffect`, not through route params. expo-router cannot return a value, and remounting the form with a parameter would discard everything already typed.
- 2026-09-20: `expo-image-picker`'s `cameraPermission` stays `false` and `expo-camera` declares it instead, so one usage string reaches the manifest rather than two. `microphonePermission` and `recordAudioAndroid` are both false: the scanner never records.
- 2026-09-20: `jest.config.js` gained `testPathIgnorePatterns` for `__tests__/fixtures/` — the preset treats every file under `__tests__` as a suite, and F8's parser fixtures are shared data.
- 2026-09-20: Reminder state is a module-level `useSyncExternalStore` like the lock, so any screen can ask for a resync without threading a callback; the state-library choice stays F11's.

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
- F2 is not verified on a device: SQLCipher only exists in a native build, so `PRAGMA key`, the Keychain/Keystore round-trip and a real migration run still need `npx expo run:ios` / `run:android`.
- SQLCipher does not cover attachment files. As of F5 real images are written to `<documentDirectory>/attachments/<itemId>/` **unencrypted** — app-private and covered by iOS file data protection, but readable from a full-device backup or a jailbroken device. Encryption lands at F12.
- A crash between saving the item and inserting its attachment rows can leave image files with no row pointing at them; F12's export should reconcile orphans.
- Expo Go can no longer run the app — `useSQLCipher` requires a dev client or release build.
- Six files still fail `prettier --check` from before F2 (`src/theme/__dev__/Gallery.tsx`, `src/theme/tokens/typography.ts`, `CLAUDE.md`, `docs/PROGRESS.md`, `tsconfig.json`, `assets/expo.icon/icon.json`); left alone to avoid reformatting unrelated code. `src/components/Button.tsx` was formatted incidentally at F6 (whitespace only).
- No `format` npm script yet; formatting is run ad hoc via `npx prettier`.
- `NativeTabs` imports from `expo-router/unstable-native-tabs`; SDK 58 renames this to `expo-router/native-tabs` — a one-line migration when upgrading.
- Android caps native tabs at five and the shell already uses exactly five; a sixth destination forces a redesign, not an addition.
- F3 placeholder strings are inline English, not i18n keys — the i18n layer does not exist until F11.
- F3 is not verified on a device: the native tab bar and the native modal sheet have no JS representation, so tests cover routing only. Needs `npx expo run:ios` / `run:android` plus `npx uri-scheme open expiryvault:///item/abc --ios`.
- `app/dev-gallery.tsx` sits outside both route groups, so it is reachable without passing the lock gate. Harmless while the gate is a placeholder; revisit at F9.
- ~~The dashboard's notification bell is rendered `disabled` until F7.~~ Resolved at F7: it opens the reminders sheet.
- `app/dev-seed.tsx` seeds sample data for device testing. `__DEV__`-gated, linked only from the Settings placeholder's developer section, and never imported by a feature — the shipped dashboard contains no mock data. Remove at F14.
- `expo-symbols` is now used (F3 tab icons) but `@expo/ui`, `expo-glass-effect`, `expo-image`, `expo-device` and `expo-web-browser` remain unused from F0.
- F4 is not verified on a device: it needs a real SQLCipher database, so `npx expo run:ios` / `run:android` plus the dev-seed route is required to see it populated.
- Adding a route still requires running the dev server to regenerate `.expo/types/router.d.ts` before `npm run typecheck` will accept a link to it.
- The add flow's scan option is rendered disabled with a "Coming soon" note until F8 builds the scanner.
- `@expo/ui` is experimental in SDK 57 and now sits behind the date picker; if it breaks, swap the import to `@react-native-community/datetimepicker`, whose props match.
- Only `@expo/glass-effect`, `expo-image`, `expo-device` and `expo-web-browser` remain unused from F0 — `expo-symbols` (F3) and `@expo/ui` (F5) are now in use.
- F5 is not verified on a device: the date picker and the image picker are both native views with no JS representation, and saving needs a real SQLCipher database. Tests cover the form, the schema and the save path only.
- F5 strings are inline English, not i18n keys; the i18n layer arrives at F11.
- Migration 002 is the first multi-version upgrade. It is proven against a real populated SQLite database in tests, but never yet against a real SQLCipher database on a device.
- ~~Archived items keep their reminder rules; F7 must skip them when scheduling.~~ Resolved at F7: `listSchedulableRules` joins `items` on `archived_at IS NULL`, and `computeReminders` excludes them again, each asserted separately.
- F6 is not verified on a device: the SVG ring, `expo-image`, the native confirm dialogs and the date picker all need a real build.
- Only `expo-glass-effect`, `expo-device` and `expo-web-browser` remain unused from F0 — `expo-symbols` (F3), `@expo/ui` (F5) and `expo-image` (F6) are now in use.
- The edit screen does not manage attachments or reminders; both are edited from the detail screen.
- F6 strings are inline English, not i18n keys.

- F7 is not verified on a device. Everything is tested against a fake port; whether the OS actually fires is exactly what Jest cannot assert. Needs `npx expo run:ios` / `run:android`, a near-future fire date to watch one land, and `adb shell dumpsys alarm` to confirm the alarm is inexact.
- The manifest merge is unverified: `blockedPermissions` has not been checked against a real prebuild, only against the package's own AndroidManifest.
- ~~A notification tapped while the vault is locked loses its destination.~~ Not true, now pinned by tests: the lock gate unmounts the runtime, so nothing consumes the OS response, and unlocking remounts the hook which then follows it. Depends on `consumeInitialDeepLink` clearing only after use.
- The rolling window only advances when the app is launched, resumed, or a document changes. A user with more than 50 distinct fire dates who never opens the app will not get reminders past the window. Fixing this needs a background task (`expo-background-task`), which is a new dependency and unverifiable without a device — deliberately not added here.
- `reminder_rules.delivered_at` means "its moment has passed", not "the OS confirmed delivery" — there is no delivery receipt. Only rules whose fire instant is already behind `now` are marked, so the value is accurate for its purpose, but it cannot prove a notification was seen.
- The reminders sheet and all F7 strings are inline English; i18n arrives at F11.
- The existing `timezone independence` block in `dates.test.ts` reassigns `process.env.TZ` mid-test, which Jest ignores — its assertions are pure integer maths and pass in any zone, so the block proves less than its name claims. Left alone rather than refactored; the new pinned zone is what actually varies the offset.

- ~~The add flow's scan option is rendered disabled with a "Coming soon" note until F8 builds the scanner.~~ Resolved at F8: the tile opens `/scan?from=add`.
- F8 is not verified on a device, and it is the feature where that matters most. Three things can only break there: whether `@react-native-ml-kit/text-recognition` — a legacy bridge module (`NativeModules.TextRecognition`, `s.dependency "React"`, `com.facebook.react:react-native:+`) — loads at all under RN 0.86's New Architecture interop; whether the pods resolve with five GoogleMLKit script packs; and what the binary weighs. Needs `npx expo prebuild --clean` then `run:ios` / `run:android`.
- Binary size is unmeasured. The five unconditional script packs are tens of MB on both platforms and cannot be configured through the library.
- `items.ocr_raw_text` holds the MRZ, and the MRZ holds the document number and date of birth. It is inside SQLCipher like everything else and is never logged, but it is a second place sensitive data now lives — the masking rule that applies to `document_number` applies to it.
- The captured image is still an unencrypted file if kept as an attachment; the limitation F5 logged, owned by F12.
- Batch mode from the export is not built. Auto and Manual are the only two chips rendered.
- Auto mode's polling cost is bounded by the attempt cap but never measured on real hardware; thermal behaviour on an older device is unknown.
- The alpha-3 to alpha-2 country map in `parseMrz.ts` covers ~68 issuing authorities, not every ISO code. An unmapped code yields `null` rather than violating `CHECK (country GLOB '[A-Z][A-Z]')`, so the failure mode is a blank field, not an error.
- Only `expo-glass-effect`, `expo-device` and `expo-web-browser` remain unused from F0.
- All F8 strings are inline English; i18n arrives at F11.

## Design gaps
- No Android variants or dark mode in the Stitch export
- Design system is named "Lumina FinTech" (rename to ExpiryVault)
- DESIGN.md contradicts itself: frontmatter says primary `#4648d4`, its own prose says `#6366f1`
- Three palettes across eight screens — frontmatter (4 screens), dashboard violet `#6d28d9`, item-detail indigo `#6366f1`
- `rounded-xl` means 12px, 16px or 24px depending on the screen; frontmatter's 24px matches the rendered cards best
- No bottom sheet, modal or drag handle exists anywhere in the export
- Status colours are never declared tokens, only raw Tailwind utilities, and three of them fail WCAG AA
- Category counts contradict across screens: add flow shows 6 presets, settings says "6 types", profile says "5 collections"
- Three different default reminder sets appear (6mo/3mo/30d/7d in add, 6mo/30d/7d in settings, 60/30/7 in profile); F2 uses the add-flow set
- The timeline implies a post-expiry "grace period" with its own countdown that no other screen defines
- Two contradictory tab bars: the dashboard shows Vault/Stats/Scan/Timeline/Profile, the other three tabbed screens show Vault/Scan/Timeline/Profile/Settings, with different icons for the shared tabs
- Settings is drawn with both a back chevron and an active Settings tab — it cannot be both a tab root and a pushed screen
- The scanner has no tab bar but every tab bar has a Scan tab; it also shows both a back chevron and a "Cancel Scanning" close button
- The dashboard mockup defines no loading, empty or error state anywhere — it is entirely static markup, so all four states in F4 were designed rather than recreated
- The dashboard's category chips and search do not actually filter in the mockup; its only JavaScript toggles a chip's active class and a clear button
- The dashboard shows four records against a stated count of 12, with no pagination or "show more" affordance
- The dashboard's "Enclave Safe" header pill uses an `xs:` breakpoint that is never defined, so it never renders in the mockup itself
- The add-item mockup has no `<form>`, no `required`, no validation, no error states and no disabled states anywhere — every one of those was designed for F5, not ported
- The add-item mockup never records the chosen category: `selectCategory()` only swaps CSS classes, so at save time the selection is unreadable
- Its step navigation is ungated and its header Save is always enabled and bypasses the wizard; `completeVaultSave()` persists nothing and just shows a toast
- Its four reminder fire dates, the "2,633 Days Left" badge and the "99.4% Match" figure are hardcoded strings that nothing recomputes when the expiry changes
- Its expiry field is free text with a dead "Change" button, and "Delivery Time / 09:00 AM" is a static span rather than a control
- Category-to-reminder-preset mapping exists only as subtitle prose, with no data binding of any kind
- The item-detail mockup's delete, edit, "View Original", overflow menu and checklist container all have ids but no behaviour at all
- It has no archive, no renewal history, no delete confirmation and no edit form anywhere — all designed for F6
- Its "Mark as Renewed" button only recolours itself and fills the ring; it never asks for or changes any date, and cannot be undone
- Its progress bar is labelled "Lifetime Elapsed" but its width matches the fraction *remaining*, as does the ring's arc
- Its "2 of 4 Ready" counter and "5 Active Pings" badge are hardcoded and do not move when their own checkboxes are toggled
- Its renewal checklist is hardcoded for one German residence permit, with no per-category template
- Its attachment thumbnails are deliberately blurred behind a frosted overlay and are not tappable

- The dashboard's notification bell has no behaviour in the export at all — the reminders sheet, its permission states and its upcoming list were designed for F7, not ported
- The export has no notification permission prompt, no rationale copy and no denied state anywhere
- The add flow's "Delivery Time / 09:00 AM" is a static span, so the only stated delivery time in the whole export is unbacked by any control

- The scanner export contradicts itself: the passport in frame is a GBR document reading "12 OCT 2021", while the result card asserts "EXP 28 OCT 2030" and "Issuing Authority: DEU (Germany)"
- Its "98.4% Confidence" implies an OCR confidence the engine does not provide; replaced with the MRZ check-digit result, which is the one thing that can actually be verified
- Every script in its `code.html` only toggles CSS classes and shows toasts — no camera, no OCR, every value hardcoded — so all scanner behaviour is designed, not ported
- Its "MRZ Auto-Lock" badge implies live frame analysis; the library reads image files, so auto mode is a capped polling loop instead
- Its Batch Scan mode has no behaviour at all and is not built
- Its document-type dropdown (Passport / Visa / National ID / Insurance Policy) changes nothing in the export

## Device test log
(Feature, iOS version/device, Android version/device, result)
-