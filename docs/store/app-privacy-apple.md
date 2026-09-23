# Apple App Privacy ("privacy nutrition label")

App Store Connect → App Privacy questionnaire, answered from what the app
actually does so the top-line label reads correctly and the answers can be
defended if App Review follows up.

## Top-line answer

**"Data Not Collected"** — select this for the whole app. Apple's own
definition of "collect" is data transmitted off the device to the
developer or a third party. ExpiryVault makes no network requests
whatsoever (CLAUDE.md: "No network calls in v1"; verified — no
`fetch`/`XMLHttpRequest`/network SDK anywhere in `src/`), so nothing meets
that definition, including:

- Documents, dates, issuers, document numbers typed in by the user
- Photos attached to a document
- OCR/scanned text (`items.ocr_raw_text`) — processed entirely on-device by
  `@react-native-ml-kit/text-recognition`, never transmitted
- Biometric data — handled entirely by `expo-local-authentication` calling
  the OS's own Face ID/Touch ID APIs; ExpiryVault never receives or stores
  raw biometric data, only a pass/fail result
- Usage data, diagnostics, crash logs — no analytics SDK, no crash
  reporter is integrated (README.md, "No analytics, crash reporting, or
  other third-party SDK is included")

## If Review asks "why does this app need camera/photo library/Face ID
## access if it collects no data?"

Prepared answer, consistent with `docs/store/ios-usage-strings.md`:
on-device use is not the same as collection. The camera and photo library
are used to read a date off a document image, entirely locally; the image
and any OCR text stay in the app's own encrypted local database and are
never uploaded. Face ID is used only to gate access to that local database,
via the OS's standard biometric API — ExpiryVault never receives the
underlying biometric data itself.

## Third-party SDKs disclosure

None to disclose. `@react-native-ml-kit/text-recognition` runs its model
on-device with no network calls and is not a "third party" in the App
Privacy questionnaire's sense (it doesn't collect data on the developer's
behalf) — but note it explicitly in the App Store Connect SDK list if the
submission flow asks for it, since it is bundled code from an external
package even though it phones nowhere.

## What NOT to select

Do not tick any "used for tracking" category — there is no cross-app or
cross-site tracking, no advertising identifier is read, and no third-party
analytics or ad SDK is present to enable it.
