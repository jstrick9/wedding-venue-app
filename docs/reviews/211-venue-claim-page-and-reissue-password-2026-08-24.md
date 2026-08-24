# Review #211 — Venue-only claim page and reissue password

The setup page is for the invited venue only. It no longer explains
platform sessions, offers an existing-account sign-in, or links back to
the platform console. The heading names the venue. A reissued invite
requires a new password and keeps that venue’s work in place.

## 1. What changed

- Heading is **Claim {venue}'s Venue Workspace** (example: Claim Seven
  Paths Manor's Venue Workspace)
- Removed the emerald “platform administration stays signed in” info box
- Removed **Already created this venue account?** / **Sign in and claim
  venue**
- Removed **Return to platform console** / **Return to platform login**
- Invitee always sets a **new password**
- `claim-venue-admin` Edge Function creates the Auth user or updates the
  existing user’s password. It does not delete the organization, events,
  layouts, guests, or other team work
- Accept still transfers managed ownership and demotes other owners to
  admin
- GitHub Action now deploys `claim-venue-admin` (`verify_jwt` off; the
  invite token is the credential)

## 2. Operator

1. Apply **0015** in the live Supabase SQL Editor if it is not applied
2. Wait for **Deploy Edge Functions** to upload `claim-venue-admin`
3. Hard-refresh the app after the Vercel deploy
4. Open the newest `/i/va-…` email link
5. Enter name + a new password and **Claim Venue Workspace**

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **884 passed / 5 skipped** |
| `npm run build` | Pass — **2,310.11 kB / 552.55 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #211.*
