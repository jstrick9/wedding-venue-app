# Review 55 — Branding consistency (hover/translucency) + branded loading screen

## 1. Custom branding didn't fully apply (UI/UX gap)
Review 42 mapped the base `#4A1942` class to `var(--primary-color)`, but two gaps
remained visible to anyone who sets a custom brand color:
- **Hover/active states** (`hover:bg-[#3b1435]`, `#5b2352`, `#3d1a45`, `#6b2c5c`) were
  not mapped, so hovering a themed button reverted to default plum.
- **Opacity variants** (`bg-[#4A1942]/10`, `focus:ring-[#4A1942]/20`, `/30`, `/50`,
  `border-[#4A1942]/20`, gradient stops) matched the general
  `[class*="bg-\[#4A1942\]"]`/`ring-…` overrides, which force **solid** color and
  silently dropped the translucency (e.g. focus rings became solid).

**Fix:** added a trailing stylesheet block (so it wins the cascade over the earlier
general overrides) that re-tints hover states to `--primary-dark`/`--primary-light`
and re-applies opacity variants using `color-mix(in srgb, var(--primary-color) N%,
transparent)` so translucent brand fills/rings/gradients preserve their alpha.
`hover:bg-[#4A1942]` maps to the brand color itself.

## 2. Bare "Loading..." text replaced with a branded loading screen
The app's Suspense fallbacks were plain `<div>Loading...</div>`. Added a `LoadingScreen`
(venue logo + themed spinner + label) and used it as the fallback for the app,
accept-invite, and forced-password-change lazy routes (the guest-portal keeps its own
🌸 fallback). Adds LoadingScreen.test.tsx.

## Validation
- `npm run typecheck` clean; build green.
- `npx vitest run`: 318 passed / 11 skipped (was 315; +3).
