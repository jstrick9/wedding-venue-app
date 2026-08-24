# Review #210 — Reissue uses the platform session

After #209, **Reissue & email invite** toasted `forbidden`. The venue
session (or a shared refresh token) was winning on the RPC. `is_platform_admin()`
saw the invited venue account, not the platform administrator.

## 1. What changed

- Console reissue/revoke/update/metrics always use the **platform** Supabase client
- Invite email invoke also uses the platform JWT
- Legacy single-session migrate no longer copies the same refresh token onto both clients
- Only the active surface auto-refreshes tokens
- `forbidden` is explained as a missing platform login, not a raw RPC code

## 2. Operator

1. Hard-refresh the app after deploy
2. If reissue still fails, open `#/platform-login` and sign in as the platform administrator
3. Reissue again — venue setup stays a separate login

## 3. Validation

Recorded after the CI gates in this review.

---

*End of Review #210.*
