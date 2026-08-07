# Venue Portal — Comprehensive UX/Product Review

*Acting as a wedding-venue product/UX expert. Grounded in research on leading
venue-management platforms (Tripleseat, Perfect Venue, Planning Pod, AllSeated,
Event Temple, Aisle Planner, WeddingWire, Zola) and a deep review of the current
codebase. Items are prioritized (P0 = high impact / directly requested,
P1 = valuable, P2 = polish).*

## Status
- ✅ **Couple guest-portal password**: couples can now set / change / remove a guest
  portal entry password (hashed) from their Portal Settings. Committed.
- ✅ **Guest RSVP event checkboxes safe-time**: the "Which events will you attend?"
  checkboxes now use safe time formatting (no crash on malformed times). Committed.
- ✅ **Venue dashboard recurring events**: the Today strip + Upcoming pipeline now
  expand recurring calendar events (weekly/monthly/yearly) across all occurrences.
  Committed.
- ✅ **Guest personal events: add-to-calendar + safe time**: the guest's "Your invited
  events" list now has an Add to calendar action and uses safe time formatting.
  Committed.
- ✅ **Couple-event guest-count validation**: the venue's create/edit couple event
  forms now reject NaN/negative/0 guest counts with a clear error. Committed.
- ✅ **Package & add-on numeric guards**: package forms now clamp prices/guest counts
  to finite non-negative values and require `maxGuests > 0` (instead of silently
  saving "unlimited"); add-on price is guarded from NaN/negative. Committed.
- ✅ **Guest-access-closes guard**: the couple's Portal Settings "Guest access closes"
  field now treats empty/NaN as the default 36h instead of 0/NaN (which would close
  the portal at event-day end or break grace-period math). Committed.
- ✅ **Guest CSV export includes Table/Seat & Room**: the couple's exported guest list
  now carries seating and lodging assignments (which were editable but not exported).
  Committed.
- ✅ **Collaborator role editing**: the couple can now change a collaborator's role
  (planner/family/vendor) after inviting, without removing + re-inviting. Committed.
- ✅ **Staff-shift data-integrity**: deleting a calendar event now cascade-deletes its
  linked staff shifts; shift sync now reconciles (removes dropped assignees, updates
  times/roles, clears on unassign-all) instead of only adding. Committed.
- ✅ **Calendar event detail + guest-event location**: the venue calendar detail now
  shows end time, venue space, notes, and recurrence; couples can set a guest
  event's location (shown in venue + guest itinerary). Committed.
- ✅ **Safe date formatting, guest-event day/time editing, capacity warnings**: the
  couple portal no longer crashes on malformed dates; the couple can edit a guest
  event's day + start time; the venue creation form warns when guest count exceeds
  package cap; the RSVP per-event summary flags over-capacity attendance. Committed.
- ✅ **Guest seat/room assignment, capacity guards, deadline display, add-ons total**:
  couple can now assign each guest a table/seat & room (was shown in the guest portal
  but not editable; surfaced in venue guest view too); guarded guest-event capacity
  from NaN/0; fixed RSVP-deadline message off-by-one; added selected add-ons count +
  total on the Package tab. Committed.
- ✅ **Brand consistency completion + calendar/couple/warning/mobile round**: brand
  purple extended to every active venue/admin surface (removed leftover indigo);
  blocked-date conflict detection now covers multi-day couple events; couple portal
  warns on submitting with no drawn layout; venue couples admin flags over-capacity
  guest counts; venue dashboard sidebar is now a mobile drawer. Committed.
- ✅ **Venue-branding + per-couple guest-portal theming (user-directive)**: the
  Couples Portal now uses the venue brand accent (was off-brand indigo); added a
  per-couple **Theme color** setting so each couple can brand their own guest
  portal, which falls back to the venue brand color by default. Also: venue
  calendar event-form validation, and guest search + RSVP filter in the couple's
  guest list. Committed.
- ✅ **Couples portal + dashboard polish round**: couple checklist grouped by phase;
  fixed add-on→guest-event auto-derivation for add-ons added later; replaced the
  horizontal-scroll tab bar with wrapping pill tabs; fixed the dashboard "This week"
  widget (was 30-day window) and surfaced multi-day couple events on every booked
  day in the dashboard; guest RSVP submit now says "Update RSVP" for returning
  guests. Committed.
