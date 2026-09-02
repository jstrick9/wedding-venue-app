# Defect-Elimination Protocol — "Find Everything, Fix Everything" (v1.0, decisions locked)

**Date:** 2026-08-31 · **Owner:** engineering agent · **Status:** ACTIVE — Phase 0 registry built; Phase 1 in progress.

**Decisions (operator, 2026-08-31):** Q1 = live project + throwaway data · Q2 = continuous execution (interrupt anytime; registry shows position) · Q3 = bug fixes + opportunistic refactoring (extract from giant files when a unit touches them anyway) · Q4 = risk-density phase order.

**Live-throwaway operating rules (consequence of Q1):**
1. I mutate only throwaway artifacts the operator provisions (test venues, invites to throwaway emails, guest tokens); every live mutation is logged in that session's review doc and is reversible.
2. Real venues, real invites, real users, real data are never modified or deleted by me.
3. Destructive/administrative SQL stays operator-run via the SQL editor with scripts I provide (the 0016/0017 pattern).
4. Artifact requests are BATCHED on the registry's request board so the operator provisions once per several units, not per unit.

---

## §1 The honest definition of "no more issues"

"Find every bug that can possibly be found" is not a provable terminal state — any expert who promises it is lying to you. What IS achievable, and what this protocol delivers, is **exhaustive traversal of a fully enumerated defect surface**:

> **Done** = every cell of the coverage registry (§2) has been visited, carries a recorded verdict with evidence, every finding is fixed or explicitly declined-with-reason, all static gates are clean, and the residual-risk statement (§6) is written.

The registry is the whole trick. "All the bugs" is unfalsifiable; "every one of these 300 recorded cells was examined and here is the evidence" is auditable. Coverage becomes the denominator, and nothing can be silently skipped because the board shows it.

**Measured defect surface (2026-08-31):**

