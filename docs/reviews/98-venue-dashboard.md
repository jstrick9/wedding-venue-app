# Review 98 — Venue home dashboard, calendar & consolidated navigation (round 20)

Based on deep web research on dashboard/calendar/event-app UX (visual hierarchy,
F/Z scanning, KPI-first, calendar buckets, persistent nav, progressive
disclosure), and the user's confirmed direction (Dashboard = default landing,
full calendar with month/week/day/agenda, persistent sidebar), built a venue home
page.

## 1. Dashboard is the default landing
Venue users now land on a `VenueDashboard` instead of the layout canvas. The
canvas ("Design Studio") is one click away in the sidebar, and the studio Header
gains a "Dashboard" button to return (closing any open panels via a new
`ModalContext.closeAll`).

## 2. Persistent left sidebar (setup/manage hub)
Groups all sections: Home, Calendar, Couples & Events, plus Vendors, Timeline,
Guests, Operations, Admin, and Design Studio — permission-gated (admin/ops/guests
shown only when allowed). Selecting Vendors/Timeline/Guests/Operations/Admin
switches to the studio behind and opens the existing panel.

## 3. Home widgets (KPI-first, per research)
- KPI cards: active couples, layouts awaiting review, setup completion %, total
  overnight guests (red when over capacity), and open-house count.
- Upcoming events list (couple + venue events within 60 days).
- "This week" mini-agenda.
- Quick actions.

## 4. Full calendar (month / week / day / agenda)
- Shows couple events plus venue-created events (open houses, staffing/work, other),
  color-coded by category with a legend.
- Month grid with day overflow ("+N more"); week strip; day list; agenda.
- Event creation/edit with title, category, date, start/end times, and venue space
  assignment; couple events open the couple portal.
- Data foundation: `VenueCalendarEvent` type + `venueCalendarService` (CRUD, range,
  backup), storage key/version, backup domain, and cascade-delete of couple-linked
  calendar records. `syncCoupleEventsToCalendar` keeps couple events on the calendar.

## Tests
Calendar service unit tests + VenueDashboard render tests (home/sidebar/calendar,
Design Studio action). Full suite: **447 passing / 11 skipped**.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build`
all green. Unused-locals scan clean.
