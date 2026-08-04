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
- 🚧 **Next phases** (in priority order):
  1. **Question-driven space selection** — venue writes questions (guest count, style,
     etc.); couple answers and gets recommended/eligible spaces.
  2. **Design & approval per couple** — tie the existing layout designer + submission
     workflow to a couple event; couple designs spaces, venue approves/changes.
  3. **Per-couple guest portal** — each couple manages their own guest list + guest portal
     (reuse the existing GuestPortal, scoped per couple event).

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
