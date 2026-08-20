# Review #194 — Send and customize venue-admin invite email

Creating or reissuing a venue administrator invite only copied a link. Email
was never sent. Platform admins also could not use `send-email` because that
function required organization membership.

## 1. What changed

- After create/reissue, the console emails the setup link via `send-email`
- New purpose `venue_admin_invite` is allowed for platform owners/admins
- Branding screen: editable subject/body with merge tags and preview
- Invite still succeeds if email is not configured; the link is copied

## 2. Live follow-up

Set `RESEND_API_KEY` and `EMAIL_FROM` on the `send-email` function, then
redeploy it. Verify the sending domain in Resend.

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | Pass (0 errors / 47 pre-existing warnings) |
| Strict unused-locals scan | Pass |
| `npx vitest run` | **828 passed / 5 skipped** |
| `npm run build` | Pass — 2,285.57 kB / 544.07 kB gzip |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #194.*
