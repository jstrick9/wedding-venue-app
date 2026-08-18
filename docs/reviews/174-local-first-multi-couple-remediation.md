# Review #174 — Local-First, One-Venue / Multi-Couple Remediation

**Repository:** `jstrick9/wedding-venue-app-old`  
**Branch:** `main`  
**Date:** 2026-08-18  
**Product direction:** One venue, many couple events, local-first for vetting, usability, and cost control.

## 1. Decision and operating assumption

The platform will remain local for now. `localStorage`/`sessionStorage` is the active source of truth for the venue, couples, guests, vendors, packages, operations, timelines, maps, and settings. Supabase scaffolding remains in the repository as dormant/optional future work, but it is not used to justify current local behavior or production security.

**Important limitation:** localStorage is scoped to one browser profile on one device. Multiple couples and guests can be represented and tested in one local workspace, but separate devices do not share live data. Controlled transfer between testers should use the Backup & Restore workflow.

This pass therefore prioritized local data integrity and event isolation rather than attempting to repair the dormant Supabase path.

## 2. Changes implemented

### 2.1 Fixed couple-scoped Guest Portal data leakage / false empty states

`GuestPortal.tsx` previously loaded a couple's guests and RSVPs into `portalData`, then replaced them during derived rendering with the legacy venue-wide `getPortalGuestsForEvent()` / `getPortalRSVPSubmissionsForEvent()` stores. Because the couple display title and the couple event id are different scopes, a valid invite could authenticate but lose its identity, RSVP visibility, or tab access on the next render.

Changes:
- Couple portals now continue using the already-loaded couple-scoped guest and RSVP arrays.
- Couple guest access checks use `coupleEventId` rather than the display title.
- Local couple sign-in searches the couple's guest list directly.
- Couple guest and RSVP service filters support both current `eventName` and legacy `eventKey` records.
- Couple RSVP writes normalize the event scope and removal/upsert operations handle legacy event-name-only records.

Regression coverage was added to verify:
- token-authenticated couple guests remain visible;
- couple RSVP data is used instead of the legacy venue RSVP store;
- couple guests are still rejected when the token is not in that couple's guest list.

### 2.2 Isolated browser portal sessions by couple

Guest portal session records now optionally carry `coupleEventId`. A couple session cannot be reused by another couple or by the legacy venue-wide portal in the same browser session. A legacy venue session cannot be reused inside a couple portal.

This is still local convenience isolation, not server-side security, but it prevents a common vetting error where the next couple inherits the previous couple's guest identity in the same browser.

### 2.3 Replaced predictable local bearer-token generation

Added `src/utils/secureTokens.ts` and tests. Couple invitations, collaborator invitations, guest invitations, and local organization invites now use 24 random Web Crypto bytes rendered as a URL-safe hex token. The local invite service also now uses the shared `STORAGE_KEYS.ORG_INVITES` constant.

Non-bearer record ids still use timestamp/random identifiers where appropriate; the security-sensitive link tokens are centralized and cryptographically generated.

### 2.4 Made Reset to Defaults actually reset the multi-couple workspace

`resetToDefaults()` previously cleared some legacy data but left couple events, couple guests, couple RSVPs, couple chat, per-couple configs, packages, add-ons, guest events, calendar, map/rules/weather, RBAC, operations, communication settings, and local invites behind.

The reset now clears those domains and preserves versioned envelope format for versioned stores. Added regression coverage for couple data, RSVP data, operational settings, communication templates, and local invites.

### 2.5 Completed the local backup-domain registry

The backup registry now includes the business domains previously omitted from backup/restore:

- Couple RSVP submissions.
- Couple chat read markers.
- Communication templates.
- Operations settings.
- Security settings.
- Local organization invites.

The registry now covers 58 business storage domains, with explicit tests proving that couple RSVPs and venue settings survive an export/restore round trip.

The Backup & Restore UI now displays a local-mode privacy warning because the bundle intentionally preserves local access links and workspace records required for controlled vetting transfers. Do not email or publicly share backup JSON files.

### 2.6 Accessibility and reliability cleanup

- Converted visible local file import paths from `hidden` inputs to `sr-only` inputs with labels in the couple CSV importer, venue guest CSV importer, Drawing Tool, Operations JSON importer, Backup & Restore, and User Management avatar upload.
- Added a focus trap to `ConfirmDialog`, matching its documented behavior while preserving the topmost-confirm Escape contract.
- Allowed a persisted empty Venue Map value to validate as a legitimate `null` state instead of being logged as corrupt during backup reads.
- Embedded the favicon so local/file bundle launches do not request the missing `/vite.svg` asset.

### 2.7 Repaired local developer quality gates

- Added `@vitest/coverage-v8`; `npm run test:coverage` now runs.
- Removed stale `yjs`/`y-websocket` manual chunk references; `npm run build:split` now runs.

## 3. Validation

Targeted local multi-couple, portal, backup, token, reset, confirmation, and map tests are green.

Final full-suite validation for this review:

- `npm run typecheck` — green.
- `npm run lint:events` — green.
- strict unused-locals scan — green.
- `npm run test` — **735 passed / 11 skipped**, across **169 passed / 7 skipped test files**.
- `npm run build` — green; `dist/index.html` is approximately 1.80 MB / 411 KB gzip.
- `npm run build:split` — green; Vite still reports a large admin chunk warning.
- `npm run test:coverage -- --reporter=dot` — green; coverage is informational and not yet a release threshold.

## 4. Still intentionally deferred

These items remain out of scope while local-first vetting is the chosen product mode:

1. Supabase owner bootstrap/RLS repair and live integration testing.
2. Server-side couple/guest projection and public guest RPC hardening.
3. Cross-device sync and true multi-user realtime collaboration.
4. Encrypted/password-protected backup exports.
5. Rotation-aware collision geometry, chair/linen/decor inventory enforcement, and time/space booking conflict rules.
6. Removal of the remaining `@ts-nocheck`/`any` debt and programmatic file-picker paths.

The next recommended local workstream is the venue-operations safety pass: rotation-aware collision validation, chair/linen/decor inventory enforcement, event space/time conflict detection, and a persisted issued-BEO/change-history model.

*End of Review #174.*
