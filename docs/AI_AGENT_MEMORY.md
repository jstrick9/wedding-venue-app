# 🧠 AI AGENT MEMORY & KNOWLEDGE BASE: WEDDING VENUE INTELLIGENCE PLATFORM

> **Primary Objective**: This document serves as the permanent, authoritative operational memory and full-stack knowledge base for any Autonomous AI Agent developing, auditing, refactoring, or extending the **Wedding Venue Intelligence Platform** (`Seven Paths Manor` / `venue-app`).
> 
> When an AI Agent loads this document into memory, it gains comprehensive mastery of the codebase architecture, full-stack web coding standards, UI/UX design rules, quality assurance protocols, persona-driven workflows (all 8 personas), and continuous integration (CI) requirements.

---

## TABLE OF CONTENTS
1. [Platform Identity, Vision & Competitive Positioning](#1-platform-identity-vision--competitive-positioning)
2. [Environment Setup & Mandatory Git / CI Protocol](#2-environment-setup--mandatory-git--ci-protocol)
3. [Full-Stack Architecture & Best Coding Practices](#3-full-stack-architecture--best-coding-practices)
4. [Universal UI/UX Standards & Design Consistency Rules](#4-universal-uiux-standards--design-consistency-rules)
5. [The 8 Personas: Comprehensive Workflow & Functional Expertise](#5-the-8-personas-comprehensive-workflow--functional-expertise)
6. [Core Module Deep-Dives & Key Implementations](#6-core-module-deep-dives--key-implementations)
7. [Quality Assurance, Automated Testing & Edge-Case Playbook](#7-quality-assurance-automated-testing--edge-case-playbook)
8. [AI Agent Operational Directive ("Comprehensive" Protocol)](#8-ai-agent-operational-directive-comprehensive-protocol)
9. [Current Audit Snapshot & Production Truth (2026-08-18)](#9-current-audit-snapshot--production-truth-2026-08-18)

---

## 1. PLATFORM IDENTITY, VISION & COMPETITIVE POSITIONING

### 1.1 Platform Identity
- **Name**: Wedding Venue Intelligence Platform (default brand: *Seven Paths Manor* / *Weddings Reimagined*).
- **Tech Stack**: React 19 + TypeScript + Vite (`vite:singlefile` single-file HTML bundle distribution) + Tailwind CSS + Lucide/Unicode Iconography.
- **Data Provider**: The default and fully exercised provider is versioned local-first storage (`localStorage` via typed `src/utils/storage.ts`) with reactive event-bus synchronization (`src/utils/appEvents.ts`). Supabase is a partial backend seam; do not describe it as a complete shared platform until the P0 items in Section 9 are fixed.
- **Production Bundle**: The default build produces one HTML artifact (`dist/index.html`, approximately 1.79 MB uncompressed / 409 KB gzipped). JavaScript/CSS are inlined, but `index.html`/`src/index.css` still load Google Fonts and optional workflows use external Supabase, weather, Maps, signed-image, and email services. Call this an offline-capable core, not a zero-network bundle.

### 1.2 Competitive Positioning
Grounded in UX and feature research on leading venue-management platforms:
- **Tripleseat & Perfect Venue**: Superior multi-space floor layout canvas with drag-and-drop collision detection, seating capacity math, and table/chair/linen merges.
- **Planning Pod & AllSeated**: Interactive 2D/3D-ready spatial layout studio with master layouts, preset layout templates, and custom drawing annotations.
- **Event Temple & Aisle Planner**: Complete couple-to-venue collaboration pipeline, including event questionnaires, RSVP tracking, meal option counts, and direct portal messaging.
- **WeddingWire & Zola**: Tastefully integrated guest portal and preferred vendor directory with 1-click email (`mailto:`) and website (`https://`) contact links.

---

## 2. ENVIRONMENT SETUP & MANDATORY GIT / CI PROTOCOL

### 2.1 Workspace & Git Environment Rules
1. **Working Directory**: The checked-out repository directory (in this review: `/home/user/wedding-venue-app-old/`). Do not assume a permanent sandbox path; always verify with `git rev-parse --show-toplevel`.
2. **Volatile Environment**: `node_modules` and git identity/remote are reset between turns.
3. **Restoration Script** (run at the start of any new turn):
   ```bash
   cd "$(git rev-parse --show-toplevel)"
   npm ci
   git config user.email "jstrick9@users.noreply.github.com"
   git config user.name "jstrick9"
   git remote set-url origin "https://github.com/jstrick9/wedding-venue-app-old.git"
   ```
4. **Push Policy**: If `git push origin main` encounters a 403 error, retry immediately (`git push origin main || git push origin main || true`). Commits must stay local even if remote push fails.

### 2.2 Full Continuous Integration (CI) Protocol
Before EVERY commit, the AI Agent **must** execute and verify 100% green status on all 5 CI gates:
```bash
# 1. Typecheck
npm run typecheck   # Runs tsc --noEmit (0 errors allowed)

# 2. Typed Event Bus Linter
npm run lint:events # Runs node scripts/check-event-bus.mjs (FAILS on raw 'spm_*' strings outside appEvents.ts)

# 3. Unused Locals Strict Audit
npx tsc --noEmit --noUnusedLocals 2>&1 | grep -v "\.test\." | grep -v "node_modules"

# 4. Comprehensive Unit & Integration Suite
npx vitest run      # Review #173 baseline: 729 passed / 11 skipped (do not skip or comment out tests)

# 5. Production Bundle Single-File Verification
npm run build       # Verifies vite:singlefile builds cleanly under ~415 KB gzip
```

---

## 3. FULL-STACK ARCHITECTURE & BEST CODING PRACTICES

### 3.1 Versioned Storage & Data Persistence (`src/utils/storage.ts`)
- All data entities must be loaded via `loadVersionedStorage<T>({...})` and saved via `saveVersionedStorage(KEY, VERSION, DATA)`.
- **Schema Versions (`STORAGE_VERSIONS` in `src/constants/storageVersions.ts`)**: Every domain has an explicit version integer. When mutating data structures, provide schema normalization inside `normalize(v)` so legacy JSON automatically upgrades without crashing.
- **Corruption Recovery**: If `loadVersionedStorage` encounters corrupt JSON, it emits a typed `spm_storage_error` event, backs up the corrupt payload to `<key>.bak`, and restores the safe default value.

### 3.2 Typed Event Bus (`src/utils/appEvents.ts`)
- **NEVER use raw `window.dispatchEvent` or `'spm_*'` event strings outside `appEvents.ts`.**
- Use typed emitters and listeners:
  - `emit('spm_data_changed', { type: 'all' })` / `emitDataChanged('all')`
  - `on('spm_data_changed', (detail) => { ... })`
  - `emit('spm_open_admin_tab', 'venues')`

### 3.3 Dynamic Branding & CSS Variables (`src/config.ts`)
- Platform-wide primary brand color is **Purple `#4A1942`** (`config.primaryColor`), dark purple `#3d1a45` (`config.primaryDark`), and light purple `#6b2c5c` (`config.primaryLight`).
- In UI components, always support dynamic branding via inline styles or `color-mix`:
  ```tsx
  style={{
    background: `linear-gradient(135deg, ${config.primaryColor || '#4A1942'}, ${config.primaryDark || '#3d1a45'})`,
    borderLeft: `6px solid color-mix(in srgb, ${config.primaryLight || '#6b2c5c'} 80%, white)`,
  }}
  ```

### 3.4 File Uploads & FileReader Resiliency
- In browser testing environments (jsdom / mobile WebViews), `FileReader` may be unavailable or asynchronous. Always guard file processing with a fallback data URI:
  ```tsx
  const processImageFile = (file: File, onComplete?: () => void) => {
    if (typeof FileReader === 'undefined' || typeof window === 'undefined' || typeof window.FileReader !== 'function') {
      const fallbackUrl = `data:image/png;base64,mock_${file.name}`;
      handleSaveUrl(fallbackUrl);
      onComplete?.();
      return;
    }
    const reader = new FileReader();
    let completed = false;
    const finish = (resUrl?: string) => {
      if (completed) return;
      completed = true;
      handleSaveUrl(resUrl || `data:image/png;base64,mock_${file.name}`);
      onComplete?.();
    };
    reader.onload = (e) => finish((e.target?.result || reader.result) as string);
    reader.onloadend = () => finish(reader.result as string);
    reader.onerror = () => finish();
    try {
      reader.readAsDataURL(file);
    } catch {
      finish();
    }
  };
  ```
- **File Input Accessibility & Click Restrictions**:
  - Never use `className="hidden"` (`display: none`) on `<input type="file" />` because browsers often block `.click()` on hidden elements.
  - Always use **`className="sr-only"`** (visually hidden, 1px by 1px, screen-reader accessible) and wrap dropzones/buttons in native **`<label htmlFor="file-input-id">`**:
    ```tsx
    <input id="logo-file-upload" type="file" accept="image/*" onChange={handleUpload} className="sr-only" />
    <label htmlFor="logo-file-upload" className="btn-primary cursor-pointer ...">📤 Upload Image</label>
    ```

---

## 4. UNIVERSAL UI/UX STANDARDS & DESIGN CONSISTENCY RULES

### 4.1 Universal Rounded-Corner Main Page Headers
All 7 main page headers across `Home`, `Venue Calendar`, `Couples Portal`, `Preferred Vendors`, `Wedding Timeline`, `Staff & Operations`, and `Portal Chat & Direct Messages` **must** share 100% identical styling:
```tsx
<header
  className="no-print px-6 py-5 flex items-center justify-between shadow-md rounded-2xl mb-5 text-white shrink-0"
  style={{
    background: `linear-gradient(135deg, ${config.primaryColor || '#4A1942'}, ${config.primaryDark || '#3d1a45'})`,
    borderLeft: `6px solid color-mix(in srgb, ${config.primaryLight || '#6b2c5c'} 80%, white)`,
  }}
>
```
- Do **not** add redundant `"← Dashboard"` or `"✕"` close buttons when a module is embedded in `VenueDashboard.tsx` (`inline === true`).

### 4.2 Universal Modal Viewport Overflow Prevention (`src/components/ModalDialog.tsx`)
All modal overlays **must** prevent viewport cutoff on tall content (e.g. *"Spaces & Layouts"*):
```tsx
<div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-2 sm:p-4 overflow-hidden">
  <div className="w-full max-w-4xl max-h-[94vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
    <div className="shrink-0 z-20 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
      {/* Pinned Title & Close Button */}
    </div>
    <div className="p-5 overflow-y-auto flex-1 min-h-0">
      {/* Scrollable Modal Body */}
    </div>
  </div>
</div>
```

### 4.3 Design Studio (`Layout Studio`) Header & Navigation (`Header.tsx` & `Sidebar.tsx`)
- `<Header.tsx>` is rendered at the top of the Design Studio (`view === 'studio'`) in `AuthenticatedApp.tsx`.
- **Left Side of `<Header.tsx>`**: Must render prominent 1-click buttons for **`🗺️ Venue Map`** (`onOpenVenueMap`) and **`🏛️ Spaces & Layouts`** (`onShowSpacesLayouts`). It must **never** render venue branding text, website links, or email links.
- **Right Side of `<Header.tsx>`**: Renders the venue layout switcher dropdown (`Venue: [v.name ▼]`) and Menu button (`☰ Menu`).
- **Inside `☰ Menu` Dropdown**: Must contain `Save as Master Layout`, `Save Layout`, `Load Layout`, `Print Layout`, **`⚙️ Admin & System Settings`**, and **`🛠️ Operations Studio`**. Must **never** include `Templates` or `Sign out`.
- **Layout Tools (`Sidebar.tsx`)**: Has a clean `"Layout Tools"` header with collapse toggle (`◀` / `▶`) and zero branding clutter.

### 4.4 Landing Page Left Sidebar (`VenueDashboard.tsx`)
- Canonical venue workspace URL is **`#/home`** (leftover `#/dashboard` / `#/venue` / empty rewrite on read). Internal view may still be `'dashboard'`.
- Renders full Branding attributes at top: **Venue Logo, Venue Name, Tagline, clickable `✉️ Email` (`mailto:`), and `🌐 Website` (`https://`)**.
- Supports collapse/expand (`◀` / `▶`) and **mouse-hold right border drag-resizing** between `200px` and `450px` width.
- **Admin console sidebar** (`AdminPanel.tsx`) uses the same white branded rail and mouse-hold resize. Admin/Studio close controls are **`← Home`**.

### 4.5 Onboarding Notification Lifecycle (`FloorPlanCanvas.tsx`)
- When a new user opens an empty canvas for the first time, display the `"Let's build your layout"` onboarding card.
- Auto-dismiss after **2.5 seconds** (2500ms timer) and save `'spm_studio_onboarding_seen' = 'true'` in persistent storage so it is suppressed on all subsequent visits.

---

## 5. THE 8 PERSONAS: COMPREHENSIVE WORKFLOW & FUNCTIONAL EXPERTISE

```
+-----------------------------------------------------------------------------------+
|                         WEDDING VENUE INTELLIGENCE PLATFORM                       |
+-----------------------------------------------------------------------------------+
       |                    |                    |                   |
       v                    v                    v                   v
+--------------+     +--------------+     +--------------+     +--------------+
| 1. VENUE     |     | 2. VENUE     |     | 3. VENUE     |     | 4. BOOKED    |
|    ADMIN     |     |    MANAGER   |     |    STAFF     |     |    COUPLE    |
+--------------+     +--------------+     +--------------+     +--------------+
  • Branding           • Dashboard          • Setup Lists        • Hero Portal
  • RBAC & Security    • Multi-Event        • Room Assign        • Canvas Editor
  • Assets Catalog     • Timeline Coord     • Ops Studio         • Guest & RSVPs
  • Full Venue Map     • BEO Sign-off       • Task Pulls         • Venue Chat
       |                    |                    |                   |
       v                    v                    v                   v
+--------------+     +--------------+     +--------------+     +--------------+
| 5. WEDDING   |     | 6. DAY-OF    |     | 7. WEDDING   |     | 8. PREFERRED |
|    PLANNER   |     |    COORD.    |     |    GUEST     |     |    VENDOR    |
+--------------+     +--------------+     +--------------+     +--------------+
  • Master Layouts     • Minute Timeline    • Mobile RSVP        • Directory
  • Table/Chair Merge  • Coord Banner       • Meal Selection     • Email/Web
  • Vendor Oversight   • BEO Print Rollup   • GPS Map Pin        • Print Sheet
```

### 5.1 Persona 1: Venue Admin (`#/admin`)
- **Key Responsibility**: Total system configuration, security, brand identity, inventory asset pricing/specifications, and property wayfinding.
- **Core Workflows**:
  - **Branding & Identity (`BrandingManagement.tsx`)**: Logo uploading, live primary/dark/light CSS variables, WCAG AA contrast verification, welcome screen styling, and live landing/home preview card.
  - **RBAC & User Access (`UserManagement.tsx` & `AccessControlPanel.tsx`)**: Assigning internal staff roles (Admin, Manager, Coordinator, Ops Staff) and managing couple/guest portal token access.
  - **Inventory Catalog (`TableManagement`, `ChairManagement`, `LinenManagement`, `FixtureManagement`, `WallManagement`)**: Defining table dimensions, chair capacities, linen pairings, architectural fixtures, and spacing rules.
  - **Full-Venue Map & Wayfinding (`VenueWayfindingManagement.tsx` & `VenueMapDesigner.tsx`)**: Building the full property map, drawing custom zones, and setting rain contingency backups.
  - **System & Backup (`BackupManagement.tsx`)**: Exporting complete JSON snapshots, roundtrip restore, and security audit logs.

### 5.2 Persona 2: Venue Manager (`#/home`, Ops & Admin)
- **Key Responsibility**: Executive multi-event coordination, BEO sheet oversight, staff scheduling, and revenue/package monitoring.
- **Core Workflows**:
  - **Executive Dashboard (`VenueDashboard.tsx`)**: High-density 2-row toolbar, interactive KPI stat cards (`Spaces`, `Lodging`, `Vendors`, `Operations`, `Timeline`, `Chat`), and calendar shift view.
  - **BEO Sheet Rollup (`StaffOperationsPanel.tsx`)**: Exporting and printing (`🖨️ Print BEO`) Banquet Event Orders with complete room setups, timeline milestones, and vendor contacts.

### 5.3 Persona 3: Venue Staff / Ops (`#/home` -> `ops`)
- **Key Responsibility**: Day-of physical setup, inventory staging, table placement, and task completion.
- **Core Workflows**:
  - **Operations Studio (`StaffOperationsPanel.tsx`)**: Pull lists for tables, chairs, and linens by room; setup checklists; and room turn-around guidelines.

### 5.4 Persona 4: Booked Couple (`#/couples-portal`)
- **Key Responsibility**: Designing their wedding layout, managing guest lists & RSVPs, tracking dietary needs, selecting packages, and communicating with the venue.
- **Core Workflows**:
  - **Tasteful Hero Banner (`CouplesPortal.tsx`)**: Shows `"Hosted at [Venue Name]"`, venue logo, coordinator `✉️ Email` (`mailto:`), and official `🌐 Website`.
  - **Interactive Floor Layout Editor (`CoupleLayoutEditor.tsx`)**: Placing assigned guest tables, head tables, dance floors, and decor on the venue's 2D canvas.
  - **Guest List & RSVP Manager**: Importing guest CSVs, tracking RSVPs, assigning seats, and recording meal selections.
  - **Portal Chat & Direct Messaging (`VenueChatPanel.tsx`)**: Real-time messaging with the venue coordinator.

### 5.5 Persona 5: Wedding Planner
- **Key Responsibility**: Layout precision, master layout template creation, vendor coordination, and seating chart optimization.
- **Core Workflows**:
  - **Layout Studio (`AuthenticatedApp.tsx`)**: Creating master templates, merging table/chair/linen seating specs, and checking spacing guidelines.

### 5.6 Persona 6: Day-of-Coordinator
- **Key Responsibility**: Minute-by-minute execution, vendor arrival tracking, and ceremony-to-reception transitions.
- **Core Workflows**:
  - **Wedding Timeline (`TimelinePanel.tsx`)**: Managing minute-by-minute schedules, activating the `"★ Day of Coordination Booked"` banner, and syncing BEO sheets.

### 5.7 Persona 7: Wedding Guest (`#/guest-portal`)
- **Key Responsibility**: Responding to RSVP, choosing meal options, locating lodging, and navigating property wayfinding.
- **Core Workflows**:
  - **Responsive Guest Portal (`GuestPortal.tsx`)**: PIN/token sign-in, mobile RSVP submission, dietary selection, and property map viewing with `"Open in Maps"` GPS links.

### 5.8 Persona 8: Preferred Vendor (`#/home` -> `vendors`)
- **Key Responsibility**: Delivering floral, DJ, catering, photography, or decor services in alignment with venue rules.
- **Core Workflows**:
  - **Vendor Directory (`VendorPanel.tsx`)**: Filtering by category, viewing contact email (`✉️`) and website (`🌐`) links, rating badges, and print sheets.

---

## 6. CORE MODULE DEEP-DIVES & KEY IMPLEMENTATIONS

### 6.1 Full Venue Map Designer (`src/components/VenueMapDesigner.tsx` & `VenueMapCanvas.tsx`)
- **Data Model (`VenueMapConfig` in `src/types.ts`)**:
  ```typescript
  export interface VenueMapConfig {
    width: number;
    height: number;
    points: VenueMapPoint[];
    rainContingencies: RainContingency[];
    routes: VenueMapRoute[];
    backgroundImageUrl?: string;     // Base aerial map image data URI or URL
    backgroundOpacity?: number;      // Opacity slider (0.1 to 1.0, default 0.85)
    drawings?: DrawingObject[];      // Custom vector zones and shapes
    updatedAt: string;
  }
  ```
- **Base Map Image Uploader Card (`🖼️ Base Map Image`)**:
  - File uploader (`id="venue-base-map-upload"`, `className="sr-only"`, `<label htmlFor="...">`) with `FileReader` data URI fallback.
  - URL pasting and live opacity slider (`10%–100%`).
- **Map Drawing & Property Zones (`🎨 Map Drawing & Zones`)**:
  - **`"✏️ Open Full Map Drawing Studio"`** button launching `<DrawingTool />`, allowing freehand annotations, boundaries, parking lots, and text to be saved directly to the venue map.
  - **`"＋ Add 4 Preset Zones"`** button populating `map.drawings` with vector area boxes:
    - `🌳 Ceremony Lawn Zone` (`#10b981`)
    - `🅿️ Main Parking Lot` (`#6366f1`)
    - `🏛️ Main Manor Building` (`#4A1942`)
    - `🌿 Gardens Boundary` (`#0d9488`)
- **SVG Canvas Renderer (`VenueMapCanvas.tsx`)**:
  - Renders `<image href={map.backgroundImageUrl} opacity={...} />` at root `(0,0)`.
  - Renders vector shapes (`rect`, `circle`, `polyline`, `text`) underneath points and routes, guaranteeing 100% parity across live editing, couple preview, PNG export, PDF export, and Print.

---

## 7. QUALITY ASSURANCE, AUTOMATED TESTING & EDGE-CASE PLAYBOOK

### 7.1 Automated Test Suite Structure
- Built with **Vitest + Testing Library React + jsdom**.
- **Run Full Suite**: `npm run test` / `npx vitest run`. Review #173 baseline: 729 passing and 11 skipped across 174 test files (167 files pass, 7 files are skipped).
- **Core Audit Suite Files**:
  - `src/components/admin/VenuePortal.designConsistencyAudit.test.tsx` (14 tests: layout consistency, presets, modal parity, logo file upload).
  - `src/components/admin/VenuePortal.completeBrandingAudit.test.tsx` (5 tests: dynamic styling, live landing page preview).
  - `src/components/admin/VenuePortal.universalBranding.test.tsx` & `CouplesPortal.universalBranding.test.tsx` (Branding theme engine).
  - `src/components/Header.test.tsx` (8 tests: admin RBAC, layout dialogs, verification of zero Website/Email links in Design Studio header).
  - `src/components/VenueMapDesigner.backgroundAndDrawing.test.tsx` (3 tests: base map URL application, 4 Preset Zones creation/clearing, drawing modal launch).
  - `src/components/FloorPlanCanvas.onboarding.test.tsx` (1 test: onboarding notification 2.5s auto-dismissal and `'spm_studio_onboarding_seen'` suppression).

### 7.2 Critical Testing Rules & Gotchas
1. **Never use `.click()` on hidden inputs**: In jsdom and browsers, calling `.click()` on `<input type="file" className="hidden" />` fails. Always use `className="sr-only"` and trigger clicks via native `<label htmlFor="ID">`.
2. **Handle multiple matching elements**: When querying text that appears in both an SVG canvas `<text>` node and a sidebar DOM list, use `screen.getAllByText(/.../i).length > 0`.
3. **Vitest Timer Manipulation**: When testing time-based auto-dismissal (e.g. 2.5-second onboarding hints), wrap timer advances in `act`:
   ```tsx
   vi.useFakeTimers();
   render(<FloorPlanCanvas ... />);
   act(() => { vi.advanceTimersByTime(2600); });
   expect(screen.queryByText("Let's build your layout")).not.toBeInTheDocument();
   vi.useRealTimers();
   ```
4. **Jsdom Browser Guards**:
   - Guard `window.matchMedia` (`if (typeof window.matchMedia !== 'function') return;`).
   - Provide fallback mock data URIs when `FileReader` is unavailable in test environments.

---

## 8. AI AGENT OPERATIONAL DIRECTIVE ("COMPREHENSIVE" PROTOCOL)

Whenever a user prompt contains the word **"comprehensive"**, the AI Agent **must** interpret it as an authoritative directive to execute an exhaustive, systematic audit and remediation across the entire platform:

1. **No Superficial Patches**: Do not fix only the single file mentioned. Inspect every module, component, helper, style rule, edge case, and workflow across all 8 personas.
2. **Systematic Hunting**:
   - Audit every header for 100% rounded-corner executive styling parity.
   - Audit every modal for `max-h-[94vh]` and pinned header overflow prevention.
   - Audit every asset editor for quick presets (`"⚡ Quick Presets:"`) and dynamic branding (`color-mix`).
   - Audit every file uploader for accessible `sr-only` inputs, `<label htmlFor="...">` bindings, and `FileReader` race-condition prevention.
3. **Documentation & Traceability**:
   - Report every completed review via **`docs/venue-portal/venue-portal-review.md`** and create a detailed review markdown report in **`docs/reviews/NN-*.md`** (incrementing the review index integer sequentially).
4. **Zero-Regression Commitment**:
   - Run the full 5-gate CI protocol (`typecheck`, `lint:events`, `unusedLocals`, `vitest run`, `build`) before committing any finding.
   - Never leave unstaged files or failing tests behind.

---

## 9. CURRENT AUDIT SNAPSHOT & PRODUCTION TRUTH (2026-08-18)

### 9.1 Review baseline

Review #173 inspected the full tracked repository at commit `9254f03` on `main`: 539 tracked files, about 98,464 lines, 169 non-test runtime files, 174 test files, 181 documentation files, and four Supabase migrations plus the email Edge Function.

Verified local gates at Review #174:
- `npm run typecheck` — green.
- `npm run lint:events` — green.
- strict unused-locals scan — green.
- `npm run test` — 735 passed / 11 skipped across 176 files (169 files pass, 7 files are skipped).
- `npm run build` — green, about 1.80 MB HTML / 411 KB gzip.

Additional checks at Review #174:
- `npm run test:coverage` — green after adding `@vitest/coverage-v8`.
- `npm run build:split` — green after removing stale `yjs`/`y-websocket` manual chunks; it still reports a large admin chunk warning.
- A live Supabase project was not available; cloud/RLS findings are static and require a real integration gate before launch.

### 9.2 Authoritative architecture truth

- LocalStorage is the complete, exercised product mode.
- Supabase Auth, layout repository, generic entity repository, object storage, invite RPC, public guest RPC, realtime layout channel, and email function are **partial seams**, not proof that every product domain is cloud-backed.
- Only 28 catalog/settings prefixes are listed in `src/services/repository/entityRepository.ts`. Couple events, couple guests, couple chat, packages/add-ons, guest events, maps/rules/weather, calendar, couple/legacy RSVP, admin settings, and other critical domains remain local or are not wired end-to-end.
- The server guest RPC has no reliable projection from the local couple guest model. Never claim server-side couple/guest security is active until the projection and RLS tests exist.
- `org_data` is an all-domain JSON table with broad member read/write policies. UI hiding is not authorization; sensitive domains require server-side role enforcement.

### 9.3 P0 blockers that every future agent must preserve in context

1. Initial Supabase owner membership creation is rejected by the current RLS policy because the new owner has no active membership yet; the client ignores the insert error.
2. Supabase `owner` maps to local `basic`, so admin access disappears after sign-in restore/reload.
3. `submit_guest_rsvp()` does not enforce portal access/deadline and casts JWT `sub` to `inet`, which is not a request IP and can fail.
4. The visible password-reset flow is local-only and does not call the Supabase reset path; “Continue as Planner Guest” remains available in cloud mode.
5. Cloud layout save is destructive organization-wide replace-sync; it has no safe row-level optimistic revision protocol.

### 9.4 P1 data-integrity/security rules

- Never silently fall back to local persistence after a cloud write error.
- `pullLayouts()` must replace local state even when the remote result is empty; entity pulls must hydrate active React state or emit matching typed events.
- Event-bus domain values must exactly match the backup/entity registry (`chairSpecs`, `spacingSettings`, `venueMapConfigs`, etc.); do not use arbitrary strings or skip `all` mutations.
- Do not export or print password hashes, portal password fields, invite tokens, or guest bearer tokens. The backup registry must cover every persistent domain or explicitly classify it as session-only.
- Use Web Crypto for bearer tokens. Remove tokens from URLs with `history.replaceState`.
- Use one authoritative RBAC service. Admin/staff early returns currently bypass granular revocation; unregistered permission ids exist in the bridge.
- `org_data` must not let every active org member write RBAC, security, or unrelated venue data.
- Rotate-aware collision validation, chair/linen/decor inventory enforcement, and time/space booking conflicts are domain-critical follow-up work.

### 9.5 Known code-quality exceptions

Twenty-four runtime files currently use `// @ts-nocheck`, including major admin, dashboard, calendar, couple, vendor, chat, and portal components. Most visible file inputs now use the `sr-only` rule, but programmatic pickers remain in `MultiImageUpload`/`AdminPanel` and several FileReader paths still need one shared utility. Future fixes should add regression tests rather than expanding these exceptions.

### 9.6 Local-first remediation progress (Review #174)

The product direction is now explicitly **one venue, many couple events, local-first by default** for vetting, usability, and cost control. Supabase is optional until a project is configured; when enabled, the cross-device path below becomes the source of truth for shared couple/guest data and must not silently fall back after a cloud error.

Review #174 implemented and tested:
- Couple guest and RSVP reads now remain in their couple-scoped stores instead of falling back to the legacy venue-wide portal stores after authentication.
- Couple guest portal access checks use the stable couple event id, not a display title; sessionStorage records the couple event scope so two couple sessions cannot be reused across each other in the same browser.
- Couple invite, guest invite, collaborator, and local organization-invite bearer tokens now use centralized Web Crypto opaque-token generation.
- `resetToDefaults()` clears couple events, couple guests/RSVPs/chat/configs, packages/add-ons, guest events, venue calendar/map/rules/weather, staff/admin settings, RBAC state, local invites, and legacy portal data while preserving versioned envelopes.
- The backup registry now covers all business storage domains, including couple RSVP submissions, local invites, communication templates, operations settings, security settings, and chat read markers; round-trip coverage was added.
- File import controls touched in the local workflows use accessible `sr-only` inputs and labels; `ConfirmDialog` now has a real focus trap; the map null validator no longer treats a persisted empty map as corrupt.
- The split build and coverage command are repaired (`@vitest/coverage-v8` installed; stale yjs manual chunk removed); the favicon is embedded for the local/file bundle.

Local-mode limitations remain intentional: localStorage/sessionStorage is per browser/device, so separate devices do not share couples, guests, RSVPs, or venue data. Use backup/export/import for controlled vetting transfer. Do not call localStorage-backed portal access production security.

### 9.7 Cross-device Supabase implementation (Review #175)

The repository now contains the first cross-device implementation path for the selected architecture: Supabase + Vercel + invite-link access.

- `supabase/migrations/0001_initial.sql` now permits the first authenticated organization owner to create the initial owner membership; `AuthBackend` maps Supabase `owner` to the local admin authority and checks bootstrap errors.
- `0003_org_data.sql` is enabled for Realtime invalidation. `EntityRepository` mirrors all business domains except local-only authentication/security/session domains, and `useEntityBackendSync` rehydrates React state on remote changes.
- `0005_couple_portal_sync.sql` adds private per-couple snapshots and token-validated RPCs for couple/collaborator access, guest hydration, and guest RSVP writes.
- `src/services/couples/coupleCloudSync.ts` builds event-scoped snapshots, registers them from the authenticated venue workspace, hydrates a couple portal on another device, and polls for changes. The guest portal uses the guest token RPC and polls for RSVP/config updates.
- `CouplesPortal.tsx` and `GuestPortal.tsx` remain local-cache-first for responsiveness, but when `VITE_BACKEND_PROVIDER=supabase` is configured they pull/push the Supabase snapshot path.

This path is **not live-certified yet** because a Supabase project has not been created in this workspace. Before real use: create the project, apply migrations `0001`–`0005`, configure Vercel `VITE_BACKEND_PROVIDER=supabase`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`, then run the device-A/device-B/device-C smoke workflow in Review #175. Current guest snapshot polling is approximately five seconds; true broadcast/realtime optimization and token-field redaction remain follow-up hardening.

### 9.8 Documentation precedence

`docs/reviews/175-cross-device-supabase-implementation.md`, `docs/reviews/174-local-first-multi-couple-remediation.md`, the #173 audit, and this section describe the current code truth. Numbered reviews before #173, `docs/CODE_REVIEW.md`, `docs/QUICKSTART.md`, and parts of `docs/platform/PLATFORM.md` contain historical claims and may describe an earlier commit. Read the current source and the P0/P1 list before trusting a “wired,” “complete,” test-count, or navigation claim.

### 9.9 Multi-tenant platform-control implementation (Review #176)

The selected product direction is now explicitly:

- one Supabase project with organization-level tenant isolation;
- one initial internal platform owner, with an extensible platform role table;
- platform-created venue organizations;
- one-time managed venue-administrator onboarding links;
- venue administrators managing their own staff/admin/planner invitations;
- platform metadata visibility with an audit foundation, not automatic unrestricted access to tenant business data;
- MFA deferred until after the first platform-owner/managed-admin smoke test.

Review #176 added:

- `supabase/migrations/0006_platform_tenancy.sql` with `platform_memberships`, nullable pre-onboarding organization owners, `venue_admin_invites`, platform metadata RLS, platform audit foundation, and RPCs for platform venue creation and managed-admin invite claiming;
- `supabase/migrations/0007_public_venue_branding_and_access_lifecycle.sql` with safe public branding lookup by venue slug, venue-bound public RPC wrappers, and server-enforced expiration for couple/collaborator/guest links;
- `supabase/migrations/0008_platform_console_management.sql` with immutable auto-generated slugs, provisioning/active/suspended tenant lifecycle, invite context/reissue/revocation, suspend/reactivate RPCs, and global/per-venue operational metrics;
- `supabase/migrations/0009_platform_branding_chat_and_venue_location.sql` with dedicated platform branding, public branding storage, platform↔venue chat, required venue address/contact/location fields, and geocode cache;
- `supabase/functions/geocode-venue/index.ts` as a server-side, cached, low-rate Nominatim integration;
- `docs/platform/PLATFORM_CONSOLE_OPERATING_MODEL.md` and `docs/reviews/178-platform-console-management.md` with the researched admin-plane, tenant lifecycle, metrics, map, branding, chat, audit, and support-access operating model;
- `src/services/platform/platformTypes.ts`, `platformAdminService.ts`, `publicVenueService.ts`, and `organizationContext.ts`;
- `PlatformAdminPortal.tsx` at the root/`#/platform-admin` route;
- `PlatformLoginScreen.tsx` at the neutral root/`#/platform-login` route;
- `VenueLoginScreen.tsx` at `#/venue-login/<venue-slug>` with organization-scoped Supabase sign-in and public venue branding;
- `VenueAdminOnboarding.tsx` at `#/venue-onboarding?token=...`;
- global platform role loading in Supabase Auth restoration/sign-in;
- invite-only cloud login messaging and routing for regular organization invites;
- separate neutral platform login, venue-specific login routes, and hidden public-portal controls on venue/platform login pages;
- couple/co-owner/planner/family/vendor portal access roles, event-day-after link expiry, token rotation/reissue helpers that preserve history, and explicit venue query parameters on new public links;
- `docs/platform/MULTI_TENANT_PLATFORM.md` with the live migration/bootstrap/onboarding/login/access-lifecycle/smoke checklist.

The first platform owner is intentionally bootstrapped once through Supabase SQL Editor by inserting an active `platform_owner` row for the existing Supabase Auth user. No service-role credential belongs in Vercel or the browser. Migrations `0006`/`0007` and the live tenant/RLS/onboarding smoke test remain pending in the user's Supabase project; do not call this path live-certified until that test passes.

### 9.10 Venue-specific login and portal lifecycle (Review #177)

Review #177 extends the platform layer with the user-approved venue/public boundary:

- root/`#/platform-login` uses neutral Platform Administration branding;
- `#/venue-login/<venue-slug>` resolves safe public venue branding through `get_public_venue_branding` and only permits active members of that organization;
- couples and guests bypass venue login through public invite routes;
- new couple/guest URLs carry the venue slug and use venue-bound RPC wrappers;
- couples retain invite-link access without Supabase Auth accounts;
- one guest token is scoped to one couple, while `guestEventIds` determines which assigned events the guest can see and RSVP to;
- links expire through the day after the final event day (with a temporary 30-day fallback when no event date exists);
- couple owners, venue administrators, and couples can reissue couple/collaborator/guest tokens without deleting history;
- collaborator roles now allow an explicit `couple`/co-owner grant in addition to planner, family, and vendor.

Files include `supabase/migrations/0007_public_venue_branding_and_access_lifecycle.sql`, `0008_platform_console_management.sql`, `PlatformLoginScreen.tsx`, `VenueLoginScreen.tsx`, `publicVenueService.ts`, `organizationContext.ts`, access lifecycle helpers, link rotation changes in couple services/portals, and `docs/platform/PLATFORM_CONSOLE_OPERATING_MODEL.md`. The existing Seven Paths Manor tenant should be preserved and assigned a stable slug such as `seven-paths-manor` after confirming uniqueness. Email confirmation, venue-specific timezone, MFA, transactional invite email, live cross-tenant/RPC smoke tests, and production break-glass support remain follow-up gates.

### 9.11 Deep full-stack & venue-domain audit (Review #180, 2026-08-19)

Review #180 re-ran all gates against HEAD `5d682ff` and reviewed the platform-console layer (#176–#179) as shipped code for the first time.

- **Verified baseline:** typecheck green; `lint:events` green; `vitest run` **738 passed / 11 skipped** (749 total, 170/7 files); single-file build green at **2,073.67 kB / 481.45 kB gzip**; `build:split` green (was broken at #173) but warns on empty `vendor-react` chunk and a **738 kB (158 kB gzip) `chunk-admin`**; 24 runtime `@ts-nocheck` files; ~170 `any` / ~89 `as any`.
- **Fixed since #173:** P0-1 owner bootstrap (RLS `membership_bootstrap_owner` policy + AuthBackend now throws on membership-insert error, unverified live); P0-4 owner→admin role mapping in `AuthBackend.mapRole`; split build.
- **Still open:** P0-2 (cloud not the complete provider; couple/guest/calendar/staff domains remain local, no relational projection); P0-3 (legacy `submit_guest_rsvp` still has no access/deadline enforcement and casts JWT `sub` to `inet`; `0005` couple path also has no deadline enforcement); P0-5 (PasswordReset local-only; planner-guest now hidden on platform/venue login); P1-1 (`org_data` broad member RLS); P1-2/3 (repository pulls bypass event bus; domain keys mismatch registry); P1-4/5 (layout destructive replace-sync; empty remote ignored); P1-7 (two RBAC authorities); P1-8 (backup incomplete + secrets in cleartext); P1-9; P1-11 (invite acceptance does not refresh AuthContext).
- **NEW platform-console findings (#180):**
  1. **Zero automated tests** for the entire #176–#179 platform console (no test references PlatformAdminPortal, venue/platform login, onboarding, platform chat/map, createVenueOrganization, console metrics, geocoding). Live RLS/storage/chat/map smoke tests remain pending.
  2. Onboarding invite token stays in the URL hash (`#/venue-onboarding?token=…`), not removed via `history.replaceState` — contradicts the memory's own token hygiene rule.
  3. `couple_portal_snapshots.payload` stores raw guest/collaborator bearer tokens in cleartext JSONB (only the dedicated token-hash columns are hashed).
  4. `get_platform_console_metrics()` reads `coupleEvents/coupleGuests/coupleSubmissions` from `org_data`, which are **local-only** — so console couple/guest/rsvp metrics will read 0 until the couple→org_data projection exists.
  5. `geocode-venue` Edge Function has no rate-limit/throttle in front of public Nominatim (cache-only); bulk onboarding can violate the 1 req/sec policy.
  6. Platform↔venue chat accepts `sender_side` from the client (RLS still enforces the two role-based combinations, but a platform-admin-venue-member can spoof venue-side).
  7. README/`.env.example` stale re: migrations `0006`–`0009` and the multi-tenant console.
  8. CI (`ci.yml`) runs only typecheck/lint:events/test/build — the memory's stricter "5-gate" protocol (unused-locals, `build:split`, coverage, `npm audit`, and ESLint, which is absent) is not enforced in CI.
- **Top wedding-domain gaps:** no space×time double-booking/setup-teardown-buffer/blackout/multi-space atomic reservation; guest RSVP does not project to an authoritative venue-level catering/headcount roll-up; BEO is a print doc (no issued versions/sign-off); inventory is advisory not a pull/return ledger; no booking/contract/deposit/revenue lifecycle; rotation-aware collision missing; day-of coordination has no vendor-arrival conflicts or dependency blockers.

**Rule going forward:** treat the #180 report (`docs/reviews/180-deep-audit-2026-08-19.md`) and §9.1–9.11 here as the current source of truth. Before claiming any cloud/tenancy/portal feature is live, add a migration/RLS smoke test and a unit test for the platform console surface. Re-run all five gates plus `build:split` before committing.

### 9.12 Remediation of Review #180 (Review #181, 2026-08-19)

The P0 + P1 remediation roadmap (and the highest-value new findings + P2 config) was executed and committed. See `docs/reviews/181-remediation-2026-08-19.md` for the full ledger.

**Done & tested:**
- **P1-8 backup secrets** — new `backupSecrets.ts`; `buildRedactedExportBundle()` redacts passwords/salts/tokens before file export (checksum recomputed over redacted payload); import skips redacted domains and warns. Tested.
- **P1-3 event-bus keys** — `DataChangedType` is now a strict union of registry keys (no `(string & {})`); fixed `venue-map`→`venueMapConfigs`, `couple-chat`→`coupleMessages`, `couples`→`coupleEvents`, `spacing`→`spacingSettings`, `chairs`→`chairSpecs`; `storage.ts` resolves keys via `storageKeyToDomainKey`. Drift-guard test added.
- **P1-2 hydration** — `SupabaseEntityRepository.pullAll` emits typed events per domain + `'all'`.
- **P1-4 layout optimistic upsert** — `SupabaseLayoutRepository.saveAll` is now per-row insert/update/delete with `revision+1` and `layout_versions`; stale edits skipped. Tested (mocked supabase).
- **P1-5 empty pull + retry/reset** — `pullLayouts` always overwrites (incl. empty); `loadedRef` reset on org change and only set on success in `useLayoutBackendSync`/`useEntityBackendSync`.
- **N-2 onboarding token URL** — `VenueAdminOnboarding` strips `?token=` via `history.replaceState`.
- **P0-5 password reset cloud** — `PasswordReset` uses Supabase Auth recovery in cloud mode; local flow unchanged.
- **P1-1 org_data RLS**, **P0-3 guest RSVP RPC**, **N-6 chat sender_side**, **N-5 geocode rate slot** — new migration `0010` (SQL reviewed; live RLS still needs a project).
- **N-1/N-7 platform console tests** — added `platformAdminService.test.ts` and `platformGeocodingAndChat.test.ts` (mocked supabase).
- **P2 config** — ESLint added (`eslint.config.js`, `npm run lint`, 0 errors / 46 warnings); split build cleaned (removed empty `vendor-react` + circular `chunk-platform`); CI expanded (typecheck, lint:events, lint, unused-locals, tests, build, build:split, `npm audit --omit=dev`); README/`.env.example` updated.

**Deferred (documented):** Phase 3 features; **P0-2/N-4/P1-9 couple→org_data/relational projection** (console couple/guest/rsvp metrics still read 0 until it exists — largest remaining "cloud honesty" item); P1-7 RBAC unification; P1-11 invite-acceptance AuthContext refresh; `@ts-nocheck` removal; 11 skipped tests; browser E2E/axe. **N-3** (tokens at rest in couple snapshot payload) was deliberately NOT changed to hash-only because the couple portal's guest-management UI needs the raw guest token after hydration — mitigations remain (RPCs strip tokens, `tokenHash` stored, RLS-restricted, exports redacted).

**Verified gates (HEAD at #181):** typecheck/lint:events/lint pass; unused-locals pass; full suite **760 passed / 11 skipped**; single-file build 2,075.74 kB / 481.28 kB gzip; split build green; `npm audit --omit=dev` 0 vulnerabilities.

### 9.13 Deferred P0/P1 items (Review #182, 2026-08-19)

See `docs/reviews/182-deferred-p0-p1-2026-08-19.md`.

**Done & tested:**
- **P0-2 / N-4 / P1-9 couple projection** — `coupleProjection.ts` + migration `0011` (`sync_couple_projection`, source-id columns, metrics that understand raw-array `org_data` payloads). Entity sync flushes couple domains and the relational projection after couple writes. Guest tokens are hashed in `guests.portal_token_hash`. Console couple/guest/RSVP metrics will populate once a venue has projected data. SQL reviewed; live RPC still needs a project.
- **P1-7 RBAC unification** — one authority (granular roles). Defaults live in `rbacDefaults.ts` and are merged in `rbacBridge`. Supabase `owner`/`planner` alias to `master-admin`/`manager`. Admin/staff `User.role` short-circuits no longer bypass a revoked assigned-role permission. Inheritance is cycle-safe. Unregistered permission ids were added; unknown ids cannot be attached to a role.
- **P1-11 invite AuthContext refresh** — `refreshSession()` + `AcceptInvite` calls it on success.
- **P1-10** — persistent `sr-only` file inputs in AdminPanel/MultiImageUpload; `sanitizeHref()` on vendor/dashboard links.
- Re-enabled collision, password-reset completion, table↔room assignment, and PropertiesPanel seating tests.

**Still deferred:** Phase 3 venue-intelligence features; N-3 hash-only snapshot tokens (couple UI needs raw tokens); remaining `@ts-nocheck` on 24 large components; 5 skipped UI/smoke tests; live RLS smoke test.

**Verified gates (HEAD at #182):** typecheck/lint:events/lint pass; unused-locals pass; full suite **784 passed / 5 skipped**; single-file build 2,078.22 kB / 482.00 kB gzip; split build green; `npm audit --omit=dev` 0 vulnerabilities.

**Rule going forward:** treat #182 + §9.12–9.13 as current truth. Do not claim console metrics or server guest mode are live until migration `0011` is applied and smoke-tested.

### 9.14 Platform console rebuild (Review #183, 2026-08-19)

See `docs/reviews/183-platform-console-rebuild-2026-08-19.md`.

The platform admin portal is no longer a single long page. It is a sidebar console with hash areas (`#/platform-admin`, `/venues`, `/venues/<id>`, `/map`, `/onboard`, `/branding`, `/chat`, `/audit`). Platform admins can edit venue identity, address/contact, website, and lifecycle status after create via `update_venue_organization` (migration `0012`). The slug stays immutable. Address changes re-geocode; unchanged addresses keep existing coordinates. The directory searches name/slug/city/state/country/contact and filters by status and region. Back from detail restores the in-memory filter. Unsafe website URLs are rejected by `sanitizeHref` before the RPC.

**Still deferred:** Phase 3 venue-intelligence features; N-3 hash-only snapshot tokens; remaining `@ts-nocheck` on 24 large components; 5 skipped UI/smoke tests; live RLS smoke test.

**Verified gates (HEAD at #183):** typecheck/lint:events/lint pass; unused-locals pass; full suite **799 passed / 5 skipped**; single-file build 2,095.60 kB / 485.59 kB gzip; split build green; `npm audit --omit=dev` 0 vulnerabilities.

**Rule going forward:** treat #183 + §9.12–9.14 as current truth. Apply migrations `0001`–`0012` and smoke-test venue edit + audit before calling the console rebuild live.

### 9.15 Login screens tied to branding (Review #184, 2026-08-19)

See `docs/reviews/184-login-branding-2026-08-19.md`.

Staff auth chrome (platform login, venue login including loading/not-found/suspended/signed-in, password reset, force password change, venue-admin onboarding, accept-invite) is driven by branding. Missing venue colors fall back to charcoal/white/gray (`NEUTRAL_LOGIN_CONFIG`), never Seven Paths plum. Platform login keeps navy (`DEFAULT_PLATFORM_LOGIN_CONFIG`). `getPublicPlatformBranding` no longer merges into the venue product default. Migration `0013` updates `get_public_venue_branding` SQL fallbacks and exposes login-background fields. Semantic error/warning/success colors are unchanged. Local Seven Paths demo and already-saved venue branding stay as they are.

**Verified gates (HEAD at #184):** typecheck/lint:events/lint pass; unused-locals pass; full suite **807 passed / 5 skipped**; single-file build 2,097.77 kB / 486.48 kB gzip; split build green; `npm audit --omit=dev` 0 vulnerabilities.

**Rule going forward:** treat #184 + §9.12–9.15 as current truth. Apply migrations `0001`–`0013` before claiming new-venue login branding is live.

### 9.16 Geoapify address quality and contact validation (Review #185, 2026-08-19)

See `docs/reviews/185-geoapify-address-quality-2026-08-19.md`.

Nominatim is gone. `geocode-venue` proxies Geoapify autocomplete, street verification, and map tiles. The API key is an Edge Function secret only. Platform onboard and venue detail fill city/state/ZIP from a selected US street suggestion and block save until that address is verified (or unchanged). The platform venue map uses Leaflet + Geoapify tiles when Supabase is configured. Shared `contactQuality` helpers enforce US NANP phones, email syntax, and http(s) websites on platform venue forms and other contact save paths. Venue-admin branding still uses a free-text location string; mailing address stays platform-only. Geoapify is not USPS CASS.

**Still deferred:** Phase 3; N-3 hash-only snapshot tokens; remaining `@ts-nocheck`; 5 skipped tests; live RLS/Geoapify smoke.

**Verified gates (HEAD at #185):** typecheck/lint:events/lint pass; unused-locals pass; full suite **820 passed / 5 skipped**; single-file build 2,279.36 kB / 541.77 kB gzip; split build green; `npm audit --omit=dev` 0 vulnerabilities.

### 9.17 Live geocode unblock (Review #186, 2026-08-19)

See `docs/reviews/186-geocode-venue-live-unblock-2026-08-19.md`. Browser `Failed to fetch` on street typeahead means the `geocode-venue` function never returned a CORS response — deploy it, then set `GEOAPIFY_API_KEY` under Edge Functions → Secrets (never Vercel). Client now translates that network error; the function reflects `Origin`.

**Rule going forward:** treat #186 + §9.12–9.17 as current truth. Apply migrations `0001`–`0014`, deploy `geocode-venue`, and set `GEOAPIFY_API_KEY` before claiming address autocomplete is live.

### 9.18 GitHub deploys Edge Functions (Review #187, 2026-08-19)

See `docs/reviews/187-github-edge-function-deploy-2026-08-19.md`. `.github/workflows/deploy-edge-functions.yml` deploys all `supabase/functions` on `main` (function-path changes) and via **Run workflow**. Requires GitHub secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID`. Vercel still does not deploy Deno functions.

**Rule going forward:** treat #187 + §9.12–9.18 as current truth. After the two GitHub secrets exist, run the Action once, then address autocomplete is live if `GEOAPIFY_API_KEY` is already set.

### 9.19 Staff login chrome and branded browser tabs (Review #195, 2026-08-20)

See `docs/reviews/195-login-or-divider-and-tab-branding-2026-08-20.md`.

Platform and venue staff login no longer render the unused **or** divider. Signing
out of the platform console navigates to `#/platform-login` instead of leaving
`#/platform-admin/…`. Browser tab title and favicon come from the active surface
branding (platform console name/logo; venue/couple/guest venue branding). The
HTML shell default is the platform name, not Seven Paths Manor.

**Rule going forward:** treat #195 + §9.12–9.19 as current truth for login chrome
and tab identity.

### 9.20 Venue admin sidebar console and landing sidebar (Review #196, 2026-08-20)

See `docs/reviews/196-venue-admin-sidebar-and-dashboard-menu-2026-08-20.md`.

`VenueDashboard` no longer renders an overlay **☰ Menu** hamburger; the landing
sidebar is always on screen and collapses to icons. Venue Admin & System Settings
(`AdminPanel`) is a grouped left-sidebar console (Overview + five categories)
with `#/admin` / `#/admin/<section>` hashes. KPI shortcut cards (`Venues:`,
`Seating:`) render on Overview only. Design Studio `Header.tsx` Menu is unchanged.

**Rule going forward:** treat #196 + §9.12–9.20 as current truth for venue Home
sidebar and Admin navigation.

### 9.21 Admin console sidebar dropdowns (Review #197, 2026-08-20)

See `docs/reviews/197-admin-sidebar-brand-collapse-dropdowns-2026-08-20.md`.

The venue Admin console sidebar stays a dark rail. Active items use
`config.primaryColor`. The rail collapses to icons. The five categories are
independent dropdowns that default closed; hover `title` describes the
section; clicking a header only expands it.

**Rule going forward:** treat #197 + §9.12–9.21 as current truth for Admin
console navigation chrome.

### 9.22 Venue Home hash and Admin Home-chrome sidebar (Review #198, 2026-08-20)

See `docs/reviews/198-venue-home-hash-and-admin-sidebar-chrome-2026-08-20.md`.

The venue workspace URL is **`#/home`**. Writes never use `#/dashboard`.
Leftover `#/dashboard`, `#/venue`, empty, and `#/` rewrite to `#/home`.
Admin and Design Studio close with **`← Home`**. The Admin rail is the same
white Home chrome (logo, name, tagline, Email/Website, brand active color,
◀/▶, mouse-hold resize 200–450px). The five #197 dropdown groups remain.

**Rule going forward:** treat #198 + §9.12–9.22 as current truth for venue
Home navigation and Admin sidebar chrome.

### 9.23 Outlook invite delivery without a custom domain (Review #199, 2026-08-21)

See `docs/reviews/199-outlook-invite-delivery-2026-08-21.md`.

Venue-admin and staff invites send unattended from **wedding-vip@outlook.com**
via Outlook SMTP (`SMTP_PASS` on `send-email`). If SMTP/Resend is not
configured, onboard/reissue opens Outlook.com compose (`outlook.live.com`)
and falls back to `mailto:`. Resend remains optional for after
weddingvip.com is verified.

**Rule going forward:** treat #199 + §9.12–9.23 as current truth for invite
email delivery.

### 9.24 Automatic Outlook SMTP and HTML invite format (Review #200, 2026-08-22)

See `docs/reviews/200-outlook-smtp-html-invite-2026-08-22.md`.

`send-email` now defines `DEFAULT_SMTP_USER` / `DEFAULT_SMTP_HOST` /
`DEFAULT_FROM` and imports `SMTPClient`. A missing-constant crash was sending
operators to Outlook.com compose (which displayed `+` instead of spaces).
Venue-admin invites send unattended when `SMTP_PASS` is set. Failures are
shown in a toast; Outlook compose is manual only. HTML uses a **Set up your
account** button and greets `Hello {first} {last},`. Onboard/edit collect
first and last name.

**Rule going forward:** treat #200 + §9.12–9.24 as current truth for invite
email delivery.

### 9.25 Outlook SMTPS on port 465 (Review #201, 2026-08-22)

See `docs/reviews/201-outlook-smtps-port-465-2026-08-22.md`.

Supabase Edge blocks outbound ports **25** and **587**. A 587 Outlook SMTP
connect hangs and the browser reports `Failed to send a request to the Edge
Function`. `send-email` now uses implicit TLS on **port 465**, has hard
timeouts, and never throws an uncaught handler error.

**Rule going forward:** treat #201 + §9.12–9.25 as current truth for invite
email delivery. Do not send from Edge Functions on port 587.

### 9.26 Microsoft Graph Outlook send (Review #202, 2026-08-22)

See `docs/reviews/202-outlook-graph-connect-2026-08-22.md`.

Supabase Edge cannot reach Outlook SMTP (587 blocked, 465 times out). Venue
admin invites send through **Microsoft Graph** after a one-time Connect
Outlook in Platform Console → Email. Refresh tokens live in
`platform_mail_secrets` (historical Graph migration, removed in #208).

**Rule going forward:** treat #202 + §9.12–9.26 as current truth for invite
email. Do not retry SMTP from Edge Functions.

### 9.27 Manual HTML Outlook invites (Review #203, 2026-08-22)

See `docs/reviews/203-manual-html-outlook-invite-2026-08-22.md`.

Azure/Graph connect is not used. Venue-admin and staff invites are sent
manually: **Send with Outlook** downloads an `X-Unsent` HTML `.eml` draft
from `wedding-vip@outlook.com` with a **Set up your account** button. The
tokenized URL is the button href only. Platform Console Email / Connect
Outlook / Graph / SMTP send paths were removed. Outlook.com compose cannot
render HTML, so the `.eml` draft is the HTML send path.

**Rule going forward:** treat #203 + §9.12–9.27 as current truth for invite
email. Do not re-add Azure Graph or Outlook SMTP from Edge Functions.

### 9.28 Brevo auto-send, invite TTL, and setup-link token fix (Review #204, 2026-08-22)

See `docs/reviews/204-brevo-invite-ttl-and-token-fix-2026-08-22.md`.

The “invalid, expired, revoked, or already used” setup screen was caused by
stripping `?token=` from the hash and then re-reading the URL. Tokens now live
in React state + sessionStorage. Invite URLs use `?va=` so mail clients cannot
drop the token with the hash. Onboard/reissue send HTML automatically through
**Brevo**. Platform Branding has separate new/reissue lifetimes and drag-and-drop
merge tags. The preview is the same HTML document Brevo sends.

**Rule going forward:** treat #204 + §9.12–9.28 as current truth for invite
email. Do not retry Outlook SMTP. Set `BREVO_API_KEY` after verifying
wedding-vip@outlook.com in Brevo.

### 9.29 Force Outlook sender on Brevo (Review #205, 2026-08-24)

See `docs/reviews/205-brevo-outlook-sender-2026-08-24.md`.

A leftover `EMAIL_FROM` secret (`invites@weddingvip.com` from the unused Resend
domain) was winning over `wedding-vip@outlook.com`, so Brevo rejected the send.
`send-email` now always uses **wedding-vip@outlook.com**. Confirm that mailbox
as a Brevo sender and redeploy `send-email`.

**Rule going forward:** treat #205 + §9.12–9.29 as current truth for invite
email. Never send as invites@weddingvip.com until that domain is actually
delegated and verified.

### 9.30 Path-only venue-admin invite URLs (Review #206, 2026-08-24)

See `docs/reviews/206-path-invite-url-2026-08-24.md`.

Brevo/Outlook click wrappers treat `?` and `#` in `/?va=<token>#/venue-onboarding`
as their own query/fragment, so the app opened the setup screen with no token.
New invites use `https://weddingvip.vercel.app/i/<token>`. `vercel.json` rewrites
that path to `index.html`. Legacy `?va=` and hash links still parse.

**Rule going forward:** treat #206 + §9.12–9.30 as current truth for invite
URLs. Do not put `?` or `#` in emailed setup links.

### 9.31 Claimed-venue reissue and invite lookup (Review #207, 2026-08-24)

See `docs/reviews/207-claimed-venue-reissue-and-invite-lookup-2026-08-24.md`.

`get_venue_admin_invite_context` used `SELECT vai INTO invite_row`, which
assigned the whole composite to `id uuid`. Reissue is allowed on claimed
active/provisioning venues; accept transfers managed ownership to the invitee
and demotes the previous owner membership to admin. The SQL shipped as 0016
in #207; #208 renumbered it to **0015** after Graph was removed.

### 9.32 Invite-lookup SQL is migration 0015 (Review #208, 2026-08-24)

See `docs/reviews/208-renumber-invite-lookup-migration-2026-08-24.md`.

Unused Graph Outlook migration `0015_platform_outlook_graph.sql` is deleted.
Invite lookup / claimed-venue reissue is now
`supabase/migrations/0015_reissue_claimed_venue_and_invite_lookup.sql`.
That file also drops leftover Graph table/functions if they were applied.

**Rule going forward:** treat #208 + §9.12–9.32 as current truth for venue-admin
invite RPCs. Apply **0015** in the live project before claiming the lookup is
fixed. There is no 0016.

---
*End of AI Agent Memory & Knowledge Base.*
