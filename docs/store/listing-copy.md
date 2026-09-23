# Store listing copy

Derived from `README.md`'s "What it does" / "What it deliberately does not
do" sections, rewritten for a store audience (a prospective user skimming a
listing) rather than a developer reading a repo.

## App name

**ExpiryVault**

(`common.appName` in `src/i18n/locales/en.json` already fixes this as the
in-app name — kept identical for consistency across icon, in-app UI, and
store listing.)

## Subtitle / short description

iOS "Subtitle" field limit: 30 characters. Play "Short description" limit:
80 characters — using the tighter iOS copy for both keeps them consistent.

> Track passports, visas & more

(29 characters)

## Promotional text (iOS only, updatable without a new build review)

> Offline, encrypted, and yours alone — no account, no cloud, no tracking.

## Full description

> Never miss a passport, visa, or insurance renewal again.
>
> ExpiryVault tracks every document with an expiry date — passports, visas,
> driving licences, health insurance, warranties, subscriptions, permits,
> anything — and reminds you before it's too late.
>
> **Scan it, and it's done.** Point the camera at a document and ExpiryVault
> reads the expiry date for you, right on your phone. Nothing is uploaded —
> ever.
>
> **Reminders that actually help.** Local notifications are scheduled by
> your phone, with a daily heads-up as a document gets close to expiring, so
> nothing sneaks past you.
>
> **A timeline of everything coming up.** See every document's expiry
> grouped by month, plus a vault health score that tells you exactly what
> needs attention — and why.
>
> **Locked behind Face ID, Touch ID, or a PIN.** Your documents are encrypted
> on your device and protected by your own biometrics or a PIN you choose.
>
> **Completely private, by construction, not by policy.** ExpiryVault makes
> no network requests at all. There's no account to create, no server
> storing your data, and no analytics watching what you do. Your documents
> never leave your phone unless you explicitly back them up — to a single
> password-encrypted file, under your control, that you decide where to
> keep.
>
> **Back up and restore whenever you want.** Your whole vault — documents,
> reminders, attachments — exports to one encrypted file you can restore
> from later. No cloud involved, ever.
>
> **In English and বাংলা (Bengali).**
>
> Passports. Visas. Driving licences. Health insurance. Home and auto
> insurance. Warranties. Subscriptions. Residence permits. If it expires,
> ExpiryVault tracks it — privately, on your device, and nowhere else.

## Keywords (iOS, 100-character field, comma-separated, no spaces after commas)

```
passport,visa,expiry,expiration,reminder,tracker,insurance,warranty,renewal,privacy,offline,documents
```

(Kept under 100 characters; avoids repeating words already in the app name
or subtitle, per Apple's guidance that those are indexed separately.)

## Play category / tags

- **Category:** Productivity
- **Tags:** organization, reminders, documents

## iOS category

- **Primary:** Productivity
- **Secondary (optional):** Utilities

Reasoning for Productivity over Utilities as primary: the core loop (add a
document, get reminded, act on it) is a task-management pattern, which is
how Apple's own Productivity category examples (to-do, reminder apps) are
framed; Utilities is offered as the secondary category rather than primary
since it's the weaker fit.

## Support URL / support email / marketing URL

`[TODO: support email — a real inbox that will be monitored]`
`[TODO: support URL — can be a simple static page if no marketing site exists yet]`
`[TODO: marketing URL — optional on both stores; omit if none exists]`

Both stores require at least a support contact before a listing can go
live; this can't be filled from anything in the repo.

## Age rating questionnaire

Both stores ask a short battery of "does your app contain X" questions.
ExpiryVault's answers are "No" across the board:

| Question | Answer |
|---|---|
| User-generated content shared with other users | No — nothing is shared with anyone, ever |
| Ads | No |
| In-app purchases | No |
| Gambling / contests | No |
| Violence, sexual content, profanity | No |
| Unrestricted web access | No — the app makes no network requests |
| Location sharing | No |
| Account creation / login | No |

Expected rating: **4+ (iOS) / Everyone (Play)**.