- ✅ **Guest-count ↔ seating-capacity verification (couple layout)**: the couple's
  layout editor now computes seating capacity from placed tables and shows
  "Seats X / Y guests" with an amber warning when a space under-seats the couple's
  expected guest count; the venue's approval queue shows the same per-space capacity
  vs guest count so it can verify before approving. Committed.
- ✅ **Guest RSVP deadline bug fix**: a date-only RSVP deadline (from the couple's
  portal settings date input) resolved to midnight UTC and closed RSVPs a day early
  in US timezones; it now stays open through the end of the local deadline day.
  Committed.
- ✅ **Venue calendar enhancements**: couple events now show guest count, and
  multi-day couple events are surfaced on **every** booked day (not just the first).
  Committed.
- ✅ **Guest RSVP a11y**: attending Yes/No buttons now carry `aria-pressed` for
  keyboard/screen-reader users. Committed.
- ✅ **Admin & System Settings reorg (user-directive)** — the venue Admin is now a
  settings console titled "Admin & System Settings" with five categories
  (Venues & Inventory, Layout Content, Couples Portal, System Brand & Access,
  System & Backup). Decor moved into Venues & Inventory; Spacing moved out of
  Tables/Chairs/Linens into Layout Content; Event Questions moved into Couples
  Portal; the Guest Portal config was removed from the venue (couples configure
  their own); Users/Access/Invites moved into System Brand & Access. Navigation
  redesigned to a category rail + wrapping section pills — the horizontal
  scrollbar is gone. Committed.
- ✅ **Couples Portal naming consistency** — renamed the venue dashboard's
  "Couples & Events" section (sidebar label, KPIs, onboarding card, section heading)
  and the CoupleManagement admin heading to "Couples Portal", matching the admin
  category. Committed.
- ✅ **Dashboard + Design Studio UX polish** — dashboard sidebar/quick-action
  "Admin" → "Admin & System Settings" (quick actions redesigned to stacked buttons);
  Design Studio's Workspace Snapshot + Grid & Snap moved from every Layout Tool
  section into the Settings section; Quick find made collapsible (default collapsed);
  Layout Tools section tabs now always show their names as labeled pills. Committed.
- ✅ **A2 — Vendor preferred-vendors showcase** (dynamic categories; payments/budget
  removed). Committed.
- ✅ **A1 — Removed venue guest management** (dashboard/header/studio/overview
  entries; Properties shows read-only seating capacity). Committed.
- ✅ **A3 — Admin as its own page (`#/admin`)** — dedicated full-page destination
  with header + back button; hash routing; dashboard/header route to it. Committed.
- ✅ **A4 — Layout Studio as its own module (`#/studio`)** — dedicated route with a
  Layout Studio breadcrumb strip (module name + space + back). Committed.
- ✅ **A5 — Design-system consistency pass (foundation)** — shared `src/components/ui`
  kit (Button/Card/Badge/SectionHeader/EmptyState) adopted in the dashboard; more
  surfaces can migrate incrementally. Committed.
- ✅ **B1 — Dashboard**: live "Unread couple msgs" + "Approvals due" KPIs, a
  "Today" strip, and This-week/Later pipeline grouping. Committed.
- ✅ **B2 — Vendor showcase**: shows how many couples use each preferred vendor.
  Committed.
- ✅ **B3 — Admin**: richer per-category landing summary (Venues, Tables/Seating,
  Packages, Couples, Templates, Users). Committed.
- ✅ **B5 (partial) — shared date/time helpers** (`src/utils/dateTime`). Committed.
- ✅ **B1 (added) — availability/blocked dates**: new 'Blocked / Unavailable'
  calendar category so the venue can mark dates unbookable. Committed.
- ✅ **B4 — Layout Studio home** — new `StudioLayoutsHome` panel in the studio
  breadcrumb ("🏛️ Spaces & Layouts"): a space picker with per-space capacity +
  master-layout status, a capacity summary strip (spaces / total seating / spaces
  with master), and a quick category-filtered template gallery. Template application
  now flows through one shared `handleTemplateSelect` (overwrite guard + space
  switch) reused by both the gallery and the standalone `TemplateSelector`.
  Print/export was already covered by PrintView. Committed.
