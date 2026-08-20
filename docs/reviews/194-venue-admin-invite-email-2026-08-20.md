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

Re-run against HEAD after this change.

---

*End of Review #194.*
