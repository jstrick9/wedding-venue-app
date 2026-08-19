# Review #184 — Login screens tied to branding

**Repository:** `jstrick9/wedding-venue-intelligence-platform`  **Date:** 2026-08-19
**Scope:** Make every staff auth screen use branding chrome. New venue logins
default to charcoal / white / gray until the venue saves branding. Platform
login keeps its navy brand. Semantic status colors stay red / amber / green.

User-selected options:

| Decision | Choice |
|---|---|
| Scope | All staff auth screens (platform, venue, password reset, force password change, venue-admin onboarding, accept-invite) |
| New venue default | Neutral login fallback only — do not change the in-app Seven Paths product theme |
| Platform default | Keep navy `#26354A` |
| Semantic colors | Brand the chrome; keep error / warning / success colors |

---

## 1. What was fixed

| Item | Fix | Validation |
|---|---|---|
| **Platform login leaked Seven Paths plum** | `getPublicPlatformBranding` / `getPlatformBranding` used to merge into `defaultConfig` (`#4A1942`). Empty or missing platform branding then overwrote the navy platform default. They now merge into `DEFAULT_PLATFORM_LOGIN_CONFIG`. | `loginBranding` unit tests + LoginScreen override test |
| **Login chrome hardcoded `#4A1942`** | Shared `resolveLoginChrome()` / `loginBackgroundStyle()`. Missing colors fall back to charcoal `#111827`, never plum. Header, buttons, focus rings, and links use that chrome. | LoginScreen + helper tests |
| **New venue public branding defaulted to plum** | Client `getPublicVenueBranding` merges into `NEUTRAL_LOGIN_CONFIG`. Migration `0013` changes `get_public_venue_branding` SQL fallbacks to charcoal/white/gray and exposes login-background fields. Saved venue branding is unchanged. | SQL reviewed; live RPC still needs a project |
| **Venue login status pages were slate/emerald hardcodes** | Loading / not-found / suspended / already-signed-in use the same login chrome. | VenueLoginScreen tests |
| **Password reset / onboarding / force-change / accept-invite** | Password reset accepts the parent login branding. Onboarding loads public venue branding by slug (neutral until saved). Force-change and accept-invite resolve chrome from current config. | Existing reset / invite tests still pass |

**Still deferred:** Phase 3 features; N-3 snapshot tokens; remaining `@ts-nocheck`; 5 skipped UI tests; live RLS smoke. Couple and guest portals were out of this pass (already themed). In-app dashboard/studio still uses the Seven Paths product default until a venue saves branding.

---

## 2. Palettes

| Surface | Default when branding is missing |
|---|---|
| New venue public login / onboarding | `#111827` / `#FFFFFF` / gray (`NEUTRAL_LOGIN_CONFIG`) |
| Platform administration login | `#26354A` navy (`DEFAULT_PLATFORM_LOGIN_CONFIG`) |
| Local Seven Paths demo login | Existing saved / `defaultConfig` plum `#4A1942` |
| Venue that has saved branding | That venue's colors |

---

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | Pass (0 errors / 46 pre-existing warnings) |
| Strict unused-locals scan | Pass |
| `npx vitest run` | **807 passed / 5 skipped** (was 799 / 5) |
| `npm run build` | Pass — 2,097.77 kB / 486.48 kB gzip |
| `VITE_SPLIT=1 npm run build` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

Live SQL/RLS: **not executed**. Apply migration `0013` so new-tenant public login colors are charcoal instead of plum.

---

*End of Review #184.*
