# Review 96 — Real transactional email wiring + deep merge of admin asset editors (round 18)

Delivered the two previously-deferred larger items.

## 1. Real transactional email (with mailto fallback)
The app runs in localStorage mode today, so real email must work now and upgrade
cleanly when Supabase is configured. Added:
- `sendCoupleEmail` service (`coupleEmailService.ts`) that tries the Supabase
  `send-email` edge function when the platform is configured **and** an org id is
  present, and otherwise falls back to a pre-filled `mailto:` link.
- Couples Portal email actions — email collaborator, email guest, remind guest —
  now route through it with success/info toasts (local mode stays on mailto,
  unchanged but ready to upgrade).
- Extended the `send-email` edge function with `guest_invite` and `guest_reminder`
  purposes + templates and purpose roles.
- Unit tests for the send/fallback logic.

## 2. Deep merge of the venue's admin asset editors
Physically consolidated the Venue & Layout asset editors from **6 top-level tabs
into 2 screens**, each hosting the existing editors via internal sub-tabs (data
models and behavior preserved):
- **"Tables, Chairs & Linens"** = Tables/Seating + Chairs + Linens + Spacing
- **"Fixtures & Walls"** = Fixtures + Walls

Removed the now-dead top-level tab ids (AdminPanel falls back to the first tab
safely). Updated the Tables/Seating and Fixture admin tests for the merged
navigation and added a sub-tab switching test.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build`
all green. Full suite: **434 passing / 11 skipped**. Unused-locals scan clean.
