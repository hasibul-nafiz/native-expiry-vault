# Versioning — buildNumber / versionCode

## What's already handled

`eas.json` sets:

```json
{
  "cli": { "appVersionSource": "remote" },
  "build": { "production": { "autoIncrement": true } }
}
```

`appVersionSource: "remote"` means EAS — not `app.config.ts` — is the source
of truth for `ios.buildNumber` and `android.versionCode`. With
`autoIncrement: true` on the `production` profile, every `eas build
--profile production` bumps both automatically. **No manual buildNumber or
versionCode needs to be set or incremented in `app.config.ts` — doing so
would fight the remote counter, not help it.**

The human-facing `version` field (`1.0.0` in `app.config.ts`) is the one
value that *is* still yours to bump by hand — see the procedure below.

## What was missing: `runtimeVersion`

`app.config.ts` had no `runtimeVersion` policy. EAS Build/Submit expects one
to be resolvable even for an app with no `expo-updates` OTA channel
configured, because `eas submit` reads it to stamp the build's compatibility
metadata; its absence doesn't hard-fail a plain `eas build`, but leaves a
gap `eas update` (if ever adopted) would immediately hit, and some
`eas submit` validation paths warn on it.

Added: `runtimeVersion: { policy: 'appVersion' }` — the runtime version
tracks the human `version` string directly (`1.0.0` → runtime `1.0.0`).
Since this app ships no OTA updates, the policy choice has no behavioral
effect today; it exists so the field isn't unset if OTA updates are ever
turned on later, and so `eas submit` has a definite answer rather than an
implicit one.

## Bumping the version

For each store submission:

1. Decide semver bump (patch for a bug-fix release, minor for new
   features, per normal semver — this app has no public API so "major" is
   really "significant enough to call out in release notes").
2. Edit `version` in `app.config.ts` (e.g. `"1.0.0"` → `"1.0.1"`). This is
   the only manual edit; buildNumber/versionCode are remote-managed as
   above.
3. `eas build --platform all --profile production` — EAS bumps
   buildNumber/versionCode automatically and stores the new values against
   your EAS project, keyed off the app version.
4. If a build is rejected and resubmitted without a `version` bump, EAS
   still increments buildNumber/versionCode on the next build — that's
   what `autoIncrement` is for, and it's safe to build again without
   touching `app.config.ts`.

## Where the version is actually shown to users

`src/features/settings/labels` reads it via `expo-constants` at runtime
(`Constants.expoConfig.version`), replacing the export mockup's fabricated
"v2.4.0 • Build 8421" (logged in PROGRESS.md). No extra wiring needed here
— it already reads live.
