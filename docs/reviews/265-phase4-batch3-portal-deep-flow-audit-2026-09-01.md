# Review #265 — Phase 4 Batch 3: Portal Deep-Flow Audit (4.10 CouplesPortal + 4.11 GuestPortal)

**Date:** 2026-09-01 · **Scope:** deep flow audit of the two portal hotspots (CouplesPortal 3930 ln, GuestPortal 2414 ln) · **Baseline:** `051b2f1` (#264, CI green)

## Method

Flow-level correctness pass over the portals' primary journeys: invite/session lifecycle, cloud-sync lifecycle, portal personalization, guest CRUD/import/link rotation, chat, RSVP submit, expiry/logout state machines, and the remaining tab CRUD patterns (checklist/vendors/package/guest-events). Every mutation path traced to its persistence layer with the `spm_data_changed` emit contract checked.

## Findings

### F-265-1 (P3, FIXED): CouplesPortal poll wipes unsaved portal-settings drafts every 5 seconds

`hydrateRemote` (5s cloud poll) unconditionally did `setEvents(getCoupleEvents())` and `setSession(loadCoupleSession())`. The freshly parsed objects have **new identities even when content is identical**, and that churn cascaded: `events` → `event` memo → `portalConfig` memo → `useEffect(() => setPortalDraft(portalConfig), [portalConfig])`. In any Supabase-configured deployment (and `cloudToken` is always present — it falls back to `event.inviteToken`), a couple personalizing their guest portal had their **unsaved draft edits (welcome message, meal options, schedule items) silently replaced with the saved config every 5 seconds**. Typing anything that takes longer than 5s was effectively impossible to save.

**Fix:** both setters now keep the previous state reference when content is unchanged (`setEvents((prev) => JSON.stringify(prev) === JSON.stringify(latestEvents) ? prev : latestEvents)`). The session comparison is **semantic** (eventId, collaboratorId, role, coupleName) because `saveCoupleSession` rewrites the rolling 30-day `expiresAt` on every poll — comparing it would defeat the fix. Side benefit: React now skips the pointless 5-second re-render of the portal entirely when nothing changed.

### F-265-2 (P3, FIXED): GuestPortal poll resets in-progress RSVP answers every 5 seconds

Same root cause on the guest side. `hydrateGuest` (5s poll) rebuilt `portalData`/`config`/`remoteCouple` with fresh objects each tick → `scopedGuests` → `identifiedGuest` → `guestRSVP`/`guestAssignedEvents` memos → the **RSVP prefill effect** (`setRsvpForm((prev) => ({...}))`) re-ran every 5s. Because the prefill *overrides* rather than merges (`attending: guestRSVP?.attending === false ? 'no' : 'yes'`, `plusOne: !!guestRSVP?.plusOneName`, `fullName` from the invited record), a guest mid-form had **their attending toggle flipped back to "yes", plus-one reset to unchecked, and name edits reverted within 5 seconds** — in the platform's core public flow (RSVP submission), in every cloud-enabled deployment.

**Fix:** `setPortalData`/`setConfig`/`setRemoteCouple` now keep the previous reference when `JSON.stringify` content is equal, so the memo chain (verified end-to-end: `portalData.guests` → `scopedGuests` → `identifiedGuest` → `guestRSVP` → prefill effect) only re-runs when the remote snapshot actually moved. Remote changes still win when they genuinely change (established sync semantics), but unchanged polls no longer touch anything.

**Pinned by:** `src/components/portalPollChurn.pin.test.ts` (4 tests: events compare, session compare excludes expiresAt, portalData compare, config/couple-event compare).

## Verified clean (with evidence)

| Flow | Verdict |
|---|---|
| Invite/session lifecycle | Closed state machine: token entry → session save → **URL token scrubbed on first read** (`getCoupleTokenFromLocation` clears it), so logout can't be undone by a lingering URL token; expired invites resolve to null (`resolveCoupleInviteToken` checks `isPortalAccessActive`) so the expiry-clear effect and token effect cannot oscillate; bad token → "Invitation not found" gate. |
| Logout | Clears session only; no re-entry without a fresh token (verified token-scrub above). |
| Mutation→emit contract | All couple-domain writes funnel through `saveCoupleEvents` → `saveVersionedStorage` → **auto-emit with typed domain key** (storage.ts:92). Direct `localStorage.setItem` bypasses in services: couple session (per-device auth state), chat read markers (ephemeral), org-slug preference, org-invite local fallback (no backend exists in that mode), staff shifts (manual emit in `writeShifts`). All benign — none is a synced domain missing its emit. |
| Guest CRUD / CSV import / link rotation | Validated inputs (`normalizeEmail`/`normalizeUsPhone`, NaN guards on capacity), shared CSV parser, rotation preserves history per service contract, clipboard + toast feedback. |
| Chat | Send is service-backed; read-marker interval only re-marks while the tab is open. P5 declined: `msgTick` interval bumps every 5s regardless of active tab (bounded re-render, same pattern as CoupleManagement — matches triaged #263 style). |
| RSVP submit | Validates name/email/phone, service-backed; cloud path audited in Phase 2 (#258 token-gated RPC layer). |
| Remaining tab CRUD (checklist/vendors/package/guest-events) | Uniform pattern: validated service call + tick bump (20 sites); services persist via versioned storage (auto-emit). Inline guest-event editors guard NaN/negative input. |
| Role tiers | UX tiers, not a security boundary — server treats invite-token holders as trusted editors of that event's snapshot (settled #258 architecture); UI gating consistent (`canEditSpaces`…`canManagePortal`). |
| Portal config draft/persist | `savePortalSettings` password handling (hash/clear, never stores plaintext), `portalSaved` toast timer benign (#264 triage). |

## Gates

tsc 0 · vitest **1047 pass / 5 skip** (+4) · eslint 0 err / **28 warn** (unchanged composition; both "unused eslint-disable" warnings pre-existing, verified via stash compare) · build gzip **546.51 kB** (≤620) · `npm audit --omit=dev` 0 · event-bus checker clean.

## Disposition

**4.10 (Couple portal deep) and 4.11 (Guest portal deep) → COMPLETE.** Two P3s found and fixed — both were cross-cutting poll-churn defects only visible by auditing the two portals together, validating the hotspot ordering. Campaign P5 backlog carried forward: PlatformVenueMap Leaflet radius freeze; LodgingBuilder mid-drag staleness; PlatformVenueChatPanel unguarded poll (#264); portal chat msgTick cadence (this review). Next per risk density: 4.9 (StaffOperationsPanel 2061) → 4.7 (FloorPlanCanvas 1890).