- ✅ **B5 — confirm unification**: new promise-based `useConfirm()` hook renders one
  shared, accessible `ConfirmDialog` (trap focus, Escape-cancel, non-blocking).
  Replaced all remaining native `window.confirm` calls (PackageManagement
  packages/add-ons, VenueWayfindingManagement map reset, CoupleManagement event
  delete, CustomVenueBuilder unsaved-changes guard). Toast was already unified via
  `showToast`; modals via `ModalDialog`/`CenteredModal`. Reduced-motion media query
  already present globally. Committed.
- ✅ **B5 — VenueCalendar adopts shared `ui` kit**: view switcher → `Button`
  (tone + `aria-pressed`), “+ Add event” → success `Button`, category legend →
  `Badge`, and day/agenda empty states → `EmptyState`. Keyboard focus/a11y are
  covered by the global `:focus-visible` styles + reduced-motion media query.
  Committed.
- ✅ **Cleanup (from studio/calendar pass)** — studio home now routes through the
  venue-switch guard (no silent unsaved-work loss), is scoped to `selectableVenues`,
  and the dead `'guests'` modal was removed. Committed.
- ✅ **B5 — VendorPanel adopts shared `ui` kit** (empty state, add/save/cancel
  buttons) for consistency with the dashboard/calendar. Committed.
- ✅ **Calendar data-integrity — blocked-vs-booked conflict warning**: the venue
  calendar now flags any date that is both "Blocked / Unavailable" AND holds a
  confirmed couple event, so a venue can't silently block a booked day. Logic
  extracted to a tested pure helper (`src/utils/calendarConflicts`). Committed.
- ✅ **Dashboard — actionable review KPIs**: "Awaiting layout review" and
  "Approvals due" cards are now buttons that open Couples & Events; the section
  gained a "Review & approve layouts in Admin" action and a per-couple "Review →"
  link when a layout is pending/changes-requested. Committed.
- ✅ **Brand consistency — UI kit primary tone aligned to the venue brand**: the
  shared `Button`/`Badge`/`inputCls` primary accent was indigo while the rest of the
  app is the purple brand (`#4A1942`). Aligned the kit + StudioLayoutsHome + calendar
  "Design Studio" button to the brand for platform-wide consistency. Committed.
- ⏳ **B5 (remaining)** — migrate remaining standalone panels (ops, timeline)
  onto the shared kit for full consistency.

## Guiding principles (from research)
- **Venue ops ≠ couple planning.** The best tools separate the venue's back-office
  (bookings, availability, preferred vendors, floor plans, staffing, contracts) from
  the couple's guest/planning portal. Remove venue-side guest management entirely.
- **Preferred-vendor marketplace.** Tripleseat's "Marketplace" and Aisle Planner's
  vendor directory show that a venue's vendor tool is a *showcase* organized by
  category (food, bar, photography, floral…), not a payment ledger.
- **Floor-plan/diagramming is its own module** (AllSeated, Planning Pod): a
  dedicated layout studio, not buried inside generic "admin".
- **Admin is a destination, not a modal.** Group tools by category with clear
  navigation and minimal chrome (consistent with dashboard best practices).
- **Consistent design system**: one palette, type scale, button/card/tab styles
  across dashboard, studio, admin, and portals.

---

## A. Directly requested changes (P0)

### A1. Remove guest management from the Venue portal
**Current:** `GuestPanel` (guest CRUD, seating assignments, CSV import, meal/RSVP)
is reachable from the venue Header ("Guests"), the studio overlay, and the
dashboard sidebar. It's wired to the venue's `layoutState.guests`.

**Action:**
- Remove the **Guests** sidebar item, Header "Guests" button, and `open('guests')`
  pathways from the venue side.
- **Keep guest *seating capacity* on the layout canvas** (a table's capacity still
  uses guest count for over-capacity warnings) but decouple it from a venue-managed
  guest list — the couple owns guests. If the canvas seating count needs a number,
  use the couple's `guestCount`/RSVP totals from the couple portal instead of a
  venue-edited list.
- Guest management remains fully in the **Couples Portal** (already built).

### A2. Vendor management = preferred-vendors showcase by category
**Current:** `VendorPanel` has tabs *List / Add / Budget / Payments* with
`VendorPayment`, `contractAmount`, `depositPaid`, `finalPaymentPaid` etc. —
i.e. a payments/budget ledger. Categories are a fixed const.

