# Review #209 — Separate platform and venue sessions

Opening a venue-admin invite while signed in as the platform administrator
blocked setup with “signed in as punistricker@gmail.com, but this invitation
was issued to stricklandjoshua01@gmail.com.”

Those are two products and two emails. They must not share one Supabase
session.

## 1. What changed

- Platform console and venue workspace persist independent auth sessions
  (`wvip-auth-platform` and `wvip-auth-venue`)
- Invite setup (`/i/<token>`) is a venue surface. A platform session no longer
  blocks the invited-email form
- Creating or signing in as the invited venue admin does not sign out the
  platform console
- Existing venue accounts can sign in on the invite page and claim
- Legacy single-session tokens are copied onto the matching surface once

## 2. Operator

1. Hard-refresh `https://weddingvip.vercel.app/`
2. Stay signed in as the platform administrator
3. Open the newest `/i/va-…` link in the same browser
4. Create (or sign in as) **stricklandjoshua01@gmail.com**
5. `#/platform-admin` should still be the platform account

Migration **0015** is still required in the live SQL Editor for lookup/reissue.

## 3. Validation

Recorded after the CI gates in this review.

---

*End of Review #209.*
