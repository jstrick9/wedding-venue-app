# Review #204 — Brevo auto-send, invite TTL, and setup-link fix

The venue-admin setup screen said the link was invalid because the app stripped
`?token=` from the hash, then re-read the empty URL on the next Auth render.
Reissue already minted a new token; the new URL died the same way. Automatic
send is restored through **Brevo HTTPS** (Outlook SMTP is still blocked on Edge).

## 1. What changed

- Persist the invite token in React state + `sessionStorage` (`wvip_venue_admin_invite_token`) before cleaning the URL
- New invite URL: `https://app/?va=<token>#/venue-onboarding` (survives Outlook hash stripping)
- Keep the setup screen mounted after `?va=` is stripped (`shouldShowVenueAdminOnboarding`)
- Onboard / **Reissue & email invite** send the HTML invite automatically via Brevo
- Platform Branding: separate **new invite** (default 14 days) and **reissue** (default 7 days) lifetimes, clamped 1–90
- Drag-and-drop / click-to-insert merge tags (the tokenized URL is the button href only)
- Preview iframe uses the same HTML document Brevo sends
- Specific setup-page errors for missing, expired, revoked, or used links
- On send failure: toast the error and keep the copy-link fallback. No `.eml`. No Outlook.com auto-open.

## 2. Operator

1. Create a free [Brevo](https://www.brevo.com) account
2. Senders → add **wedding-vip@outlook.com** → confirm the email
3. Copy the Brevo API key into Supabase → Edge Functions → Secrets → `BREVO_API_KEY`
4. Redeploy `send-email` (GitHub → Actions → Deploy Edge Functions) after this commit lands
5. Platform Console → Branding → set new/reissue lifetimes and save
6. Reissue the Seven Paths Manor invite and open the new `?va=` link
7. Old `#/venue-onboarding?token=` links may still fail if that token was already revoked

Reissue still requires the venue to be unclaimed (`organizations.owner_id` is
null) and status provisioning/active. A claimed venue returns
`venue_already_claimed_or_unavailable`.

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **870 passed / 5 skipped** |
| `npm run build` | Pass — **2,305.21 kB / 550.86 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #204.*
