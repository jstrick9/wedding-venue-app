# Couples & Events Platform — Roadmap

The app is evolving from a single-tenant venue workspace into a **venue-operated,
multi-couple platform**. The existing venue-side tools (catalog, vendors, staff,
checklist, approvals, guest portal) are retained; a **couples portal** is layered on top
so each booked couple gets their own space.

## Target model
- **Venue side (kept):** catalog studio (tables/chairs/decor + inventory), venue spaces,
  venue layout templates, staff, venue checklist/timeline, vendor management, event
  tracking, and the venue's approval of couple layouts.
- **Couple side (new):** when a couple books, the venue creates a **Couple Event**, which
  generates an invitation link. The couple opens their **Couples Portal**, invites
  collaborators (planner, parents, vendors), answers the venue's questions to narrow
  which spaces they can use, designs each space, submits for venue approval, and manages
  their own **per-couple guest portal**.

## Status
- ✅ **Foundation (delivered):** Couple/Event + Collaborator data model, versioned
  localStorage storage service, backup/restore round-trip, venue "Couples & Events" admin
  section (create event, copy invite link, list collaborators), a `#/couples-portal`
  route, and the Couples Portal shell (token access, overview, **Venue Spaces** selection,
  **People** invite/collaborators) with placeholders for Design & Guest Portal.
- ✅ **Phase 1 (delivered):**
  - **Question-driven space selection** — the Couples Portal reuses the venue's existing
    **Event Questions** admin; the couple answers them and the answers **narrow
    recommended venue spaces** (`deriveRecommendedVenueCategories`).
  - **Multi-day events** — a couple event can span multiple days (e.g. rehearsal dinner
    Friday + ceremony Saturday); days are derived across the date span and shown in both
    the venue admin and the couple's Design tab.
  - **Layout per couple event + approval work queue** — each couple submits their layout
    (`layoutStatus`), which appears in the venue's **Layout Approval Queue** with
    approve / request changes / reject + comments.
  - **Venue ↔ couple chat** — a message thread per couple event, available in both the
    venue admin (with unread badge) and the couple's Chat tab.
- ✅ **Per-couple guest portal (delivered):**
  - Each couple manages their own **guest list** in the Couples Portal (Guests tab):
    add/edit/remove guests, **copy a per-guest invite link**, import via CSV, and see
    who has RSVP'd.
  - Each guest portal invite link (`#/guest-portal?token=…&couple=…`) auto-identifies
    the guest and loads the **couple-scoped** portal: a **per-couple portal config**
    (seeded from the venue's config), the couple's guests, and the couple's RSVPs.
  - The venue admin shows a per-couple **guest / attending count** on each event.
- ✅ **Per-couple portal settings (delivered):** the couple can customize their own guest
  portal from a **Portal Settings** tab — welcome message, RSVP message, RSVP deadline,
  access grace period, which tabs are visible, meal choices (add/remove), and schedule
  items. Settings persist per couple event (seeded from the venue config on first open).
- ✅ **Venue-controlled wayfinding + rules (delivered):** the venue builds a full-property
  SVG map (spaces, parking, entries, amenities) in a **Wayfinding & Rules** admin section,
  sets **rain-contingency** backups, and defines **venue rules/regulations**. The couple's
  guest portal renders the map scoped to the couple's selected spaces (+ parking/entry +
  applicable rain-contingency backup) and surfaces the venue rules. Couples do **not**
  control wayfinding points.
- ✅ **Email/mailto invites (delivered):** the couple can send **mailto:** invite emails
  (pre-filled with the link) to collaborators and to each guest, plus copy-link fallback.
  Upgrades to real transactional email when the Supabase send-email backend is configured.
- ✅ **GPS on wayfinding (delivered):** the venue can add lat/lng to each map point;
  guests can tap a pin (or a destination) to open it in Google Maps. Works offline
  (coordinates are manual; "Open in Maps" opens externally).
- ✅ **Weather tracking on the timeline (delivered):** the venue/coordinator can enter a
  forecast per event day (or auto-fetch a free 7-day forecast by location via the
  Open-Meteo API, no key). The forecast appears alongside each day in the couple's guest
  portal schedule/timeline.
- ✅ **Drawn walkway paths (delivered):** the venue can draw named walkways as ordered
  polylines between map points; they render as dashed routes in both the admin and the
  couple's guest portal map.
- ✅ **Couple hero image (delivered):** the couple can set/clear their guest portal hero
  image (URL with live preview) in Portal Settings.
- ✅ **Venue rules on guest-portal home (delivered):** venue rules now appear on the
  guest portal home screen as well as the wayfinding tab.
- ✅ **Per-space layout design & approval (delivered):** the couple marks each selected
  space as draft/designed/submitted with notes; submitting for approval flags all spaces
  as submitted, and the venue's approval queue shows each space's status + notes inline.
- ✅ **Approval review notes (delivered):** the venue can write a per-couple note with
  approve / request changes / reject; the couple sees the full review history (action,
  who, note, timestamp) on their Design tab.
- ✅ **Couple overview dashboard (delivered):** the Overview tab now shows a progress
  checklist (questions, spaces, submission, guests, personalization) with quick jumps,
  plus "Copy portal link" and "Preview portal" actions.
- ✅ **Venue event lifecycle (delivered):** the venue can mark a couple event complete /
  reopen it from the Couple Management card.
- 🚧 **Future ideas:** real transactional email (needs live Supabase); embedding the full
  layout canvas inside the couple's design tab.

## Data model (see src/types.ts)
- `CoupleEvent`: id, coupleName, inviteToken, status (invited/active/completed),
  eventDate(s), guestCount, availableSpaces (venue ids), selectedSpaces, collaborators.
- `CoupleCollaborator`: id, name, email, role (couple/planner/family/vendor), inviteToken.
- `CoupleSession`: eventId + collaboratorId + role, persisted with a 30-day TTL.

## Services
- `src/services/couples/coupleService.ts` — CRUD, token resolution, session mgmt,
  URL-token extraction.
- Storage keys: `spm_couple_events`, `spm_couple_session`.

## Screens
- Admin → **Couples & Events** (`src/components/admin/CoupleManagement.tsx`).
- Couples Portal (`src/components/CouplesPortal.tsx`) at `#/couples-portal?token=…`.
