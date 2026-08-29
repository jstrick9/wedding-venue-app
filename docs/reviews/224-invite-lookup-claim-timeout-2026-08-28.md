# Review #224 — Invite lookup and claim must not hang

The `/i/<token>` setup screen awaited `getPublicVenueBranding` **after** a
successful invite lookup before clearing “Checking invitation…”. If that
branding RPC stalled, the invitee never saw the claim form even though
the invitation was valid. Lookup and `signUpVenueAdminWithInvite` also
had no deadline, so Claim Venue Workspace could stay on Claiming
venue… forever.

## 1. What changed

- Invite lookup times out at **20s**
- The claim form paints as soon as lookup returns; branding hydrates in
  the background
- Claim (password + accept) times out at **30s**
- Timeout errors replace the stuck Checking invitation… / Claiming
  venue… states

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Open `/i/<token>` — the password form should appear without waiting
   on venue branding
3. If lookup or claim hangs, you should get a timeout instead of a
   stuck button
4. Ask the platform administrator to reissue if claim keeps timing out
   (still apply **0015** live)

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **921 passed / 5 skipped** |
| `npm run build` | Pass — **2,325.23 kB / 555.61 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #224.*
