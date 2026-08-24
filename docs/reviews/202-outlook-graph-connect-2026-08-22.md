# Review #202 — Microsoft Graph Outlook send (SMTP is blocked)

> **Superseded:** Graph send was removed in #203. The Graph migration file was
> deleted in #208. Do not apply `0015_platform_outlook_graph.sql`.

Reissue failed with `TLS connect smtp-mail.outlook.com:465 timed out after
8000ms`. Port 587 is blocked on Supabase Edge; port 465 times out. Automatic
Outlook SMTP from this runtime is not possible.

Logs also showed `audit_logs` RLS failures because `send-email` forwarded the
user JWT on a service-role client.

## 1. What changed

- Invites send through **Microsoft Graph HTTPS** (`/me/sendMail`) as
  `wedding-vip@outlook.com`
- Platform Console → **Email**: one-time Azure app + Connect Outlook (PKCE)
- Migration `0015_platform_outlook_graph.sql` stores the refresh token where
  only the service role can read it
- `send-email` uses a real service-role client for Graph tokens and audit logs
- SMTP is skipped unless `SMTP_FORCE=1`

## 2. Operator

1. Apply migration **0015** in the Supabase SQL Editor
2. Wait for **Deploy Edge Functions**
3. Platform Console → Email → follow the Azure steps → **Connect Outlook**
4. Sign in as **wedding-vip@outlook.com**
5. Reissue the venue invite

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | Pass (0 errors / 47 pre-existing warnings) |
| Strict unused-locals scan | Pass |
| `npx vitest run` | **867 passed / 5 skipped** |
| `npm run build` | Pass — 2,306.53 kB / 550.72 kB gzip |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #202.*
