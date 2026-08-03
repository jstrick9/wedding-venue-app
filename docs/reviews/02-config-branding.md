# Module Review 02 — Configuration & Branding

**Scope:** `src/config.ts`, `src/types.ts` (`Config`/`AppConfig`), `src/components/admin/BrandingManagement.tsx`, `src/utils/color.ts` (new), consumers of `getConfig()` (Header, LoginScreen, FloorPlanCanvas, PrintView, WelcomeModal, DecorDesigner, PropertiesPanel, Sidebar).

## Summary

Config + branding controls the look/feel that makes each venue feel like its own brand. The core versioned-storage config is solid. The main issues were a duplicated type and a missing convenience for consistent color themes.

## Findings

### P2 — Duplicated `Config` interface (drift hazard)
Two near-identical `Config` interfaces existed — one in `config.ts` (with `logoUrl: string` required) and one in `types.ts` (with `logoUrl?: string` optional). Admin components imported one copy; `AdminPanel`/`AdminSharedComponents` imported the other. They had to be kept in sync by hand, and they had already diverged on `logoUrl` requiredness.
**Fix:** `Config` is now defined **once** in `src/types.ts` and re-exported from `config.ts`. Both `import { Config } from '../config'` and `import { Config } from '../../types'` resolve to the same type. All `logoUrl` consumers already guard with ternaries, so the optional field is safe.

### P3 — Custom brand colors don't derive their shades
The "Custom Colors" editor exposes `primaryColor`, `primaryDark`, and `primaryLight` as three independent pickers. The dark/light shades (used for header gradients and hover states) are just darker/lighter versions of the primary color, but changing the primary color left them stale — so a user had to hand-tune three values to get a coherent theme. The five preset palettes set all three, which is why presets looked right and customs didn't.
**Fix:** Added `src/utils/color.ts` (hex ↔ HSL, `deriveShades()`) and an **"🎨 Auto-generate dark & light shades from Primary"** button in the Custom Colors section. One click derives the header-gradient and hover shades from the primary color while preserving its hue.

## Cross-module dependencies affected
- **All consumers of `getConfig()`** now share the single `Config` type (no behavioral change; type-only).
- **Header / PrintView / WelcomeModal / DecorDesigner** read `logoUrl` — unaffected (already handled optional).
- **BrandingManagement** — new shade-generation control.

## Validation
- Typecheck clean.
- Added `src/utils/color.test.ts` (4 tests) and a brand-shades helper.
- Full suite: **241 passed / 11 skipped** (was 237).
- Production build succeeds.

## Deferred
- Contrast/accessibility auditing of arbitrary user-selected color pairs (a "check contrast" indicator on the color editor would be a good future addition).
- Google-font loading is dynamic/lazy already; no change needed.
