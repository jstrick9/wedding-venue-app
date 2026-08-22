# Review #203 — Manual HTML Outlook invite (remove Graph)

Azure / Microsoft Graph connect is not a free path the operator can use.
Automatic send (Graph + Outlook SMTP) is removed. Invites are sent by clicking
**Send with Outlook**.

Outlook.com compose cannot render HTML, so the button downloads a ready-to-send
`.eml` draft (`X-Unsent: 1`) with a real **Set up your account** button. Open
the file in Outlook as `wedding-vip@outlook.com` and click Send.

## 1. What changed

- Removed Connect Outlook, Platform Console **Email** nav, PKCE/OAuth helpers,
  and Graph/SMTP send code from `send-email`
- Onboard / reissue / staff invite no longer call the Edge Function
- **Send with Outlook** downloads an HTML multipart `.eml` from
  `wedding-vip@outlook.com`
- Greeting stays `Hello {first} {last},`; the tokenized URL is the button href
  only
- In-app HTML preview shows the button email after create/reissue

## 2. Operator

1. Create or reissue the venue invite
2. Click **Send with Outlook (wedding-vip@outlook.com)**
3. Open the downloaded `.eml` in Outlook
4. Click Send

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | Pass (0 errors / 47 pre-existing warnings) |
| Strict unused-locals scan | Pass |
| `npx vitest run` | **862 passed / 5 skipped** |
| `npm run build` | Pass — 2,300.54 kB / 549.23 kB gzip |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #203.*
