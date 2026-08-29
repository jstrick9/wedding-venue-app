# Review #232 — Platform support must not open the venue workspace

`#216` made signed-in `#/platform-login` open the platform console for
owner/admin. Platform login also accepts `platform_support`. Console RPCs
and `isPlatformAdmin` are owner/admin only. Denial only ran on
`#/platform-admin`, so a support session on `#/platform-login` (and `#/` /
`#`) skipped both the console and the denial and mounted
`AuthenticatedApp`.

## 1. What changed

- A platform session that is not owner/admin on a console hash shows
  **Platform administrator access required** with **Sign out**
- Local-mode (signed-in user, no platform session) still opens the
  workspace from `#/platform-login`
- `#/platform-admin` plus a local-mode session still uses **Return to
  workspace**
- Do not deny every console hash with `user && !isPlatformAdmin` — that
  would break local-mode

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. A `platform_support` login on `#/platform-login` must not open Home /
   studio. It must deny and offer Sign out
3. Platform owner/admin login on that hash still opens the console
4. Local-mode demo login is unchanged

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **940 passed / 5 skipped** |
| `npm run build` | Pass — **2,327.75 kB / 556.08 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #232.*
