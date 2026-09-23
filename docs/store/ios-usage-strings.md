# iOS usage strings

Collated from `app.config.ts` for review — no new strings needed, this is a
read-through pass against Apple's guidance, not new copy. App Store Connect
doesn't enforce a hard character limit on these (unlike the listing fields),
but review guidance is that they should be specific about *why*, in plain
language, which all three already are.

## `NSCameraUsageDescription`

> ExpiryVault uses the camera to read expiry dates off your documents.
> Images are processed on this device and never uploaded.

Set via the `expo-camera` plugin's `cameraPermission` option. States the
purpose (reading dates) and preempts the obvious privacy question (where do
the images go) in the same sentence — this is the string most likely to get
a reviewer's attention given the document-photo use case, so it's
deliberately explicit about on-device-only processing.

## `NSPhotoLibraryUsageDescription`

> ExpiryVault needs access to your photos so you can attach a picture of a
> document. Images stay on this device.

Set via the `expo-image-picker` plugin's `photosPermission` option.

## `NSFaceIDUsageDescription`

> ExpiryVault uses Face ID to unlock your vault, so you do not have to type
> your PIN every time.

Set via the `expo-local-authentication` plugin's `faceIDPermission` option.
Note from PROGRESS.md: iOS shows this string at the *first* Face ID attempt,
so it has to explain the app-lock feature rather than the technology — this
was written with that constraint already in mind.

## Deliberately absent

`NSMicrophoneUsageDescription` is not declared anywhere (see
`docs/store/permissions-audit.md`) — both `expo-camera` and
`expo-image-picker` explicitly set `microphonePermission: false`. No string
needed; nothing here to review.

## Verification

Run `npx expo prebuild --clean` and open the generated `ios/*/Info.plist` —
confirm exactly these three `NS*UsageDescription` keys exist, word-for-word
matching this doc, and no fourth key was introduced by a dependency.