| Surface | Size |
|---|---|
| App source | ~97,160 lines (203 components / 65,934; 88 services / 9,690; 119 utils / 11,751; 20 hooks / 3,215) |
| Type-blind zone (`@ts-nocheck`) | 24 files, **17,096 lines** — the largest known unknown-bug reservoir |
| Database RPCs | 46 at baseline; **57 after migration 0021** (#273 extension) |
| Edge Functions | 3 at baseline; **4 after `claim-portal-invite`** (#273) |
| Tables × roles (RLS proof matrix) | **30 current tables** × 5 role classes (anon / guest-token / couple / venue / platform) |
| Largest, highest-density files | CouplesPortal 3,930 · GuestPortal 2,414 · StaffOperationsPanel 2,061 · FloorPlanCanvas 1,890 · UserManagement 1,825 |

## §2 The coverage registry (built in Phase 0)

A single living file, `docs/qa/COVERAGE-REGISTRY.md`, with one row per unit of work and columns: **unit · surface type · status (open/visited/fixed/declined) · evidence (review #) · notes**. Rows:

1. Each of the 24 `@ts-nocheck` files (Phase 1 units)
2. Each RPC (46 at campaign baseline; 11 migration-0021 additions audited in #273; 57 current)
3. Each table × role cell in the authz matrix (Phase 3)
4. Each console screen/flow per console — platform, venue, couple, guest (Phase 4)
5. Each Edge Function (input validation, auth, abuse limits, error contracts)
6. Cross-cutting sweeps: event-bus/listener leaks, unhandled rejections, stale closures, cache invalidation, race conditions in stores, error/loading UI completeness
7. Drift: live schema ↔ migrations ↔ client expectations; storage policies; env config
8. E2E browser flows (Phase 5) — one row per user journey

**A finding is never lost:** every issue found goes to the registry with a status; "declined" requires a written reason. This is what makes "without stopping until there are no more" operationally real — the board, not memory, decides when to stop.

## §3 The phases (priority order = risk density)

**Phase 0 — Registry build (1 session).** Enumerate every row above from the actual code; no analysis yet, just the map. Output: COVERAGE-REGISTRY.md committed; the campaign is now finite and visible.

**Phase 1 — De-blind the type surface (the biggest known reservoir).** One file per unit: remove `@ts-nocheck` → run `tsc` → **every type error is a candidate real bug to triage** (silent `undefined`, wrong field names, broken invariants) → fix → all gates → ratchet ceiling lowered by 1 → commit. 24 units, est. 8–12 sessions. The ratchet guarantees monotonic progress even if a session ends mid-phase.

**Phase 2 — RPC-by-RPC logic audit (46 baseline units + 11 migration-0021 extensions).** Per function, a fixed checklist: input validation & length limits · authz derivation (never trust client claims) · row locking on read-modify-write · idempotency · error contract shape · grant hygiene (`revoke` from anon/authenticated where service-only) · audit-log coverage. Findings fixed same-unit when safe.

**Phase 3 — Authorization proof matrix (the security close-out).** Every table × role cell gets a verdict with live evidence. Anon column: already certified (Reviews #246/#247). Authenticated columns: executed via the E2E-harness pattern (sign-in + REST probes) and/or a disposable test project (§7 Q1 — this decision determines whether I can run these autonomously).

**Phase 4 — Console flow audit (per screen/flow).** State machine completeness (loading/error/empty/race), subscription & event-bus cleanup, unhandled rejections, optimistic-update rollback, the known 7 conditional-hooks files, giant-file hotspots first (CouplesPortal, GuestPortal, StaffOperationsPanel, FloorPlanCanvas).

**Phase 5 — Browser E2E harness (requires §7 Q3 approval).** Playwright against a disposable test project; one journey per console: platform→create venue→invite→claim→configure→couple portal→guest RSVP→venue sees submission. Converts "works in unit tests" into "works in a real browser."

**Phase 6 — Concurrency, soak & adversarial input.** Extend the existing probe-script pattern: concurrent writers per RPC, duplicate submissions, expired/malformed tokens, oversized payloads, unicode/emoji edge cases. Time-boxed fuzz of every externally-reachable input.

**Phase 7 — Drift & config close-out.** Re-run the drift fingerprints (MIME, schema cache, grants) and reconcile live ↔ repo; document env-var expectations for all 4 Edge Functions.

## §4 The unit loop (unchanged convention, made explicit)

Each unit: **investigate → report findings → fix (highest-severity first) → tests pinning the fix → full local gate chain (eslint / tsc / vitest / build + budgets / ratchet / audit) → numbered review doc + AI_AGENT_MEMORY update → commit + push → CI green verified → registry row updated.** CI red or a skipped gate = the unit is not done.

## §5 What I need from you to run at full speed

1. **A disposable test project** (§7 Q1) — the single highest-leverage unlock. It converts operator-assisted verification (you running SQL, pasting tokens) into autonomous verification (I create invites/users/bad data myself, prove the matrix cell, and clean up). The live project then stays certified-clean and anon-key-only.
2. **Behavioral truth when asked.** I can prove code does what it says; only you can say whether what it says is right. Each unit may end with a short list of "behavior questions" (e.g., "should a suspended venue's couple portal return 403 or a friendly page?"). Fast answers keep momentum.
3. **The standing rule stays:** I never touch the live project destructively, never commit secrets, and every live mutation is a documented, reversible probe.

## §6 Residual risk statement (what exhaustion still cannot catch)

Even at full convergence: (a) logic that is wrong in a way that is also type-correct, mock-correct, and spec-silent — Phase 4/5 shrinks but cannot zero this; (b) load/scale behavior (no production traffic simulation in scope unless you ask); (c) third-party regressions (Supabase platform, Geoapify); (d) business-rule disagreements between what you intended and what was built — only surfaced when you answer behavior questions. This statement is the honest floor; everything above it, this protocol removes.

## §7 Parameters (decided 2026-08-31 — see header)

- ~~Q1 Test environment~~ → **live + throwaway data** (operating rules at top).
- ~~Q2 Execution mode~~ → **continuous**; interrupt anytime, the registry shows position.
- ~~Q3 Fix latitude~~ → **bug fixes + opportunistic refactoring** of touched files.
- ~~Q4 Priority~~ → **risk-density order** (§3 as written).

*Sizing honesty:* ~40–60 units total ≈ 15–25 working sessions at 2–4 units each. Phase 1 alone is the largest chunk. The registry means every session leaves the surface strictly smaller.
