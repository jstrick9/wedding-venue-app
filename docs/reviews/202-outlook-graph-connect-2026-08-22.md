# Review #202 — Microsoft Graph Outlook send (SMTP is blocked)

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

Recorded after local CI gates.

---

*End of Review #202.*
