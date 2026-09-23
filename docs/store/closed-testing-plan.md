# Closed testing plan

## Why this matters more than usual for ExpiryVault

PROGRESS.md's "Known issues" log lists a long, specific set of things that
have only ever been tested against fakes/Jest and never on real hardware —
SQLCipher's actual keychain round-trip, notifications actually firing,
biometric prompts, the ML Kit OCR bridge loading under RN's New Architecture
interop, backup/restore's real-world throughput, Android edge-to-edge
layout. Closed testing is where those get caught before a public listing,
not treated as a formality.

## TestFlight (iOS)

1. **Internal testing group first** — no Apple review required, available
   immediately after a production build is uploaded. Use this for the
   first pass yourself plus anyone with direct access to the same Apple
   Developer team.
2. **External testing group**, gated on Apple's beta app review (usually
   1-2 business days, lighter than full App Review). Recruit 3-5 testers
   with a mix of devices — at minimum one device with Face ID and one
   without, since F9's biometric path and its "no hardware enrolled"
   fallback both need to be seen for real.
3. Ask testers specifically to:
   - Set up PIN + biometric unlock and background/foreground the app past
     the 60-second grace period, to confirm the lock actually engages
   - Scan a real passport or ID (not a screenshot of one) end-to-end
     through the auto-capture flow, to confirm ML Kit's OCR loads and reads
     correctly on their specific device
   - Create a backup, then restore it on a **second** device, to confirm
     the `.evault` round-trip and passphrase flow work outside the
     developer's own test harness
   - Set a reminder for a date a day or two out and confirm the
     notification actually arrives (this is the one thing Jest's fake port
     structurally cannot verify)
   - Try the largest iOS text-size setting on the dashboard and timeline

## Play Console — Closed testing track

1. Upload the production build to a **Closed testing** track (not
   Internal testing, which is Google's separate, more limited pre-release
   track — Closed testing is the one that counts toward Production
   eligibility for newer developer accounts).
2. **Google's current policy for new Play Console accounts requires 14
   consecutive days of closed testing with at least 12 testers who
   opted in and installed the app**, before Production access opens up.
   This is a *timeline* dependency, not something any config or build step
   here shortcuts — plan the release date backward from this, not forward
   from "when the build is ready."
3. Same test checklist as TestFlight above, adapted for Android
   specifics: confirm the FLAG_SECURE recents-thumbnail blanking actually
   blanks (F9), confirm the bottom nav / tab bar inset and FAB clearance on
   at least one device with 3-button nav and one with gesture nav (F13's
   known-unverified Android edge-to-edge items).

## Exit criteria before moving either track to Production

Every item in PROGRESS.md's "Known issues / tech debt" section phrased as
"not yet verified on a device" should, by the end of closed testing, be
either:

- **Resolved** — confirmed working, log the result in PROGRESS.md's
  "Device test log" section per feature, or
- **Explicitly deferred** — a written reason it's safe to ship without
  (e.g. "PBKDF2 cost measured at Xms on a mid-range Android device, well
  under the threshold where it'd feel broken")

Do not move to Production with items still silently unverified — the whole
point of this stage is converting "not yet run on a device" into one of
those two states for every item currently on that list.
