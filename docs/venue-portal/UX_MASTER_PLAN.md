# Wedding Venue Platform — Master Improvement Plan & Process

*Acting as full-stack developer, QA, and wedding-venue product/UX expert. This is the
operating plan for systematically making the platform the best it can be, walked
persona-by-persona (venue admin → couple → guest).*

## Operating principles
1. **Fix bugs & correctness gaps autonomously** — anything that is a bug, data-integrity
   issue, crash risk, validation hole, or accessibility breakage gets fixed directly and
   committed (each validated with full CI).
2. **UI/UX improvements get options, not unilateral changes** — the user picks from a
   menu of recommendations. This doc + in-conversation questions surface them.
3. **Every persona is walked** — I mentally "use" the app as a venue admin, a couple, a
   planner/family/vendor collaborator, and a guest, and hunt for friction, dead-ends, and
   confusion at each step.
4. **Regression safety** — every change runs `npm run typecheck`, `npm run lint:events`,
   `npx vitest run`, `npm run build`, plus an unused-locals scan.

## Process (per finding)
1. Identify a gap/bug while role-playing a persona.
2. Classify: **BUG** (fix now) vs **UX** (present option).
3. Implement/fix; add a test where a pure function or behavior is involved.
4. Run full CI; commit per finding/module.
5. Track in `docs/venue-portal/venue-portal-review.md` + a numbered `docs/reviews/NN-*.md`.

## Persona walk-through checklist

### 🏛️ Venue admin
- Onboarding (first-run, no spaces/couples/calendar yet) — is it guiding or dead-ended?
- Dashboard KPIs accurate & actionable (reviews due, unread, guest counts, staffing).
- Calendar: blocked dates, recurring events, staff shifts, conflicts, couple events.
- Couples & Events: create/edit events, invite links, approval queue, chat, setup tasks,
  per-couple guest/RSVP/catering view.
- Catalog (tables/chairs/linens/fixtures/decor/structures) + spacing + templates.
- Vendors (preferred showcase) + categories.
- Packages & add-ons (pricing, included items, lodging).
- Wayfinding/rules/weather, branding, access control, users, invites, backup.
- Layout Studio (spaces & layouts home, canvas, print/export).

### 💍 Couple (and planner/family/vendor collaborators)
- Entry via invite link → session → overview progress.
- Questions → recommended spaces → select spaces.
- Package + add-ons + totals.
- Design & approval (layout editor, submit, venue feedback).
- Checklist (grouped by phase), vendors, guests (search/filter/import/export/RSVP),
  guest events & itinerary, per-guest table/room.
- Portal settings (theme, password, tabs, schedule, meal options, deadline, grace).
- Chat with venue; People (collaborators + roles).

### 🌸 Guest
- Invite link → sign-in gate (password / event scope) → home (countdown, hero, welcome).
- RSVP (attending, days/events, meal, plus-one, dietary/special needs, notes).
- Schedule (personal invited events + general schedule, add-to-calendar).
- Map / wayfinding / directions; venue rules; lodging/room; contact venue.

## Current status
The platform is mature: **482 tests passing / 11 skipped**, clean typecheck/build/lint.
A large backlog of fixes/UX work is already committed (see `venue-portal-review.md`).
Remaining work is tracked below as I continue hunting.

## Known deferred items (need live backend — out of scope for offline mode)
- Real transactional email (Supabase `send-email` edge function).
- Wiring a living Supabase project (localStorage is the active provider).
