# Review #189 — Deploy preflight was stricter than deploy

**Repository:** `jstrick9/wedding-venue-intelligence-platform`  **Date:** 2026-08-20
**Scope:** The Action failed on `GET /v1/projects/{ref}` (needs
`project_admin_read`) before `functions deploy` ran. That check is removed.

## 1. What changed

Preflight now only rejects empty/wrong-shaped secrets. An optional
`GET /v1/projects` lists refs the token can see. Deploy is the required step.

## 2. Operator follow-up

Re-run **Actions → Deploy Edge Functions**. Prefer a classic Account Access
Token with no scope picker. Fine-grained tokens need **Edge Functions write**.

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

*End of Review #189.*
