# Review #201 — Unblock automatic Outlook send on Supabase Edge

Reissue still failed with `Failed to send a request to the Edge Function`.
Deploy of Review #200 succeeded. The function never returned a CORS JSON
body, so the browser reported a fetch failure.

## 1. Cause

Supabase Edge / Deno Deploy **blocks outbound SMTP on ports 25 and 587**.
`send-email` defaulted to `smtp-mail.outlook.com:587`. That connect hangs
until the isolate is dropped. The client then shows a generic fetch error.

Official Supabase SMTP example: use a port other than 25/587 (465 implicit
TLS, or a provider submission port such as 2587).

## 2. What changed

- Removed `denomailer`. The function now speaks SMTPS itself over **port 465**
  with 8s connect / 18s overall timeouts
- Ports 25 and 587 are rewritten to 465 even if `SMTP_PORT` is set to them
- The entire handler is try/caught and always returns CORS JSON
- `audit_logs` insert failures no longer drop the response
- The client maps the generic fetch error to a port-465 explanation and
  times out after 25s

From address is still `Wedding VIP <wedding-vip@outlook.com>`. `SMTP_PASS`
does not change.

## 3. Operator

Wait for **Deploy Edge Functions** on this commit, then reissue. Do not
paste the App Password. If 465 is also refused by Outlook, the toast will
now show the SMTP reply instead of a fetch failure.

## 4. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | Pass (0 errors / 47 pre-existing warnings) |
| Strict unused-locals scan | Pass |
| `npx vitest run` | **862 passed / 5 skipped** |
| `npm run build` | Pass — 2,298.67 kB / 548.54 kB gzip |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #201.*
