# Review #172: AI Agent Memory & Full-Stack Platform Knowledge Base

## 1. Executive Summary & Objective
- **Goal**: Create an exhaustive, authoritative markdown knowledge base (**`docs/AI_AGENT_MEMORY.md`**) designed specifically as a permanent memory file for any AI Agent working on the **Wedding Venue Intelligence Platform** (`Seven Paths Manor`).
- **Why**: Ensures that any autonomous language model or AI Agent developing, auditing, refactoring, or extending the platform has immediate, deep expertise in full-stack development, web coding standards, UI/UX consistency, quality assurance protocols, architecture, best coding practices, user functionality, and all 8 personas (Venue Admin, Venue Manager, Venue Staff, Booked Couple, Wedding Planner, Day-of-Coordinator, Guest, Preferred Vendor).

## 2. Knowledge Base Structure & Contents
The newly created **`docs/AI_AGENT_MEMORY.md`** covers 8 comprehensive sections:
1. **Platform Identity, Vision & Competitive Positioning**: Tech stack (React 19 + TypeScript + Vite single-file bundle + Tailwind CSS), local-first versioned storage (`src/utils/storage.ts`), typed event bus (`src/utils/appEvents.ts`), and positioning against Tripleseat, Perfect Venue, Planning Pod, AllSeated, Event Temple, Aisle Planner, WeddingWire, and Zola.
2. **Environment Setup & Mandatory Git / CI Protocol**: Restoration scripts (`npm install`, git config, remote setup), 403 push retry rules, and the mandatory 5-gate CI protocol (`typecheck`, `lint:events`, unused locals, `vitest run`, `build`).
3. **Full-Stack Architecture & Best Coding Practices**: Versioned storage schemas and schema migrations (`STORAGE_VERSIONS`), typed event-bus rules (`spm_*`), dynamic branding (`color-mix`), accessible file input patterns (`className="sr-only"` + `<label htmlFor="...">`), and `FileReader` race-condition prevention.
4. **Universal UI/UX Standards & Design Consistency Rules**: Universal rounded-corner main page header parity across all 7 executive modules, modal viewport overflow prevention (`max-h-[94vh]`), Layout Studio header and menu structure, landing page resizable sidebar (`200px` to `450px`), and onboarding notification lifecycle (`Let's build your layout` 2.5-second auto-dismissal).
5. **The 8 Personas**: Exhaustive workflow matrices and functional breakdowns for:
   - *Venue Admin (`#/admin`)*: Branding, RBAC, inventory catalog, full-venue wayfinding map, weather contingencies, automated backups.
   - *Venue Manager (`#/dashboard`)*: High-density KPI stat cards, BEO sheet rollup & printing (`🖨️ Print BEO`), timeline coordination.
   - *Venue Staff / Ops (`#/dashboard` -> `ops`)*: Setup sheets, room assignments, operations studio.
   - *Booked Couple (`#/couples-portal`)*: Hero branding banner (`Hosted at...`), interactive layout canvas editor, guest list & RSVP manager, direct chat.
   - *Wedding Planner*: Master layout templates, seating merges, spacing guidelines.
   - *Day-of-Coordinator*: Minute-by-minute timeline coordination banner (`★ Day of Coordination Booked`), BEO sign-off.
   - *Wedding Guest (`#/guest-portal`)*: Mobile-friendly RSVP, meal selection, lodging assignments, GPS map pin links (`Open in Maps`).
   - *Preferred Vendor (`#/dashboard` -> `vendors`)*: Directory, email (`✉️`) and website (`🌐`) contact links, rating badges.
6. **Core Module Deep-Dives**: Architectural breakdown of the Full Venue Map Designer (`VenueMapDesigner.tsx` / `VenueMapCanvas.tsx`), including base map image uploading, opacity sliders (`10%–100%`), full vector drawing integration (`DrawingTool`), and 4 Preset Zones (`🌳 Ceremony Lawn Zone`, `🅿️ Main Parking Lot`, `🏛️ Main Manor Building`, `🌿 Gardens Boundary`).
7. **Quality Assurance, Automated Testing & Edge-Case Playbook**: Structure of the 165+ test files and 742+ tests, Testing Library rules (`role="button"`, `htmlFor` label clicking), Vitest timer manipulation (`vi.useFakeTimers()`, `act(() => vi.advanceTimersByTime(...))`), and jsdom browser guards.
8. **AI Agent Operational Directive ("Comprehensive" Protocol)**: Rules for autonomous hunting, zero regression, and documentation traceability whenever the user directs a comprehensive audit.

## 3. Verification Summary
- **Typecheck**: Clean (`npm run typecheck` — 0 errors).
- **Event Bus Linter**: 0 raw `spm_*` strings outside typed bus (`npm run lint:events`).
- **Test Suite**: Passed all 742 tests across 165 test files (`npx vitest run`).
- **Production Bundle**: Single-file bundle build verified (`npm run build`, `vite:singlefile`).
