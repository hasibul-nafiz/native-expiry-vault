# ExpiryVault Progress

## Current
Feature: none started (F12 complete)
Branch: feat/foundation (F0-F12 all landed here, not on main)
Next: F13 Accessibility + platform polish

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
- [x] F9  App lock (biometric + PIN)
- [x] F10 Timeline + vault health screens
- [x] F11 Settings, i18n (EN + BN)
- [x] F12 Backup/export/restore (password-encrypted .evault, versioned, atomic)
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

- 2026-09-21: `expo-local-authentication` added (named in CLAUDE.md's stack, never installed by F0), plus `expo-screen-capture` for Android FLAG_SECURE and `@noble/hashes` for PBKDF2 — three dependencies, each justified below.
- 2026-09-21: `@noble/hashes` (audited, pure TS, zero runtime deps) rather than stretching with `expo-crypto`: a six-digit PIN is a space of 10^6, and `digestStringAsync` is the only primitive expo-crypto offers, so a useful iteration count would mean thousands of async bridge round-trips. Single-round SHA-256 was the alternative and is exhausted in milliseconds.
- 2026-09-21: `PBKDF2_ITERATIONS = 100_000`, well under OWASP's 600,000 — that figure costs seconds in JS on Hermes. The stored record carries its own `iterations`, and `verifyPin` uses the record's value, so the count can be re-tuned after device measurement without invalidating existing enrolments.
- 2026-09-21: The PIN hash is the second lock, not the first. It sits in the Keychain beside the SQLCipher key, so anyone who can read it can already read the vault; the stretching buys time against an offline attack on a stolen record, and nothing more.
- 2026-09-21: `jest.config.js` rewrites the preset's `transformIgnorePatterns` to add `@noble` rather than restating the allowlist, so a jest-expo upgrade that extends that list is not silently reverted here.
- 2026-09-21: `LockStatus` has three values. Reading the PIN record is async, so `unknown` holds the splash in `app/_layout.tsx`; defaulting to unlocked rendered the dashboard for a frame before hiding it.
- 2026-09-21: `lockVault()` is a no-op when no PIN is enrolled — otherwise an auto-lock strands the user on a gate with nothing to verify them against. Asserted separately.
- 2026-09-21: App lock is opt-in. No PIN means no gate, no prompt and no FLAG_SECURE; blocking every Android screenshot for a user who declined the lock is a cost with no matching benefit.
- 2026-09-21: Grace period is 60s and only a true `background` starts it. iOS reports `inactive` for the app-switcher peek, Control Centre — and the Face ID sheet itself, so starting the timer there would have the prompt re-lock the vault it was opening. The store carries an `authenticating` flag the listener respects, for Android's BiometricPrompt, which genuinely backgrounds the app.
- 2026-09-21: `shouldShieldContent` and `startsGracePeriod` are two predicates over the same `AppState` precisely because they disagree on `inactive`: the shield must be up for it, the timer must not start on it. Collapsing them into one is the bug the split exists to prevent.
- 2026-09-21: Backoff is 5 free attempts then 30s/1m/5m/15m/30m, persisted to secure-store — a counter a force-quit resets is not a delay. No wipe-after-N: the vault is the user's only copy, and destroying it over nine mistypes is a larger loss than the attack it prevents.
- 2026-09-21: `remainingLockoutMs` clamps to the duration that was imposed, so winding the clock back restarts the wait instead of stranding the user for years. Winding it forward still skips the lockout; that needs a monotonic clock the platform does not offer, and is logged rather than pretended away.
- 2026-09-21: A failed biometric does not spend a PIN attempt. The sensor runs its own lockout, and a face the camera misread is not evidence of someone guessing the PIN. A biometric reported `unavailable` stops being offered at all.
- 2026-09-21: Biometrics are not offered while a timeout is running — otherwise they are a way straight past the backoff.
- 2026-09-21: `disableDeviceFallback: true` and `biometricsSecurityLevel: 'strong'`. The app's own PIN is the fallback, so the OS must not also offer the device passcode, which proves nothing about this vault; and a Class 2 camera face unlock is weaker than the six digits it would bypass.
- 2026-09-21: Weak PINs are refused at enrolment (repeats, ±1 runs, and a twelve-entry denylist). Backoff cannot protect a PIN that is inside the first five guesses on any published list.
- 2026-09-21: A malformed PIN record parses to `null` — "no PIN enrolled" — where a malformed database key raises. The key is irreplaceable and overwriting it destroys the vault; the PIN record is a verifier for a secret the user still knows, so leaving them permanently unable to enrol is the worse failure.
- 2026-09-21: `src/services/biometrics.ts` and `src/services/screenCapture.ts` are the only importers of their libraries, the same containment `notifications.ts` and `Icon.tsx` give — which is what makes every unlock path testable with no hardware.
- 2026-09-21: `blockedPermissions` gained READ_EXTERNAL_STORAGE, READ_MEDIA_IMAGES and DETECT_SCREEN_CAPTURE. `expo-screen-capture` declares all three for its screenshot-*detection* API, which F9 never calls; left in, they advertise gallery access on the Play listing of an app that does not read the gallery, and READ_MEDIA_IMAGES obliges a Play Console declaration for something the app does not do.
- 2026-09-21: `buildPinRecord` takes `iterations` as a parameter so component tests run the real derivation and comparison at a token count. At full strength one screen test that mistypes a PIN five times spends several seconds deriving; `pin.test.ts` is what pins the shipped constant.
- 2026-09-21: `dev-gallery` and `dev-seed` moved into `(app)`. Route groups carry no URL segment, so the paths are unchanged, but they are now behind the gate — this closes F3's logged "revisit at F9".
- 2026-09-21: Settings gained one real row linking to enrolment. F9's flow is unreachable without an entry point and Settings is where it belongs; F11 restyles it with the rest of that screen.

- 2026-09-22: Vault health is a deduction score, not a ratio: expired -12 (cap -48), soon -4 (cap -20), no reminder -6 (cap -24), notifications denied -15 flat, clamped to 0-100. Four expired documents is four things to do whether the vault holds five or fifty, and a ratio sends a one-document vault to 0 on a single lapse.
- 2026-09-22: The caps exist so a long-neglected vault does not sit at 0 with no way to see progress — clearing the first few items always moves the number. `capped` is reported per deduction so the UI can say the penalty stopped growing.
- 2026-09-22: An empty vault scores `null`, not 100. A vault with nothing in it is not healthy, and the card shows onboarding copy instead of a perfect number.
- 2026-09-22: The score renders as a bare number, not the export's "92%". It is a points total, not a proportion of anything. The export's 92 is unreproducible from any data it shows (12 docs / 1 soon / 0 missing scores 96 here), so the weights are designed, not ported.
- 2026-09-22: Every deduction is named, counted and priced in a breakdown card. A deduction-based formula is only worth choosing if the breakdown is shown; otherwise it is a magic number with extra steps.
- 2026-09-22: The notification penalty is flat and only applies when at least one reminder rule exists — no rules means nothing to deliver, so a denied permission costs nothing.
- 2026-09-22: The five timeline month bands are derived from the export's own months, not invented: it labels 42 days "Action Required" and 71 days "Upcoming Review", so the cut falls between them — exactly where `SOON_THRESHOLD_DAYS` already sits. Its ~400-day and ~4.5-year months place the other two cuts at 365 and 1095 days.
- 2026-09-22: Only two new colour tokens were added (`review`, `secure`). The other three bands *reference* `statusLight`/`statusDark` rather than restating hexes, so a month header and a document badge describing the same urgency cannot drift. Asserted by identity, not equality, in `contrast.test.ts`.
- 2026-09-22: `TimelineBand` lives in `src/theme/tokens/timeline.ts`, the same containment `DocumentStatus` has — the band model cannot drift from the colours that render it. The three-status model is unchanged; a band is a presentation of a whole month, never a fourth status.
- 2026-09-22: Both new tones are contrast-tested in light and dark, and `buildBandPalette` is asserted to resolve all five bands to AA-passing pairs, so a bad value fails CI rather than shipping.
- 2026-09-22: The timeline groups expired items into their own past month rather than an "overdue" bucket, which is what puts lapsed documents at the top of the feed where the export draws them. A month takes the tone of its most urgent item.
- 2026-09-22: Range chips filter in JS over the already-fetched rows, not as extra queries — F4's rule, so a chip's count and the feed it filters cannot disagree across a midnight boundary. "Next 30 days" deliberately includes overdue items.
- 2026-09-22: The export's "2026+" chip label is built from `today`, not hardcoded; it is only correct in the year it was drawn.
- 2026-09-22: `groupByMonth` validates each expiry through `daysUntilExpiry`, so an unparseable date throws rather than forming a group nothing can render.
- 2026-09-22: The Profile tab keeps its label (F3's five-tab set is untouched, and Android caps at five) but the screen is headed "Vault Health". There is no profile anywhere in the schema and F4 already declined to invent one.
- 2026-09-22: "Log Out of Vault" became "Lock now", wired to F9's `lockVault()` — the only honest reading of it in an app with no account.
- 2026-09-22: The Schengen card renders only when `travel_stays` has rows. `schengenUsage` has been tested since F2 but nothing writes stays yet, and a card permanently reading "0 of 90 days used" is worse than no card.
- 2026-09-22: Both screens keep their header in every state (loading, error, empty), as the dashboard does, so a database that never opened does not blank the screen.
- 2026-09-22: No migration and no new dependency in F10. Every column it reads has existed since migration 001 or 002, and `countItemsWithoutReminders` was written at F2 annotated for this screen.

- 2026-09-22: Preferences live in a plain JSON file (`expo-file-system`), NOT the `settings` table F2 deferred to F11. Theme and language have to apply to the lock screen, which renders above `DatabaseProvider` — reading them from SQLCipher would paint the gate in the wrong theme and language before the vault opens. None of the five values is a secret, so no migration and no new dependency.
- 2026-09-22: `parsePreferences` never throws and never returns a partial object; one invalid field falls back alone, so a file written by a newer version cannot reset the user's other choices.
- 2026-09-22: A failed preferences write is swallowed. The change still applies for the session, and losing a theme preference is not worth an error dialog — nor a rejected promise inside an onPress handler.
- 2026-09-22: Scope split as planned (F11a infra + EN, F11b BN) but both landed in one pass; the split shaped the order of work, not the branch.
- 2026-09-22: Only EN and BN ship. Dutch was dropped at the user's request mid-plan; `supportedLocales` is the single source the missing-key test reads, so adding NL later is one array entry plus one file.
- 2026-09-22: `i18next` + `react-i18next` + `expo-localization` added, plus `@expo-google-fonts/noto-sans-bengali` — four dependencies, each named in the plan.
- 2026-09-22: Noto Sans Bengali is loaded at all four weights. Inter has no Bengali coverage whatsoever, so without it every Bengali string renders as tofu or falls back to an unstyled system face. `bengaliFontFamilies` is keyed by the Inter family name each typography variant already carries, so a variant needs no Bengali twin and the two cannot drift.
- 2026-09-22: All `Intl` formatters are pinned to Latin digits with `-u-nu-latn`. Bengali's default numbering system is `beng`, so counts, scores and years would otherwise render as Bengali numerals — mixing with any raw interpolation that escaped, and making every numeric assertion locale-dependent.
- 2026-09-22: One flat i18next namespace. The app has a few dozen screens and namespaces buy lazy-loading it cannot use — there is no network to fetch from, so every catalogue is bundled regardless.
- 2026-09-22: `interpolation.escapeValue: false`. i18next escapes for HTML by default, which is meaningless in React Native and actively wrong: it turns an apostrophe in a document title into `&#39;`.
- 2026-09-22: `count` is reserved by i18next for plural selection, so digit counts (PIN length) interpolate as `{{digits}}`. Using `count` there sent the lookup down a plural path with no `_one`/`_other` and rendered the raw key. Found by a test, not by inspection.
- 2026-09-22: Label modules (`lock/labels.ts`, `timeline/labels.ts`, `vault-health/labels.ts`) kept their *rules* and take `t` as a parameter; only the copy moved to `src/i18n/locales`. Which attempt count warrants a warning, and how a duration splits into minutes and seconds, are logic worth testing independently of language.
- 2026-09-22: Dates reach the user through `Intl` everywhere. Before F11 the dashboard, item detail, the urgent card and the renew sheet all rendered raw `YYYY-MM-DD`. The formatters are cached per locale-and-shape because they are constructed once per row.
- 2026-09-22: `formatMonthHeading` replaces F10's hardcoded English month array on the timeline.
- 2026-09-22: The missing-key test reads `supportedLocales` rather than a hardcoded list, and checks four things: no missing key, no extra key, no empty value, and — the two that matter — every `{{placeholder}}` preserved and both plural forms present wherever English has them. A dropped placeholder reads fine in review and renders a literal `{{count}}` at runtime.
- 2026-09-22: `src/i18n/testing.ts` gives pure-label tests a real `t` bound to a locale rather than a stub that echoes its key. A stub would let a missing key, a broken plural or a dropped interpolation pass — exactly what these functions exist to get right.
- 2026-09-22: `react/jsx-no-literals` plus a `no-restricted-syntax` selector over the seven user-facing props fails `npm run lint` on a bare string. A one-off sweep would only hold until F12; the rule is what keeps the guarantee. It found ~50 strings the ad-hoc scan missed.
- 2026-09-22: The privacy policy is a bundled, translated in-app route, not a link. The app makes no network requests at all, so a policy readable only online would be the one thing in a privacy-first app that needs the internet. F14 still needs a hosted copy for the store listings; this screen is its source of truth.
- 2026-09-22: Settings pickers are bottom sheets, not pushed routes — every list is short, and a whole route for four radio options is more navigation than the choice deserves.
- 2026-09-22: Changing the delivery hour asks the scheduler to rebuild (`requestReminderSync`), since every pending notification is invalidated. F7 rebuilds wholesale rather than diffing, so nothing else is needed.
- 2026-09-22: Biometric unlock is now an independent toggle, closing F9's logged gap. The row is disabled with an explanation when no hardware is enrolled.
- 2026-09-22: Auto-lock delay and reminder hour needed no refactor: `useAutoLock` already took `graceMs` and `computeReminders` already took `options.hour`.
- 2026-09-22: `jest.setup.ts` initialises i18next synchronously, pins `expo-localization` to `en-US`, mocks the preferences storage and primes the store. Without the last two, `RootLayout` holds its splash on an unresolved file read and route-level assertions race it under load — a flake, not a failure, which is worse.
- 2026-09-22: The version string comes from `expo-constants` (`1.0.0`), not the export's fabricated "v2.4.0 • Build 8421". No build number is configured yet.

- 2026-09-22: `.evault` is a binary framed container — magic, plaintext header, then length-prefixed AEAD frames — not a JSON envelope with base64 attachments. Bounded memory, no 33% base64 inflation, and the frame index in the associated data makes reordering or truncation an authentication failure.
- 2026-09-22: The plaintext header carries the KDF parameters and nothing else. No counts, no dates, not even the frame count — an encrypted backup whose header advertises "47 documents, created 2026-09-22" leaks the thing it exists to protect. The frame count lives in the encrypted manifest instead.
- 2026-09-22: Frame 0 seals a known constant and is the password check. Without it a wrong passphrase and a damaged manifest are the same event, and the app would have to guess — telling someone to check a passphrase that is already correct is a loop with no exit. It costs 32 bytes and gives an attacker no oracle they did not already have.
- 2026-09-22: XChaCha20-Poly1305 over PBKDF2-HMAC-SHA256, via `@noble/ciphers` (one new dependency, same author and audit lineage as F9's `@noble/hashes`). ChaCha because this is JavaScript on Hermes with no AES-NI to reach, and a backup with attachments is tens of MB of symmetric work. `expo-crypto` has no symmetric cipher at all.
- 2026-09-22: `PBKDF2_ITERATIONS = 300_000`, half OWASP's figure and deliberately so; the count is in the header, so raising it later applies to new backups without orphaning old ones. Not memory-hard, which is why the passphrase minimum is 12 characters rather than F9's six digits.
- 2026-09-22: Argon2id was declined: a third dependency (`hash-wasm`) whose WASM path is the least proven thing on Hermes. Logged as the weakest link in the feature — a short passphrase gets less protection here than it would under Argon2.
- 2026-09-22: `expo-document-picker` was **not** added. `expo-file-system` 57 ships `File.pickFileAsync` with the same system UI and the same "`.evault` has no registered MIME type" caveat, and was already a dependency.
- 2026-09-22: `expo-sharing` added (the only way to attach a file to the share sheet on Android; RN's own `Share` takes `message`/`title` there). Its config plugin is **not** registered: that plugin only builds an inbound share *extension*, which this app does not have.
- 2026-09-22: The SQLCipher key, the PIN record and every `notification_id` are excluded from the file. The first two are device-local secrets; the third is a handle into the OS scheduler of the device that wrote it, so it is exported as null and F7 rebuilds the schedule wholesale.
- 2026-09-22: Preferences travel in the backup. Restoring onto a new phone in the device default language rather than the one the user chose is a worse failure than the small amount they reveal.
- 2026-09-22: Restore replaces everything in one transaction; merge was declined. A merge needs a documented answer for every collision (same id different content, same document different id) that the file format cannot supply, and doubles the test surface.
- 2026-09-22: Attachments are staged into a sibling directory and swapped in **after** the commit. A filesystem move cannot join a SQL transaction, so ordering is what makes failure survivable: up to and including the commit every failure leaves the vault untouched. The one window is a crash between commit and swap, which leaves rows pointing at files not yet in place — reported, not corrupting.
- 2026-09-22: `src/db/repositories/backup.ts` is the only whole-table reader. Adding an `all` option to eight existing functions would make it reachable from a screen; a separate module keeps the intent explicit and the SQL in the repository layer.
- 2026-09-22: Zod runs **after** migration, not before and after as first planned. An older payload is supposed to fail the current schema — that is what the migration is for — so validating first would reject exactly the files versioning exists to keep readable. Migrations take `Record<string, unknown>` and assume nothing instead.
- 2026-09-22: The import schema validates referential integrity and uniqueness as well as column constraints, because foreign keys are on for the connection and SQLite would otherwise be the thing to notice — aborting a restore the user had already confirmed with a `DatabaseError` instead of a message about the file.
- 2026-09-22: Zod 4 runs an object's refinements even when a field has already failed, so `compareDates` was being handed dates it had just rejected and threw `InvalidDateError` out of validation. Cross-field rules now stand aside when a field is already invalid. Found by a test.
- 2026-09-22: The schema is stricter than SQLite in exactly one place: JavaScript's `trim()` treats U+00A0 as whitespace and SQLite's does not, so a title of one non-breaking space is rejected here and accepted there. Stricter is the safe direction.
- 2026-09-22: `payloadMigrations` is empty and the runner is tested against chains the test supplies, as `migrate.test.ts` does. Version 1 is the only shape that has existed; a fabricated version 0 would prove nothing about the day a real migration is written.
- 2026-09-22: A real v1 container is committed as bytes (`__tests__/fixtures/v1Container.ts`) and asserted to open, restore and reject a wrong password. A fixture regenerated by the current code only proves today's code agrees with itself. **Do not regenerate it** — if it stops opening, that is a breaking format change needing a version bump.
- 2026-09-22: The export is written to the cache directory and deleted as soon as the share sheet closes, including when sharing fails. It is a complete copy of the vault protected by one passphrase; leaving it in permanent storage doubles the attack surface for the life of the install.
- 2026-09-22: Export drops attachment rows whose file is gone and reports the count, and reports files under the attachments root that no row points at. This closes the orphan reconciliation open since F5, in both directions.
- 2026-09-22: `count` is reserved by i18next for plural selection — again. The passphrase-length strings rendered nothing until renamed to `{{length}}`, the same trap F11 logged. The label test now asserts the placeholder is actually filled, which is what would have caught it.
- 2026-09-22: Backup/restore is reachable only from a Settings row behind the lock gate, asserted by a navigation test: restore replaces the whole vault, so reaching it unlocked would be a way to destroy data without proving who you are.
- 2026-09-22: This gives F9's "no PIN recovery" a real answer at last. It still cannot mean "recover my PIN"; it now means erase and restore, which is something rather than nothing.

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

- ~~`app/dev-gallery.tsx` sits outside both route groups, so it is reachable without passing the lock gate. Harmless while the gate is a placeholder; revisit at F9.~~ Resolved at F9: both dev routes moved into `(app)`, asserted by a navigation test.
- F9's iOS app-switcher cover is best-effort and is the weakest claim in the feature. The snapshot is taken at `resignActive` and React Native cannot promise a commit before then, so a fast enough swipe can capture the frame underneath. Closing it needs a native view added in `AppDelegate` via a config plugin — deliberately not written without a device to verify it on. Android is solid: FLAG_SECURE blanks the recents thumbnail outright.
- The PBKDF2 cost is unmeasured on real hardware. 100,000 iterations is ~100ms in Node and unknown on Hermes, where it could plausibly be 1-2s on an older Android. If it is, lower `PBKDF2_ITERATIONS` — the stored record is self-describing, so existing enrolments keep working.
- The lock is a UI gate, not a crypto boundary. `DatabaseProvider` opens the database above the gate, so it is decrypted and open while locked. Making it a real boundary means `requireAuthentication: true` on the SQLCipher key (deferred at F2), which gates cold start on biometrics and stops the reminder scheduler running at launch. Not attempted here.
- Winding the device clock forward skips a lockout. There is no monotonic clock available, so the backoff can only be honest about it; winding backwards is handled and tested.
- Biometric hardware, the Keychain round-trip, the real app-switcher snapshot and FLAG_SECURE are all unverifiable in Jest. F9 needs `npx expo run:ios` / `run:android`, plus a device with Face ID or a fingerprint enrolled and one with neither.
- `NSFaceIDUsageDescription` is declared through the `expo-local-authentication` plugin but has not been checked against a real prebuild — the same gap F7 logged for `blockedPermissions`, now covering four more blocked permissions.
- `/set-pin` is a new route, so `npm run typecheck` will only check the link once the dev server has regenerated `.expo/types/router.d.ts`. Until then it falls back to `string`.
- There is no PIN recovery, by design and by necessity: the data is local-only and the PIN is not the database key, so "forgot" can only mean erase and start over. Revisit at F12, when backup/restore gives it something to restore from.
- All F9 strings are inline English, collected in `src/features/lock/labels.ts` so F11's extraction is one file.
- Biometrics cannot be turned off independently of the PIN. If hardware is enrolled with the OS, the prompt is offered; a separate toggle belongs with F11's settings.

- F10 is not verified on a device: the feed, the rail, the five band tones and the health card have only been seen in the test renderer. Needs `npx expo run:ios` / `run:android` plus the dev-seed route to see either screen populated.
- The health weights are a designed judgement, not a measured one. No user has ever seen the score, so whether -12 for an expired document *feels* right against -6 for a missing reminder is unvalidated. The weights are constants in one object and the stored score is derived, never persisted, so retuning them costs nothing.
- An expired document with no reminder rule is charged under both `expired` and `missingReminders`. That is deliberate — they are two separate things to fix — but it means the two counts can exceed the vault size.
- The score is recomputed on every focus and never stored, so there is no history and no "up from 85 last month". Adding that needs a table and a write on a schedule, which is a background task the app deliberately does not have (the limitation F7 logged).
- `travel_stays` still has no writer. `createTravelStay` and `schengenUsage` are both tested, but until something records a trip the Schengen card can only appear via a seeded or dev database.
- The timeline holds every active item in memory and groups in JS. Correct and fast for the tens of rows a real vault holds; a vault with thousands would want a windowed list and a grouped query, which is not worth building blind.
- The feed is a plain mapped `View` inside a ScrollView, not a `SectionList`. Simpler and correct at this size, but it renders every card up front — revisit if the in-memory grouping above ever becomes a problem.
- Both screens' strings are inline English, collected in `src/features/timeline/labels.ts` and `src/features/vault-health/labels.ts` so F11's extraction is two files. Month names are a hardcoded English array and need `Intl` or i18next at F11.
- `VaultHealthScreen.test.tsx` mocks `notificationPort` through a module factory with a `mock`-prefixed variable, because the screen resolves the port through `useVaultHealth`'s default rather than taking it as a prop. Adding a test-only prop to the screen was the alternative and was not worth it.
- The vault-health screen links to `/set-pin` and duplicates the row Settings already has. F11 owns Settings and should decide which of the two survives.
- The export's rows for Document Categories and Expiry Alerts are not rendered — both are F11's, and a row that goes nowhere is worse than no row.

- **`bn.json` is unreviewed machine-quality and must NOT ship to either store without a native-speaker pass.** Structure, plurals and interpolation are correct and tested; the wording is my own and has had no review. This is the single largest known risk in F11.
- F11 is not verified on a device. Noto Sans Bengali rendering, the real preferences file, the Intl output on Hermes (which ships a different ICU build from Node) and the OS language picker all need `npx expo run:ios` / `run:android`. Hermes ICU is the one most likely to differ from what the suite asserts.
- Bundle size is unmeasured. Four Noto Sans Bengali weights are a few hundred KB each and are loaded unconditionally, even for an English user. Subsetting or loading the Bengali family only when the locale is `bn` is the obvious fix and needs a real build to justify.
- Preferences sit in an unencrypted JSON file. Theme, language, reminder hour, auto-lock delay and the biometric flag leak nothing a screenshot would not, but it is a second store outside SQLCipher and should be stated rather than implied.
- `useLocale` calls `getLocales()` on every render. It is a synchronous read of a loaded native constant, but it is not free, and `Text` calls `useLocale` — so every text node in the tree does it. Worth measuring on a device before it becomes a habit.
- `Text` resolves the Bengali family per render. Correct, but it means the font swap is a render-time branch rather than a theme-level one; if it shows up in a profile, move it into `buildTheme`.
- The `settings` and `categories` tables F2 deferred to F11 were never built. Categories management is still unimplemented and the export's "Manage Categories / 6 types" row is not rendered.
- 11 literals remain in the scan: 6 are false positives (the scanner's regex matches the TypeScript generic `Promise<…>`) and 5 are in `app/(app)/dev-seed.tsx`, which is `__DEV__`-only and removed at F14. The ESLint rule excludes the dev routes for the same reason.
- The lint rule covers JSX children and seven props. It cannot see a string built in a variable and passed in, or a template literal assembled outside JSX — so it raises the floor, it does not prove the absence of hardcoded copy.
- `formatDate` renders `en` as `Jan 5, 2027` (US ordering), because the catalogue key is `en` rather than `en-GB`. Fine for a worldwide audience but it is a choice, not a default.
- Bengali plurals use CLDR `one`/`other`, the same two categories as English, so no catalogue restructuring was needed. A locale with more categories (Arabic, Russian, Polish) would need more `_` suffixes and the missing-key test would catch it.
- The privacy policy text is prose I wrote and has had no legal review. It describes what the app actually does, but F14 should have it checked before it backs a store listing.
- `docs/PROGRESS.md` and five other files still fail `prettier --check` from before F2; unchanged here.

- **F12 is not verified on a device, and two of its unknowns are the kind that only appear there.** The PBKDF2 cost at 300,000 rounds and the ChaCha throughput per megabyte are both unmeasured on Hermes; a slow export is the most likely thing to look broken on real hardware. Needs `npx expo run:ios` / `run:android` with a vault holding real photo attachments.
- The whole container is built in memory before it is written, and read into memory before it is opened. Frames bound the *plaintext* working set, not the file itself, so a vault with hundreds of megabytes of scans could still be a problem on a low-memory device. Streaming the file read and write is the fix and needs a real measurement to justify.
- The share sheet, the system file picker and the directory swap are all native and have no JS representation; tests cover them through the port only.
- ~~SQLCipher does not cover attachment files... Encryption lands at F12.~~ Partly resolved: attachments are encrypted **in the backup file**. The working copies in `<documentDirectory>/attachments/` are still plaintext on disk. Encrypting them at rest is a separate change and was not in F12's brief.
- ~~A crash between saving the item and inserting its attachment rows can leave image files with no row pointing at them; F12's export should reconcile orphans.~~ Resolved at F12: export reports orphan files and skips rows whose file is missing; a restore replaces the directory wholesale, which clears them.
- ~~There is no PIN recovery... Revisit at F12, when backup/restore gives it something to restore from.~~ Resolved at F12, in the only way it can be: erase and restore from a backup. There is still no way to recover a forgotten PIN itself.
- The backup passphrase is protected by PBKDF2, which is not memory-hard. A 12-character minimum is doing the work Argon2id would otherwise do, and a determined offline attacker with a GPU gets more leverage here than they would against Argon2. Stated rather than implied.
- JavaScript cannot guarantee the derived key or the passphrase are wiped from memory after use. Neither is logged, stored or cached, but "zeroised" would be a claim the runtime cannot back.
- The salt and nonce in the header are unauthenticated, necessarily — they must be read before a key exists. Tampering with either makes the file fail to open, which is reported as a wrong password. That is accurate but not the true cause, and is asserted as such in a test.
- A crash between the restore's commit and the directory swap leaves rows pointing at files that are not in place. `restoreVault` reports missing files after the swap, but nothing re-checks on the *next* launch — a startup reconciliation would close it and was not built.
- Restore does not verify that the backup came from this app rather than a crafted file with valid structure. It cannot: there is no signing key, and adding one would mean either shipping a secret in the binary or building key management the product does not have. Validation is what stands in for it.
- The new Bengali strings are machine-quality like the rest of `bn.json` and carry the same warning: no native-speaker review.
- The backup screen has no progress indicator beyond a button spinner. `exportVault` and `restoreVault` both report progress per file and nothing consumes it yet — worth wiring once a device measurement shows how long a real export takes.
- The `.evault` extension is not registered with either platform, so the picker filters on `*/*` and the OS will not offer ExpiryVault as a handler for the file. Registering a document type is a config-plugin change belonging with F14's store work.

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
- ~~The timeline implies a post-expiry "grace period" with its own countdown that no other screen defines~~ Resolved at F10: not ported, since nothing in the schema or any other screen backs it.
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

- The lock export states "Your offline vault is locked with AES-256 GCM encryption". It is not: the vault is SQLCipher, which is AES-256-CBC with HMAC-SHA512. Not ported — a false crypto claim in the UI of a privacy-first app is the worst line in the export
- Its "ZERO-KNOWLEDGE STORAGE" badge is a term with a specific meaning that does not apply to a local encrypted SQLite file. Not ported
- Its profile card (avatar, "Isha Manzoor", "Encrypted Enclave") requires a profile that exists nowhere in the schema — the same gap F4 logged and declined to invent. Not ported
- Its "v2.4" pill is fabricated and matches no version the app has. Not ported
- Its "Restore from airgapped seed phrase" needs a seed phrase that does not exist anywhere in the product and cannot be added without redesigning the database key. Not ported
- Its "Forgot PIN?" implies a recovery path that cannot exist while the data is local-only and the PIN is not the database key. Not ported; revisit at F12
- Its keypad prints dialler letters (ABC, DEF) and a "+" under the zero. Nothing dials and a PIN cannot be spelled. Not ported
- Its gradient CTA stays a solid `primary` fill; F1's deferral of `expo-linear-gradient` is not reversed inside a feature
- It hardcodes "Unlock with Face ID" on every device. F9 derives the label from the enrolled hardware and renders no button at all when there is none
- It has no enrolment screen anywhere — choosing, confirming and removing a PIN were all designed for F9, not ported
- It defines no wrong-PIN state, no timeout state, no error copy, no disabled state and no dark mode; every one of those was designed
- Its only JavaScript increments a counter and swaps CSS classes: no verification, no storage, no biometric call, and the Face ID buttons simply fill all six dots

- The timeline's "grace period" is not ported. Its MacBook card shows "Expired Oct 8 · Grace Period / 4 Days Left" and the banner calls it a "critical 4-day grace period", but no other screen defines the concept and the schema has no field for it. An expired document reads as expired.
- Its "Immigration Queue Buffer — High Load Warning" meter has no data source of any kind and is not built
- Its "Open Diagnostic Link" needs an external URL, which no column holds and which v1 could not open anyway (no network)
- Its per-card prose ("Consulate appointment needed 30d ahead. Earliest booking slot recommended: Oct 22.") is hardcoded for one document with nothing behind it
- Its "Auto-Renew Opt" and "Permanent Track" pills need an auto-renew flag that does not exist; "ID #DE-891" does map to `document_number`, which is masked everywhere else, so it is not surfaced here either
- Its Calendar Sync card, "Export .ics" button and "Zero-Cloud Airgapped ICS Export" label are an export feature and belong to F12
- Its "Dense" view-density toggle only swaps CSS classes; not built
- Its filter chip counts do not add up (All 12, but This Year 4 + 2026+ 6 = 10) and its only JavaScript toggles `display` on hardcoded nodes
- The vault-health export's "92%" is computed by nothing and is unreachable from its own stated figures; the formula and every band below "Good State" were designed for F10
- Its profile card (avatar, "Isha Manzoor", email, PRO badge, "Enclave Vault Active", Edit) needs a profile that exists nowhere in the schema — the gap F4 and F9 both logged. Not ported
- Its "Emergency Dossier Export / Generate Dossier PDF" is F12's; its only script shows a toast
- Its "Log Out of Vault" implies an account. Rendered as "Lock now" instead
- Its "Remind 60, 30, and 7 days prior" is a third contradictory reminder set (the add flow and settings state two others); F2's add-flow set stands
- Its "5 collections active" contradicts the add flow's 6 presets and settings' "6 types" — the count already logged as drift
- Its Schengen card shows "42 of 90 days used" against no recorded trips anywhere in the product
- Neither export defines a loading, empty or error state; all of them on both screens were designed

- The settings export's "AES-256" badge repeats the lock screen's false crypto claim. The vault is SQLCipher (AES-256-CBC with HMAC-SHA512); not ported, and the privacy screen states the real algorithm
- Its "ExpiryVault v2.4.0 • Build 8421" is fabricated — the real version is 1.0.0 and no build number is configured. The row reads the version from `expo-constants` instead
- Its search bar ("Search settings, alerts, formats...") searches a dozen static rows; not built
- Its "Date Format / DD/MM/YYYY" picker conflicts with deriving the format from the locale, which is what `Intl` does and what a worldwide audience expects. Not ported
- Its "Urgent Alarm Sound / Chime for final 48-hour expirations" needs a per-notification sound the app does not configure; F7 deliberately chose DEFAULT channel importance, and a chiming expiry reminder is one users switch off
- Its "Smart Expiry Reminders" master switch would silently disable every reminder with no other indication; reminders are governed by the OS permission and per-item rules instead
- Its "Manage Categories / 6 types / + New Category / Reorder" needs the `categories` table F2 deferred and never built. Not rendered rather than rendered dead
- Its "Backup & Cloud-Free Export / Encrypted .evault file generation" is F12
- Its "Theme & Appearance" subtitle reads "Lumina Light Mode", the design system's own name, which F1 already logged as needing a rename
- Its language row shows a US flag for "English (US)". Flags are countries, not languages; the picker lists language names in their own script instead
- It draws both a back chevron and an active Settings tab — the contradiction F3 logged; the tab root wins and no chevron is rendered
- It defines no loading, empty or error state, and its only JavaScript toggles CSS classes

- The export has no backup screen anywhere. The entire feature is one settings row reading "Backup & Cloud-Free Export / Encrypted .evault file generation", so every screen, sheet, confirmation and failure state in F12 was designed rather than recreated
- ~~Its "Backup & Cloud-Free Export / Encrypted .evault file generation" is F12~~ Resolved at F12: the row now leads to a real screen, and the file really is an encrypted `.evault`
- The export never says what the backup contains, how it is encrypted, or what restoring one does to the existing vault — the three things a person needs before agreeing to either direction
- The timeline's "Export .ics" button and "Zero-Cloud Airgapped ICS Export" label were logged as F12's but are a calendar feature, not a backup one; not built, and re-filed rather than smuggled in
- Vault health's "Emergency Dossier Export / Generate Dossier PDF" was likewise logged as F12's. It is a document-generation feature with no format, no template and no stated contents anywhere in the export; not built
- The lock export's "Restore from airgapped seed phrase" is still not portable to anything real — a backup is protected by a passphrase the user chooses, not by a seed phrase the app generates, and nothing in the schema holds one

## Device test log
(Feature, iOS version/device, Android version/device, result)
-