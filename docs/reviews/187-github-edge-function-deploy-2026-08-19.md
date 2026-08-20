# Review #187 — GitHub Action deploys Edge Functions

**Repository:** `jstrick9/wedding-venue-intelligence-platform`  **Date:** 2026-08-19
**Scope:** Automate `geocode-venue` / `send-email` deploys from GitHub so the
operator never needs a local CLI. Vercel still deploys only the frontend.

## 1. What changed

| Item | Change | Validation |
|---|---|---|
| Workflow | `.github/workflows/deploy-edge-functions.yml` — official `supabase/setup-cli` deploy on `main` function-path pushes and **Run workflow** | YAML reviewed against current Supabase deploy docs |
| Docs | Browser-only secret + Action steps in `MULTI_TENANT_PLATFORM.md` and `PLATFORM.md` | Review |

One-time GitHub secrets (set in the GitHub website, never committed):
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`.

SQL migrations are still applied in the Supabase SQL Editor. They are not part
of this Action.

## 2. Operator follow-up

1. Create a Supabase access token in the Dashboard (Account → Access Tokens).
2. Add the two GitHub Actions secrets.
3. **Actions → Deploy Edge Functions → Run workflow**.
4. Hard-refresh Venue Detail and type a US street.

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

Live function deploy runs after the operator adds the two GitHub secrets and
clicks **Run workflow**.

---

*End of Review #187.*
