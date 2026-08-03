# Comprehensive Re-Review — Pass 2 Summary

A fresh, full re-audit of every module (treating the prior pass-1 work + platform
workstream as baseline). Each finding was fixed, committed per-module, and
validated with the project's CI.

## Baseline
- Typecheck clean, event-bus lint clean, **296 tests / 11 skipped**, production
  build succeeds — throughout the pass.

## Findings fixed in Pass 2 (all committed & pushed)

| # | Module | Severity | Finding → Fix |
|---|---|---|---|
| 21 | Data & persistence | Medium | `resetToDefaults` wrote the 5 versioned keys (saved layouts, messages, portal config/guests, RSVP) as raw values instead of envelopes → forced a legacy-migration self-heal on every load. Now uses `saveVersionedStorage` with the correct version. |
| 22 | Layout canvas | Medium | On-canvas capacity counter ignored `customCapacity` + seating-row counts, disagreeing with the GuestPanel. Now mirrors the guest-panel logic. |
| 23 | Event Overview | Low | `readVendors`/`readPayments` used hardcoded localStorage strings. Switched to `STORAGE_KEYS`. |
| 24 | App shell | Low | Header's saved-layouts dropdown went stale after Admin "Reset" (only refreshed on cross-tab/backend events). Now also refreshes on same-tab `spm_data_changed`. |
| 25 | Print | Medium | `PrintView` capacity (total + per-table seat label) ignored `customCapacity` + seating rows. Added shared `tableCapacity()` helper. |
| 26 | Admin Panel | Low | Hardcoded event-role/question storage strings. Uses `STORAGE_KEYS`. |
| 27 | Timelines | 🔴 High | Timelines stored under an unregistered `'spm_timelines'` key — **missing from backup/restore, corruption-recovery, and Supabase entity sync**. Registered the key + added to `BACKUP_DOMAINS`, `BackupPayload`, and entity-sync domains. |
| 28 | Guest Portal | 🔴 High | `setPortalGuests` was never called — **no UI to provision guests with portal tokens / portal & lodging access**, so token-based server identity couldn't be set up. Added a **Portal Guests** section to the Guest Portal admin tab. |
| 29 | Vendors | 🔴 High | `useVendors` had full payment CRUD but `VendorPanel` never surfaced it — payments couldn't be entered via UI. Added a **💳 Payments** tab (record/list/toggle/delete). |
| 30 | Guest Portal | Medium | Schedule rendering + ICS export crashed on invalid/malformed dates (`Invalid time value`). Added `safeTime()` helper + guarded `handleAddToCalendar`/`formatICSDate`. |

## Verified-good this pass (no change needed)
- AuthContext (session validity, forced password change, org scope), Header
  roleLabel, Sidebar permission gating, permissions/RBAC enforcement.
- DirectMessagePanel, EventQuestionsWizard validation, SubmissionStatusPanel +
  submission-workflow status transitions.
- Layout pull only overwrites local when remote is non-empty (no data loss).
- No secrets, no `eval`, no import cycles; build resolves.
- Transient keys (edit sessions) correctly excluded from backup.

## Key takeaways
- **Two genuine incomplete features completed:** portal-guest provisioning (28)
  and vendor-payment recording (29) — data layers existed but had no UI.
- **One data-safety/platform-parity gap closed:** timelines (27) are now backed
  up, recovered, and synced like every other domain.
- **Several consistency/robustness fixes:** versioned-key reset (21), capacity
  counters (22/25), stale-UI refresh (24), and date-safety (30).

## Final status
- All fixes committed and pushed per-module (`main` at `5b0ea55`).
- 296 tests / 11 skipped, clean typecheck + lint, build green.
- Review docs under `docs/reviews/` (1–31) + module map updated.
