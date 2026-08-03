# Re-Review — 15: Operations (Timelines) (fresh pass)

## Finding

### GAP (data-safety / platform parity) — Timelines excluded from backup, recovery, and entity sync
`useTimeline` stored timelines under a hardcoded `'spm_timelines'` key that was
**not** a `STORAGE_KEYS` constant and **not** in the backup-domain registry. So
wedding timelines were:
- missing from **backup/restore**,
- missing from **corruption-recovery**,
- missing from the **Supabase entity sync** —

while every other data domain (staff, vendors, decor, saved layouts, etc.) was
included. A user could lose all their timelines on a reset/recovery or across
devices on the platform.

**Fix:**
- Added `STORAGE_KEYS.TIMELINES`.
- `useTimeline` uses the constant.
- Registered `timelines` in `BACKUP_DOMAINS` (so export/import/recovery cover it).
- Added `timelines` to the syncable domains in `entityRepository` (Supabase sync)
  and to `BackupPayload`.

## Cross-module impact
- Backup/Restore panel, recovery health check, and the Supabase entity repository
  now all cover timelines, matching the other domains.

## Validation
- Typecheck clean; backup + entity-repository tests pass.
