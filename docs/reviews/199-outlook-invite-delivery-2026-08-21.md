# Review #199 — Outlook invite delivery without Resend or a live domain

Cloudflare has not delegated `weddingvip.com`, so Resend cannot send to venue
owners. Invites still need to go out from a mailbox that already exists.

## 1. What changed

- `send-email` delivers via **Outlook SMTP** from `wedding-vip@outlook.com`
  when `SMTP_PASS` is set (host `smtp-mail.outlook.com:587`). Resend is tried
  first only if `RESEND_API_KEY` is present, then SMTP is the fallback
- Onboard and reissue call `deliverVenueAdminInvite`: send unattended, or open
  **Outlook.com compose** (then `mailto:` if the popup is blocked)
- Staff **Invite Members** gets the same Outlook compose button when the
  Edge Function cannot send
- Copy-link remains. No password is stored in the repo

## 2. Operator setup (unattended send)

On the `wedding-vip@outlook.com` account: enable 2FA, create an App Password,
turn on authenticated SMTP (Outlook Settings → Mail → Sync email).

On the `send-email` Edge Function secrets:

- `SMTP_PASS` — the App Password (required)
- optional: `SMTP_USER`, `SMTP_HOST`, `SMTP_PORT`, `EMAIL_FROM` (defaults
  already point at this Outlook mailbox)

Redeploy `send-email` after adding the secret (GitHub **Deploy Edge Functions**
or `supabase functions deploy send-email`).

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | Pass (0 errors / 47 pre-existing warnings) |
| Strict unused-locals scan | Pass |
| `npx vitest run` | **857 passed / 5 skipped** |
| `npm run build` | Pass — 2,294.77 kB / 547.47 kB gzip |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #199.*
