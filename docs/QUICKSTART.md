# Wedding Venue Intelligence Platform — Quick-Start Cheat Sheet

> **Current audit note (2026-08-18):** Local mode is the complete, exercised product mode for one venue with many couple events. Supabase support is a partial backend seam, not yet a production-complete shared implementation; review `docs/reviews/173-comprehensive-platform-code-and-domain-audit-2026-08-18.md` before enabling it for real venue data. Local data is per browser/device; use Backup & Restore to move a vetted workspace between devices.

## Run it locally (local mode, no backend — 3 commands)

```bash
git clone https://github.com/jstrick9/wedding-venue-app-old.git
cd wedding-venue-app-old
npm install
npm run dev
```

Open **http://localhost:5173**. No `.env` file needed — this runs entirely in your
browser using `localStorage`, with a seeded "Seven Paths Manor" sample workspace
so you can test everything immediately.

> Everything below works in local mode. To enable the multi-user Supabase
> platform instead, see `docs/platform/PLATFORM.md`.

---

## Signing in

| What | How |
|---|---|
| **Admin** | Username `admin`, password `REPLACE_ON_FIRST_LOGIN`. On first login it forces you to set a new password. |
| **Planner guest** | On the login screen, click **"Continue as Planner Guest"** — explore without an account. |
| **Wedding guest** | Use the **Guest Portal** (below), not this login. |

---

## Main workspace — where everything is

- **Left sidebar** → drag **tables, chairs, fixtures, decor** onto the canvas.
- **Header (top)**: Templates · Guests · Admin · Workspace Help · Menu.
- **Canvas (center)**: your floor plan. Drag items; **arrow keys nudge**;
  **Ctrl/Cmd + scroll** zooms (to cursor); **Shift + drag** pans.
- **Bottom-left**: capacity counter + **📊 Overview** button (dashboard).

### Header buttons
| Button | Opens |
|---|---|
| **Templates** | Prebuilt layouts (Classic Reception, Banquet, Ceremony, Cocktail) |
| **Guests** | Guest list, table/room assignment, CSV import/export |
| **Admin** (admins only) | Admin Panel with all settings |
| **Help** | Keyboard-shortcuts modal |

---

## Admin Panel (admins only)

Click **Admin** in the header. It's grouped into labeled sections:

- **Venue & Layout** — Venues, Tables/Seating, Chairs, Fixtures, Walls, Linens, Spacing
- **Design & Content** — Decor, Templates, Guidelines, Event Questions
- **People & Access** — Users, Access Control, **Invite Members**
- **Portal & Brand** — Guest Portal, Branding
- **System & Backup** — **Backup & Restore**

Use the **Quick find** box to jump to a section. Most editors auto-save as you
edit (a debounced "saved" indicator confirms).

**Tip:** Use **System & Backup → Backup & Restore** to download a full backup,
and restore it to move data between computers/browsers.

---

## 📊 Event Overview dashboard

Click **📊 Overview** (bottom-left, near the capacity counter). It shows the
"Intelligence" view of the current event:

- RSVP status (guests, confirmed, pending, declined, response rate)
- Seating coverage (seated, unseated, table seats, utilization)
- **Vendor budget** (contract, paid, balance, overdue)
- Health grade (On Track / Needs Attention / Over Capacity) + actionable notes
- Quick actions: **Manage Guests**, **Load a Template**, **Manage Vendors**

---

## 💍 Guest Portal (for wedding guests)

Open **`http://localhost:5173/#/guest-portal`**. It requires configuration first
— an admin must enable it before guests can use it.

**To set it up:** **Admin → Guest Portal** tab → enter the event title/date,
turn on the tabs you want (Map / Schedule / Wayfinding / RSVP / Lodging), set an
optional portal password, and add guests (email / portal token).

**How a guest signs in:**
- Enter the **event name** (must match the configured event title).
- Enter their **email, name, or portal token** (as configured in Admin → Guest
  Portal guests).
- Enter the **portal password** if one is set.

**What guests can do:** RSVP (meal choice, plus-one, dietary/special needs),
view the schedule, get wayfinding directions, check lodging, and export
schedule items to their calendar (`.ics`).

---

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` | Redo |
| `Delete` / `Backspace` | Delete selected item |
| `Esc` | Deselect / close |
| `Enter` / `Space` | Select focused canvas item |
| `← ↑ → ↓` | Nudge item (Shift = 1 ft) |
| `Ctrl/Cmd + scroll` | Zoom (to cursor) |
| `Shift + drag` | Pan canvas |

---

## Common validation commands

```bash
npm run typecheck   # TypeScript check
npm run test        # current baseline: 735 passed / 11 skipped
npm run build       # production build → dist/index.html
npm run test:coverage # optional coverage report
npm run build:split   # optional hosted/server code-split build
npm run preview     # serve the built app
```

---

## To go live with the multi-tenant platform (Supabase + Vercel)

The current setup runbooks are:

- `docs/platform/PLATFORM.md` — backend architecture and original Supabase setup.
- `docs/platform/MULTI_TENANT_PLATFORM.md` — platform owner, venue tenants, managed-admin onboarding, and tenant smoke test.

Short version:
1. Create/configure the Supabase project and Vercel environment variables.
2. Apply migrations `0001` through `0008` in order. Migrations `0006`–`0008` add the platform-control layer, venue-specific branding, portal access lifecycle, immutable slugs, invite management, suspension, and metrics.
3. Bootstrap the first `platform_owner` once in Supabase SQL Editor using the operator's Auth user id/email.
4. Sign in at the root application URL to open the Platform Admin Console.
5. Create a venue organization and copy its one-time managed-admin setup link.
6. Have the venue administrator claim the link, create their own Supabase Auth account, and then use **Admin → Invite Members** for venue staff/planners.
7. Run the platform-owner, managed-admin, tenant-isolation, and couple/guest cross-device smoke tests before using production data.

Cloud venue accounts are invitation-only. The old local `admin`/`REPLACE_ON_FIRST_LOGIN` account is not the Supabase platform authority.
