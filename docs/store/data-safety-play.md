# Google Play — Data Safety form

Answers laid out in the order Play Console's Data Safety section asks them,
so they can be transcribed directly rather than interpreted at submission
time. Source of truth: the app makes zero network requests (README.md,
CLAUDE.md "No network calls in v1") — every answer below follows from that
one fact.

## Does your app collect or share any of the required user data types?

**No.**

Play's form will want this confirmed per category even after the top-line
"No" — if the console UI still walks through categories, the answer to
every one of the following is **"Data type not collected"**:

- Personal info (name, email, address, phone, etc.)
- Financial info
- Health and fitness
- Messages
- Photos and videos *(the document photos a user attaches never leave the
  device — "collection" in Play's sense means leaving the app/device
  boundary to us or a third party, which never happens)*
- Audio files
- Files and docs
- Calendar
- Contacts
- App activity
- Web browsing
- App info and performance
- Device or other IDs

## Is all of the user data collected by your app encrypted in transit?

**Not applicable** — there is no transit; the app makes no network requests.
(If the form requires an answer rather than accepting N/A, select "No data
collected" upstream, which should suppress this question; if it doesn't,
the honest answer is that in-transit encryption doesn't apply because there
is no transit.)

## Do you provide a way for users to request that their data be deleted?

**Yes, and it's simpler than usual: all data lives only on the user's own
device.** Deleting a document in-app removes it immediately; uninstalling
the app removes everything. There is no account and no server-side copy to
issue a deletion request against, so the standard "submit a deletion
request" flow doesn't apply — the answer to give in the console's free-text
explanation is exactly that.

## Security practices

- **Is data encrypted at rest?** Yes — SQLCipher (AES-256-CBC +
  HMAC-SHA512) for the structured database; the encryption key is held in
  the Android Keystore. (Attached image files are on app-private storage
  but not separately encrypted — state this if the form's granularity asks,
  matching `docs/store/privacy-policy.md`.)
- **Can users request data deletion?** Yes, as above.
- **Independent security review?** No.

## Data safety label summary (what the store listing will show)

> This app doesn't collect or share any data.

That single line is the entire label given a genuinely zero-network app —
resist the temptation to over-answer with hypothetical categories "just in
case"; every category left as "not collected" should stay that way unless a
future feature actually adds network I/O.
