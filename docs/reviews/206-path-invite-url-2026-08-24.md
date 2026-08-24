# Review #206 — Path-only venue-admin invite URLs

The invite email sent, but the setup page still said the link was invalid.
Brevo and Outlook wrap button hrefs. A URL like
`https://app/?va=<token>#/venue-onboarding` loses `?va=` (the wrapper eats `?`
and `#`), so the app opened `#/venue-onboarding` with no token.

## 1. What changed

- New invite URL: `https://weddingvip.vercel.app/i/<token>` (no query, no hash)
- `vercel.json` rewrites `/i/:token` to `index.html`
- Parser still accepts legacy `?va=`, `#/venue-onboarding?token=`, and hash paths
- Tokens are sanitized out of mail-client junk
- The setup page no longer strips the URL or assigns `location.hash`

## 2. Operator

1. Wait for Vercel to deploy this commit
2. Reissue the venue invite (old emails still have the broken `?va=` + hash URL)
3. Open the newest email and use **Set up your account**
4. The address bar should be `/i/va-…` with no `#/venue-onboarding`

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **874 passed / 5 skipped** |
| `npm run build` | Pass — **2,306.16 kB / 551.25 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #206.*
