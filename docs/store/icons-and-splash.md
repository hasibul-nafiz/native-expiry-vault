# Icons & splash screen

## Current state — still the Expo template

`assets/images/icon.png`, `assets/expo.icon/` and the three
`assets/images/android-icon-*.png` files are the artwork F0 scaffolded the
project with, not ExpiryVault branding:

- `assets/expo.icon/icon.json` composes two layers — `expo-symbol 2.svg`
  (the Expo "E" glyph) and `grid.png` — with an automatic blue gradient
  fill. This is the Expo icon-authoring tool's own sample content.
- `assets/images/android-icon-foreground.png` /
  `android-icon-background.png` / `android-icon-monochrome.png` are
  correctly *sized* (512×512, 512×512, 432×432) but render the same
  placeholder mark.
- `assets/images/splash-icon.png` (228×213) is likewise placeholder.

This is real design work outstanding, not a config gap — no code change
here fixes it. This doc exists so whoever produces the artwork knows
exactly what to hand back and where it plugs in.

## Required outputs and where each one goes

| Asset | Spec | `app.config.ts` key |
|---|---|---|
| iOS app icon | 1024×1024 PNG, **no alpha channel**, no rounded corners (iOS masks the shape itself — a pre-rounded icon shows a double corner) | `ios.icon` (currently `./assets/expo.icon`, a dynamic/tinted-icon bundle — see decision below) |
| Fallback / other-platform icon | 1024×1024 PNG | `icon` (currently `./assets/images/icon.png`) |
| Android adaptive icon — foreground | 512×512 PNG, transparent background, subject inset ~66% of frame (Android crops the outer edge on some launchers) | `android.adaptiveIcon.foregroundImage` |
| Android adaptive icon — background | 512×512 PNG or flat color | `android.adaptiveIcon.backgroundImage` (currently a flat `#E6F4FE` is also set via `backgroundColor` as a fallback) |
| Android monochrome icon (Android 13+ themed icons) | 432×432 PNG, single-color silhouette on transparent | `android.adaptiveIcon.monochromeImage` |
| Splash icon | Any size, laid out at `imageWidth: 76` (i.e. drawn at 76pt/dp wide, so provide roughly 3x = ~228px wide source, matching the current placeholder's dimensions) | `expo-splash-screen` plugin `image` option |
| Web favicon | 48×48 PNG (already correctly sized, still placeholder content) | `web.favicon` |

## Decision needed: keep `assets/expo.icon` or go static

`ios.icon` currently points at `assets/expo.icon`, which is Expo's iOS
26 dynamic/tinted-icon authoring format (multiple layers + shadow +
translucency, recomposited by the OS for tinted/dark icon modes). That's a
real feature (auto light/dark/tinted variants) but needs artwork built in
that layered format specifically.

The simpler alternative is dropping `ios.icon` back to a single flat PNG
(same requirement as `icon` above) and letting iOS generate its own
dark/tinted variants automatically from it.

**Not resolved here** — flag for whoever commissions the artwork: layered
dynamic icon (more design work, nicer light/dark/tinted appearance) vs. a
single flat icon (simpler, still fully compliant).

## Verification once real artwork lands

- `npx expo prebuild --clean` then inspect the generated
  `ios/*/Images.xcassets/AppIcon.appiconset` and
  `android/app/src/main/res/mipmap-anydpi-v26/` to confirm every size Expo
  generated is present and correctly cropped.
- View the launch screen on both a light- and dark-mode device/simulator —
  `expo-splash-screen`'s `backgroundColor` (`#208AEF`) should be checked
  against the new icon's colors for contrast once it's real artwork, not
  the placeholder blue.
