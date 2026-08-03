# Re-Review — 18: Event Overview (fresh pass)

## Finding

### QUALITY — Hardcoded localStorage keys in `readVendors`/`readPayments`
`EventOverview` read vendor data with hardcoded strings `'spm_vendors'` and
`'spm_vendor_payments'`. They matched `STORAGE_KEYS`, so no functional bug, but
it's a maintenance hazard (a rename would silently break the dashboard).

**Fix:** Use `STORAGE_KEYS.VENDORS` / `STORAGE_KEYS.VENDOR_PAYMENTS`.

## Validation
- Typecheck clean.
