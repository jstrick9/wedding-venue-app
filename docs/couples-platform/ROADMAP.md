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
- 🚧 **Future ideas:** couple-side editing of wayfinding points / hero image; email
  invitations for collaborators.

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
