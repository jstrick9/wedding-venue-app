# Review #213 — Operator-first Platform console actions

Reissue, suspend, onboard, and other console mutations still waited on a
full `loadConsole()` (including `get_platform_console_metrics`). Overview
KPIs all opened the unfiltered directory. Venue status was a Save-form
dropdown. Map pins did not open venue detail. Audit logs hid the actor.

## 1. What changed

- Reissue, revoke, suspend, reactivate, activate, archive, and onboard
  refresh the venue list in the background (same path as #212 Save)
- Overview KPIs deep-link into a filtered directory. **Awaiting admin**
  is no owner **or** provisioning. **Pending invites** is a KPI. Expired
  invites are a third overview queue and a directory badge
- Status is a read-only badge. Buttons: **Activate venue**, **Suspend
  venue access**, **Reactivate venue**, **Archive venue**. Save keeps the
  current status
- Reissue uses an inline **Invite email** field (no `window.prompt`)
- Map selected card and table **Open / edit** open venue detail
- Workspace card appears only when this browser has a venue login.
  Opening `#/home` does not replace the platform login
- Audit table shows Actor (name and email from `profiles`)

## 2. Operator

1. Hard-refresh after the Vercel deploy
2. Overview: click **Pending invites** or **Awaiting admin** — the
   directory should filter. Sidebar **Venues** still opens unfiltered
3. Open a provisioning venue → **Activate venue** (not Status → Save)
4. Reissue by editing Invite email and clicking **Reissue & email invite**
5. Map: select a pin or use the table **Open / edit**
6. Audit: confirm the Actor column

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | 0 errors / 47 warnings |
| Strict unused-locals scan | Clean (non-test; grep printed nothing) |
| `npx vitest run` | **893 passed / 5 skipped** |
| `npm run build` | Pass — **2,317.92 kB / 554.32 kB gzip** |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #213.*
