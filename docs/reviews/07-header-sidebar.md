# Module Review 07 — Header & Sidebar (Workspace Navigation Shell)

**Scope:** `src/components/Header.tsx`, `src/components/Sidebar.tsx`, `src/components/Logo.tsx`.

## Summary

Both components are well-built and already have good coverage (cross-role visibility, performance/no-polling, header dialogs). They use the typed event bus for opening Vendor/Timeline modals and enforce role-based visibility on venues and catalog items. One clarity gap was found.

## Findings

### P3 — Signed-in role label was ambiguous for non-admin roles
The header's "Signed in as: {name} (…)" line collapsed every non-admin, non-staff role to "User". For an operator testing the different roles (basic, master, shared, read-only, guest) this made it hard to confirm which access level was active.
**Fix:** Added a `roleLabel` helper that accurately labels the signed-in user using the full role model — `Admin`, `Staff`, `Guest`, `Master`, `Shared`, `Read Only`, or `Basic` — used in both the desktop and mobile menus. Added a regression test verifying a basic `master` user renders as "Signed in as: Jane (Master)".

## Verified healthy (no change needed)
- **Sidebar:** role-gated catalog visibility (admin sees all; basic sees category-matching + visible venue fixtures), collapsible/resizable, zoom input round-trips correctly, cross-role + performance tests pass.
- **Header:** venue selector + category filters, save/load layout dialogs (validated), print, templates, guests, admin gating, logout; uses the typed event bus.
- **Logo:** clean.

## Cross-module dependencies affected
- **Header** only; role label is display-only and derived from the existing `currentUser` prop.

## Validation
- Typecheck clean.
- Added 1 Header role-label test.
- Full suite: **248 passed / 11 skipped** (was 247).
- Production build succeeds.
