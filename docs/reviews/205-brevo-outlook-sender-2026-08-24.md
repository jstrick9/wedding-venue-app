# Review #205 — Force Brevo sender to wedding-vip@outlook.com

Brevo rejected invite send because the from-address was
`invites@weddingvip.com` (leftover `EMAIL_FROM` from the unused Resend /
weddingvip.com plan), not `wedding-vip@outlook.com`.

## 1. What changed

- `send-email` always sends as **wedding-vip@outlook.com**
- Leftover `EMAIL_FROM` secrets such as `invites@weddingvip.com` are ignored
- Sender rejections now tell the operator to verify the Outlook mailbox
- Branding setup copy matches

## 2. Operator

1. Brevo → Senders → add **wedding-vip@outlook.com** → confirm the email
2. Optionally delete the leftover `EMAIL_FROM` secret (no longer used)
3. Redeploy `send-email` (this commit changes the function; GitHub Action should run)
4. Reissue the invite again

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pending |
| `npm run lint:events` | Pending |
| `npm run lint` | Pending |
| Strict unused-locals scan | Pending |
| `npx vitest run` | Pending |
| `npm run build` | Pending |
| `npm run build:split` | Pending |
| `npm audit --omit=dev` | Pending |

---

*End of Review #205.*
