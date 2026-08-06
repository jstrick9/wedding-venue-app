# Venue Portal — Comprehensive UX/Product Review

*Acting as a wedding-venue product/UX expert. Grounded in research on leading
venue-management platforms (Tripleseat, Perfect Venue, Planning Pod, AllSeated,
Event Temple, Aisle Planner, WeddingWire, Zola) and a deep review of the current
codebase. Items are prioritized (P0 = high impact / directly requested,
P1 = valuable, P2 = polish).*

## Status
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
- ⏳ **B4 (partial) — Layout Studio**: print/export already exists via PrintView;
  space picker + template gallery + capacity summary remain.
- ⏳ **B5 (remaining)** — shared toast/confirm/modal unification + a11y/reduced-motion.

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
