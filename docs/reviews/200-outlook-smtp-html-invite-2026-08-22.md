# Review #200 — Automatic Outlook SMTP send and HTML invite format

Venue-admin invites were opening Outlook.com compose because `send-email`
crashed on `ReferenceError: DEFAULT_SMTP_USER is not defined`. The compose
deeplink also encoded spaces as `+`, which Outlook.com displayed literally.

## 1. What changed

- Defined Outlook SMTP defaults and imported `SMTPClient` in `send-email`.
  Unattended send from `wedding-vip@outlook.com` can run when `SMTP_PASS` is
  set. Port 587 is tried first; port 465 implicit TLS is the fallback.
- Onboard and reissue no longer auto-open Outlook.com. SMTP failure is toasted
  and the manual **Send with Outlook** / copy-link backups remain.
- Invite HTML uses a **Set up your account** button. The tokenized setup URL
  is the button `href` only — it is not shown as visible text. Plain-text
  clients still receive the URL.
- Greeting is `Hello {first} {last},`. Onboard and venue edit now collect
  **Contact first name** and **Contact last name**. Combined name is still
  stored in `primary_contact_name`.
- Outlook compose links use `%20` instead of `+` so a manual send is readable.

## 2. Operator note

`SMTP_PASS` is already set. Redeploy `send-email` (push to `main` runs
**Deploy Edge Functions**, or use **Run workflow**). Do not paste the App
Password into git or chat.

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | Pass (0 errors / 47 pre-existing warnings) |
| Strict unused-locals scan | Pass |
| `npx vitest run` | **861 passed / 5 skipped** |
| `npm run build` | Pass — 2,298.07 kB / 548.28 kB gzip |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #200.*
