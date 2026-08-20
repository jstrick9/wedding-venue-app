# Review #188 — Edge Function deploy 403, not Node 20

**Repository:** `jstrick9/wedding-venue-intelligence-platform`  **Date:** 2026-08-20
**Scope:** The GitHub Action “Node.js 20 is deprecated” line is a warning.
The deploy failed with Management API **403 necessary privileges**.

## 1. What changed

| Item | Change |
|---|---|
| Deploy workflow | `actions/checkout@v5`, `setup-node@v6` (Node 24), `supabase/setup-cli@v3`, `--use-api`, preflight project GET with a 403 explanation |
| CI workflow | Same Node 24 action majors so CI does not show the same warning |
| Docs | Token must be Account Access Token from an Owner/Administrator, not a project API key |

## 2. Operator follow-up

Recreate `SUPABASE_ACCESS_TOKEN` at https://supabase.com/dashboard/account/tokens while signed in as the project Owner. Confirm `SUPABASE_PROJECT_ID` is the Reference ID. Re-run **Deploy Edge Functions**.

## 3. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | Pass (0 errors / 47 pre-existing warnings) |
| Strict unused-locals scan | Pass |
| `npx vitest run` | **821 passed / 5 skipped** |
| `npm run build` | Pass — 2,279.72 kB / 541.94 kB gzip |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #188.*
