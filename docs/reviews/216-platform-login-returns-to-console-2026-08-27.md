# Review #216 — Signed-in `#/platform-login` must open the console

Sign-out of the platform console navigates to `#/platform-login` (#195).
After the operator signs back in, `App.tsx` only mounted `PlatformAdminPortal`
for `''`, `#/`, and `#/platform-admin…`. The post-logout hash was omitted, so
a successful platform login dumped the administrator into the venue
workspace (`AuthenticatedApp`) instead of the console. The same miss hit
**Platform login** from venue-login / “venue sign-in is separate”.

## 1. What changed

- `isPlatformConsoleHash()` treats `#/platform-login` the same as the
  platform root once a platform administrator is signed in
- Unsigned `#/platform-login` and `#/platform-admin` still show Platform
  login
- Venue `#/home` is unchanged

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Sign out of the platform console (you should land on `#/platform-login`)
3. Sign in as the platform administrator
4. You should see **Venue Intelligence Platform Console**, not the venue
   Home/studio
5. From a venue login page, **Platform login** should reopen the console
   when the platform session is still in this browser

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **897 passed / 5 skipped** |
| `npm run build` | Pass — **2,318.32 kB / 554.43 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #216.*
