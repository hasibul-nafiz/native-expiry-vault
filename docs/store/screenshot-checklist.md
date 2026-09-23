# Screenshot checklist

## Required sizes

### iOS (App Store Connect)

| Device class | Required? | Notes |
|---|---|---|
| 6.9" (iPhone 17 / 16 Pro Max class, 1320×2868 or 2868×1320) | Yes | Current largest-required set |
| 6.5" or 6.7" (iPhone 15/14 Pro Max class) | Yes, unless the 6.9" set is marked to cover it | Apple auto-scales the largest set down to smaller device listings if only one set is uploaded — but submitting per-class sets avoids letterboxing artifacts |
| iPad 12.9" (2048×2732) | **Only if the app supports iPad** | ExpiryVault has no `ios.supportsTablet` restriction today — decision needed: either set `ios.supportsTablet: false` in `app.config.ts` (out of scope for this doc-only pass, flagged for follow-up) to make this optional, or capture a real iPad set |

### Android (Play Console)

| Device class | Required? | Notes |
|---|---|---|
| Phone | Yes (minimum 2, up to 8) | 16:9 or 9:16, min 320px, max 3840px on the long edge |
| 7" tablet | Optional | Recommended — Play flags phone-only screenshot sets when a device supports tablets, which can dent the listing's tablet-device ranking |
| 10" tablet | Optional | Same as above |

## Shot list

Mapped to the app's actual five tabs (`src/i18n/locales/en.json` `tabs.*`)
plus the two flows most worth showing off. Captions are drawn from real
copy already in the app (`en.json`), not placeholder text — reuse it
verbatim so the listing doesn't say something the app doesn't.

1. **Vault (dashboard)** — populated with several documents across
   categories, hero card visible. Caption: *"Every document, one private
   vault."*
2. **Scan** — mid-capture or the confirm-date sheet
   (`scan.confirmBody`: "Everything was read on this device. Pick the
   expiry date, or type it in yourself."). Caption: *"Scan it, and it's
   done — nothing leaves your phone."*
3. **Timeline** — several months of upcoming expiries, rail visible.
   Caption: *"See what's coming, months ahead."*
4. **Vault Health** — score + breakdown card visible with a couple of
   deductions shown. Caption: *"Know exactly what needs attention, and
   why."*
5. **Settings** — showing language (English/Bengali) and app lock rows.
   Caption: *"Private by construction — no account, no cloud, ever."*
6. **Lock screen** — PIN dots or the Face ID prompt affordance. Caption:
   *"Locked behind Face ID, Touch ID, or your PIN."*
7. **Add document** — a populated review step, showing reminders set.
   Caption: *"Set once, and ExpiryVault reminds you before it's too
   late."*

## Populating a device for screenshots

`app/(app)/dev-seed.tsx` (existing `__DEV__`-gated route, linked from
Settings' developer section) already exists for exactly this — no new code
needed to get a realistic-looking vault for screenshots. Reused as-is; it's
removed before release per PROGRESS.md's existing note, so screenshots must
be captured *before* that removal happens, not after.

## Capture notes

- Match the OS status bar time/battery/signal to something clean (Xcode's
  Simulator and Android Studio's Emulator both offer a "clean status bar"
  toggle) — required by both stores' screenshot guidelines.
- Capture both light and dark mode sets if device-scheme screenshots are
  wanted for the listing (optional on both stores, not required).
- Capture the English locale set first; a Bengali set is optional given
  `bn.json`'s existing "unreviewed machine-quality" caveat (PROGRESS.md) —
  don't ship Bengali screenshots before that review happens, since a
  screenshot with a translation error is far more visible than an in-app
  string.
