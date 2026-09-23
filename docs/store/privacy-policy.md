# ExpiryVault privacy policy

*Effective date: [TODO: set on first publish]*

This is the hosted copy for the App Store / Play Store listing URLs. It says
the same thing as the in-app privacy screen (`src/features/settings/PrivacyScreen.tsx`,
i18n keys under `privacy.*` in `src/i18n/locales/en.json`), expanded with the
boilerplate a standalone hosted policy needs that the in-app screen doesn't
carry. **This text has had no legal review** — the same caveat PROGRESS.md
already logs for the in-app version applies here; it describes what the app
actually does, but should be checked by counsel before it backs a live store
listing, particularly the children's-privacy and jurisdiction sections
below, which have no in-app equivalent to draw from.

---

## Introduction

ExpiryVault stores everything on this device. There are no accounts, no
servers, and no analytics.

## What is stored

The documents you add — their names, numbers, issuers, dates, and any
images you attach — are stored in an encrypted database on your phone. We
(the developer) never see this data. It is not transmitted to us or to
anyone else, at any point, under any circumstance.

## How it is protected

The database is encrypted with SQLCipher (AES-256-CBC with HMAC-SHA512).
The encryption key is held in your device's secure hardware-backed keychain
(iOS Keychain / Android Keystore) and never leaves it. If you additionally
set a PIN or enable biometric unlock, that is a second, independent lock on
top of the encrypted database.

Attached images are stored in the app's private storage area on your
device. They are not separately encrypted beyond the operating system's own
file protection. (This is stated plainly rather than implied: if your
device itself is compromised or a full-device backup is extracted, attached
images are more exposed than the structured document data in the database.)

## What leaves your device

Nothing. ExpiryVault makes no network requests of any kind. Text
recognition (reading dates off a scanned document) runs entirely on-device.
There is no analytics SDK, no crash reporter, and no third-party service of
any kind integrated into the app.

## Notifications

Reminders are scheduled locally by your device's operating system — not by
any server we operate, because no such server exists. A reminder's text can
include a document's name, so it may be visible on your lock screen if you
have lock-screen notification previews enabled; this is standard OS
notification behavior, not something ExpiryVault configures beyond what any
local-notification app does.

## Backups

If you create a backup, it is a single file encrypted with a passphrase you
choose, saved wherever you choose to save it (your device, a cloud drive you
control, etc.). We never receive a copy. There is no way for us — or anyone
without your passphrase — to open it. There is no way to recover a lost
passphrase; losing it means the backup cannot be opened by anyone, including
us.

## Deleting your data

Deleting a document removes it and its images immediately. Uninstalling the
app removes everything, including any on-device backups you haven't moved
elsewhere. Because nothing is ever sent to us, there is nothing for us to
delete on your behalf — your device is the only copy.

## Children's privacy

ExpiryVault is not directed at children and does not knowingly collect any
information from anyone, of any age — the app collects no information at
all, from us or about you, outside of what you type into your own local
database.

## Changes to this policy

If this policy changes, the updated version will be published at this same
location and, where practical, reflected in the in-app privacy screen in
the next app update.

## Contact

[TODO: support email — see `docs/store/listing-copy.md`]
