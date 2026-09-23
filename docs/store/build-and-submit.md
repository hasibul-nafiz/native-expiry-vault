# EAS production build & submit

Concrete command sequence using the `production` profile already defined in
`eas.json`. Nothing here needs a config change beyond what
`docs/store/versioning.md` already added (`runtimeVersion`).

## Pre-flight checklist (do this before building)

- [ ] `docs/store/icons-and-splash.md` — real artwork in place, not the Expo
      template
- [ ] `ios.bundleIdentifier` / `android.package` in `app.config.ts` — still
      the placeholder `com.expiryvault.app`; **must** be replaced with the
      real reverse-DNS identifier before the first production build, since
      changing it after submission means starting over with a new app
      listing on both stores (PROGRESS.md already flags this)
      `[TODO: real bundle identifier]`
    - the app version once the pre-flight is otherwise clean
- [ ] `docs/store/permissions-audit.md` — verified against a real
      `npx expo prebuild --clean` output
- [ ] `docs/store/ios-usage-strings.md` — verified against the generated
      `Info.plist`
- [ ] `docs/store/listing-copy.md`, `privacy-policy.md`,
      `data-safety-play.md`, `app-privacy-apple.md` — TODOs filled (support
      email, URLs)
- [ ] `npm run typecheck && npm run lint && npm test` all green

## Credential prerequisites

Each of these is account-specific and can't be filled from the repo:

- **Apple:** an active Apple Developer Program membership, and the app's
  Bundle ID registered under it, matching whatever real value replaces
  `com.expiryvault.app`. `[TODO: Apple Team ID]`
- **Google:** a Google Play Console developer account, and (for `eas
  submit`, not strictly for the first manual upload) a service-account JSON
  key with permission to manage this app's releases. `[TODO: Play service
  account key path]`

`eas build` can generate/manage signing credentials interactively on first
run if neither exists yet (`eas credentials`), but the underlying developer
accounts themselves have to already exist — EAS doesn't create those.

## Build

```
eas build --platform all --profile production
```

Or split per platform (`--platform ios` / `--platform android`) if only one
store is ready to submit. `autoIncrement: true` means each production build
gets a fresh buildNumber/versionCode automatically — no manual bump needed
between builds of the same `version`.

## Submit

```
eas submit --platform ios
eas submit --platform android
```

`eas submit`'s `production` profile in `eas.json` is currently empty
(`"submit": { "production": {} }`) — EAS will prompt interactively for
anything it needs on first run (App Store Connect API key, Play service
account) unless those are pre-configured via `eas credentials` or
environment secrets. Interactive prompts are fine for a first submission;
non-interactive CI submission would need the credentials filled into
`eas.json` or EAS secrets first, which is out of scope here.

## After a rejection

Fix whatever App/Play Review flagged, then repeat the build step. No
version bump is required purely to resubmit the same `version` — EAS's
autoIncrement gives the resubmission a fresh internal build number on its
own. Bump `version` only if the fix is substantial enough to warrant a new
user-visible version number.

## First submission specifically

Both stores require the listing metadata (docs #5–#9 in this directory) to
already be filled in their respective consoles *before* `eas submit` will
successfully push a build into review — `eas submit` uploads the binary,
it doesn't fill out the store listing. Fill the App Store Connect / Play
Console listing pages using this directory's docs as the source text first.
