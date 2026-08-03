# Re-Review — 01: Data & Persistence (fresh pass)

Part of the comprehensive re-audit. Prior Module 01 work (backup round-trip,
design-domain gaps, merge mode, domain registry) verified present. This pass
found one new defect.

## Finding

### BUG (reset) — `resetToDefaults` wrote versioned keys as raw values
`resetToDefaults` reset `SAVED_LAYOUTS`, `DIRECT_MESSAGES`, `PORTAL_CONFIG`,
`PORTAL_GUESTS`, and `RSVP_SUBMISSIONS` with raw `saveToStorage(key, [])` /
`saveToStorage(key, null)`. Those five domains are stored as **versioned
envelopes** `{version, savedAt, data}`, so the reset produced a raw value where
an envelope is expected — forcing the loader's legacy-migration self-heal on
every subsequent load. Functionally self-healing, but semantically wrong and
inconsistent with the write path used everywhere else.

**Fix:** These five keys are now reset via `saveVersionedStorage(key, VERSION,
default)` so they keep the envelope format. Raw user-data keys (event data,
staff, vendors) remain raw. Regression test added.

## Verified-good this pass
- All 31 storage keys in `storageKeys.ts` are referenced by code.
- Backup round-trip, merge mode, and the single domain registry remain intact
  (tests pass).

## Cross-module impact
- Admin Panel → "Reset to defaults" now leaves versioned domains in a clean
  envelope format.

## Validation
- Typecheck clean; `venueData.test.ts` (6 tests) + backup round-trip pass.