**Action:**
- **Remove** Payments + Budget tabs and the `VendorPayment` model (deprecate the
  storage key; keep backup tolerant of its absence).
- **Preferred vendors by category**: each vendor is a "preferred vendor" with
  name, category, contact, phone, email, website, notes, a short description, and
  optional photo — a showcase a couple can browse (already used in the Couples
  Portal's vendor picker).
- **Venue-created categories**: replace the fixed `VendorCategory` union with a
  stored category list (id, label, icon) the venue manages (Food/Catering,
  Bar Service, Photography, Floral, DJ/Band, Officiant, etc.). Seed sensible
  defaults. Update all consumers to read dynamic categories.

### A3. Admin tools open in their own page, best-in-class by category
**Current:** `AdminPanel` is a full-screen overlay (or inline in the dashboard).
Tabs are grouped into 4 sections but render in one modal.

**Action:**
- Give Admin its **own full-page destination** (a `#/admin` route or a dedicated
  view that replaces the dashboard content, not an overlay) with:
  - A **left nav by category** (Venue & Layout, Design & Content, People & Access,
    Couples & Events, Portal & Brand) with icons and counts.
  - Each category page has a consistent header, search, and responsive card/list
    layout (per dashboard best practices: hierarchy, whitespace, clear grouping).
  - Keep the "inline in dashboard" option available via the dashboard sidebar.

### A4. Venue Layout creation as its own module
**Current:** The layout canvas ("Design Studio") is a `view` inside
`AuthenticatedApp` sharing the app shell with panels.

**Action:**
- Promote the canvas to a **dedicated "Layout Studio" module** with its own route
  (`#/studio`) and a focused workspace (sidebar palette + canvas + properties),
  separated from dashboard and admin. Give it a clear breadcrumb/back path and a
  "Layouts" home (list of venue spaces/templates) so it reads as its own product,
  not an overlay.

### A5. UI/UX consistency across the platform
**Action:**
- Centralize shared UI primitives (buttons, cards, section headers, badges, empty
  states, form inputs, modals) into a small design system used by dashboard,
  studio, admin, and both portals — consistent spacing, radius, typography, color
  semantics (success/warning/danger), and icon usage.
- Unify the top bar / sidebar so dashboard, studio, and admin share the same nav
  language and return paths.

---

## B. Additional venue-expert improvements (P1)

### B1. Dashboard
- Add **booking pipeline** feel: upcoming events grouped by status (confirmed /
  awaiting layout / complete), plus a "today" strip.
- **KPI accuracy**: pull open-house and staffing counts live; add "unread couple
  messages" and "approvals due" counters.
- Add an **availability/blocked calendar** helper (mark a date unbookable).
- Empty states: when a section has no data, give a clear "how to" action (already
  started in onboarding).

### B2. Vendor (preferred) showcase
- Category tiles view (Food / Bar / Photography / Floral…) with vendor cards and
  a "preferred" badge; search + filter by category.
- Show which couples are using each preferred vendor (link to couple vendors).
- Reusable vendor detail card shown in the Couples Portal (already wired) and the
  venue.

### B3. Admin organization
- Per-category landing summaries (counts of venues, tables, users, packages).
- Batch/undo affordances and inline validation consistent across asset editors.

### B4. Layout Studio
- Space picker + per-space master layouts; quick template gallery; export (PNG/PDF)
  per layout; capacity summary.

### B5. Consistency/polish
- One shared toast + confirm + modal system everywhere.
- Keyboard a11y, focus states, and reduced-motion across all surfaces.
- Consistent date/time formatting helpers.

---

## C. Planned implementation phases (proposed)
1. **Data/model**: dynamic vendor categories; deprecate `VendorPayment`;
   decouple venue guest list.
2. **Vendor showcase** (remove payments/budget; category tiles).
3. **Remove venue guest management** (UI + wiring); keep seating capacity.
4. **Admin as own page** (route + category nav).
5. **Layout Studio as own module** (route).
6. **Design-system pass** for consistency.

*This is intentionally a plan-first review: the requested changes are large and
interdependent. A few decisions need your confirmation before I build — see the
questions in the conversation.*
