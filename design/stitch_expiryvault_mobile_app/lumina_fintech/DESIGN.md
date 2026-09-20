---
name: Lumina FinTech
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#464554'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#767586'
  outline-variant: '#c7c4d7'
  surface-tint: '#494bd6'
  primary: '#4648d4'
  on-primary: '#ffffff'
  primary-container: '#6063ee'
  on-primary-container: '#fffbff'
  inverse-primary: '#c0c1ff'
  secondary: '#6b38d4'
  on-secondary: '#ffffff'
  secondary-container: '#8455ef'
  on-secondary-container: '#fffbff'
  tertiary: '#006c49'
  on-tertiary: '#ffffff'
  tertiary-container: '#00885d'
  on-tertiary-container: '#000703'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  title-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.005em
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system embodies an airy, modern, and trustworthy financial experience tailored for next-generation personal wealth, banking, and smart analytics. The aesthetic pairs the structural precision of high-end consumer technology with the soothing clarity of soft lavender and royal indigo undertones. 

Drawing from modern minimal fintech and subtle soft-glass layering, the visual tone prioritizes frictionless legibility, serenity, and effortless control. Deep slate navy typography creates crisp optical contrast against pure white cards and tinted gossamer-hued backgrounds, evoking confidence, calm, and institutional prestige without legacy rigidity.

## Colors

The palette relies on a luminous light foundation highlighted by rich indigo-violet gradients and soft pastel accents:

- **Canvas & Backgrounds:** The base canvas uses an ultra-soft lavender-gray (`#f8f8fd`), contrasting gently against elevated crisp white containers (`#ffffff`).
- **Primary & Violet Scales:** The primary anchor is electric royal indigo (`#6366f1`) shifting seamlessly into bright violet (`#8b5cf6`) and deep credit-card royal navy (`#1e1b4b` / `#312e81`) for signature focal pieces like virtual cards and hero metrics.
- **Tonal Pastel Badges:** Interactive action pills, icon containers, and progress tracks employ low-opacity tint washes (`rgba(99, 102, 241, 0.08)` to `rgba(139, 92, 246, 0.12)`).
- **Semantics:** 
  - Emerald Green (`#10b981`) indicates positive transactions, safe statuses, and inflow.
  - Warm Amber (`#f59e0b`) highlights pending actions, warning states, and utilities.
  - Coral Rose (`#f43f5e`) marks debits, alerts, and critical card actions.
- **Neutrals & Typography:** Primary text is rendered in deep midnight slate (`#0f172a`), secondary labels in muted steel indigo (`#64748b`), and micro dividers in featherweight lavender lines (`rgba(99, 102, 241, 0.08)`).

## Typography

Typography centers exclusively on `Inter`, leveraging its clean neo-grotesque apertures and distinct numerical clarity for financial balance sheets, charts, and transaction receipts. 

Numerical values rely on proportional tabular figures (`tnum`) for flawless vertical scanning in transaction records and summary rings. Heading hierarchies employ tight tracking (`-0.01em` to `-0.02em`) to deliver a modern, architectural feel, while body and micro-labels maintain neutral spacing for effortless readability under quick glances.

## Layout & Spacing

The layout embraces high-order visual breathing room. Mobile screens feature a fluid column grid flanked by `1.25rem` (20px) outer margins, allowing cards to feel self-contained and floating without touching the device perimeter.

- **Vertical Cadence:** Core sections (e.g., balance hero, quick action deck, categorical breakdowns, recent activity) are distanced using consistent `1.5rem` (`space-lg`) increments.
- **Component Padding:** Cards standardise on `1.25rem` to `1.5rem` internal padding to prevent numeric totals and chart nodes from touching card perimeters.
- **Adaptive Breakpoints:**
  - **Mobile (<640px):** Single-column stacked deck with a persistent floating bottom navigation dock.
  - **Tablet (640px–1024px):** 2-column layout pairing card metrics side-by-side with transaction activity streams.
  - **Desktop (>1024px):** 12-column layout, centralizing interactive dashboards within a maximum content container of 1200px with fixed lateral margins.

## Elevation & Depth

Visual hierarchy avoids heavy drop shadows, relying on ethereal multi-stop ambient diffusion and crisp outline boundaries:

- **Surface Layer 0 (Page Canvas):** Soft, tinted lavender surface (`#f8f8fd`).
- **Surface Layer 1 (Standard Card Container):** `#ffffff` layered with an ultra-delicate outline (`1px solid rgba(99, 102, 241, 0.08)`) and an ambient tinted shadow:
  `box-shadow: 0 8px 24px -4px rgba(99, 102, 241, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.02);`
- **Surface Layer 2 (Active Modals & Floating Navigation Dock):** Pure `#ffffff` or frosted translucent glass (`backdrop-filter: blur(16px); background: rgba(255, 255, 255, 0.85);`) with:
  `box-shadow: 0 16px 36px -6px rgba(99, 102, 241, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.04);`
- **Hero Credit Cards:** Deep indigo-to-violet linear gradients (`linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #7c3aed 100%)`) with specular top-edge highlights (`inset 0 1px 0 rgba(255, 255, 255, 0.25)`) and diffused indigo glow shadows (`0 12px 32px -8px rgba(99, 102, 241, 0.4)`).

## Shapes

The interface embraces organic curvature without sacrificing corporate rigor. Content containers, dashboards, and spending overview panels utilize smooth 20px–24px radii (`rounded-xl`), creating inviting physical envelopes.

Action buttons, segmented filters, and category badges default to full pill profiles (`rounded-full`), reinforcing their clickable, touch-friendly nature. Secondary list items and input enclosures sit neatly at a balanced 12px–16px border radius.

## Components

### Action & Quick-Transfer Buttons
- **Quick Action Tiles:** Square-proportioned soft cards (`56px × 56px` to `64px × 64px`) with `16px` radius, washed in faint lavender-tinted gray (`rgba(99, 102, 241, 0.07)`), containing bold indigo icon glyphs, followed by centered small labels beneath.
- **Pill Primary Buttons:** Fully rounded (`rounded-full`) gradients from `#6366f1` to `#7c3aed`, featuring bold white text and subtle forward-pointing chevron icons.

### Transaction Lists & Category Rows
- **List Items:** Horizontal rows with `12px` vertical padding. Left section features a `44px` rounded squircle containing vendor brand emblems or tinted categorical icon badges (e.g., amber for transport, purple for shopping, rose for dining).
- **Secondary Details:** Category and date aligned in `13px` slate muted tone; amounts right-aligned using semibold text (`+` in emerald green, `-` in primary slate).

### Analytical Rings & Charts
- **Spending Rings:** Clean multi-segment donut rings constructed with rounded stroke caps. The center of the ring showcases the primary monetary total over a subtle month descriptor.
- **Smooth Area Charts:** Spline-curved single or dual stroke lines (`2.5px` thickness) with transparent gradient fades descending to zero opacity at the base axis.

### Form Controls & Switches
- **Toggle Switches:** Pill housings with a soft gray track in inactive state and a vibrant indigo-violet fill in active state; the toggle thumb is an offset pure white sphere with subtle directional drop shadow.
- **Input Fields:** Pure white or soft lavender field containers with inset 1px borders, shifting to a 1.5px `#6366f1` ring on focus state.

### Bottom Floating Navigation
- A floating pill-dock anchored at screen bottom, elevated with gentle ambient shadow and frosted backdrop blur. Active state uses solid purple fills for icons, while inactive icons sit in subdued muted gray.