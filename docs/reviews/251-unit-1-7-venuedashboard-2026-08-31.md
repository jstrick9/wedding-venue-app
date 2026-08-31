# Review #251 (cont.) — Phase 1 Unit 1.7: `components/VenueDashboard.tsx` (957 lines)

**Date:** 2026-08-31 · **Mode:** continuous campaign

## Findings

**F-251-6 (P2 runtime bug — fixed): the Admin quick-action button corrupted the URL hash.** `onClick={props.onOpenAdmin}` handed the MouseEvent straight to `(tab?: string) => void`, so the parent's handler ran `window.location.hash = '#/admin/[object PointerEvent]'` and emitted `spm_open_admin_tab` with a MouseEvent as the tab name. The admin panel still opened (setView), but with a garbage hash and a no-op tab event. Now `onClick={() => props.onOpenAdmin()}`.

**F-251-5 (type-model lie — fixed): sidebar badge type omitted `badgeCount`.** The chat sidebar item carries `badgeCount: stats.unread` and the renderer reads it — through `(item as any).badgeCount` casts, because the items array type didn't declare the field. The badge works; the type lied. Fixed: `badgeCount?: number` declared, `as any` casts removed.

**F-251-7 (type-model lie — fixed): `user: { id?; name?; username? }` and `users?: any[]`.** The parent passes a real `User` and `User[]`; VenueChatPanel expects `User[]`. Props now honest; the `upcoming` accumulator in the events `useMemo` also got a real type (was implicit `any[]`). Three test files' partial-user fixtures upgraded to complete `User` objects — tightening the prop found every fixture that was quietly relying on the lie.

Dead code removed: unused `getConfig`/`emit` imports, `InlineNode` type, `isAdmin`/`isStaff` destructured-but-unused, `in30`.

## Pinned by

`VenueDashboard.typing.test.ts` (3 tests): no bare `onClick={props.onOpenAdmin}`; badgeCount declared with no as-any casts; honest user prop types.

## Gates

tsc + strict unused-locals scan clean · eslint 0 errors / 30 warnings · vitest **1017 passed** / 5 skipped (+3) · single-file 552.85 kB gzip + split chunks within budget · audit clean · ratchet 16 → **15**.

## Registry delta

Row 1.7 → `done` (#251). Phase 1: 9/24. Next: 1.8 `ChairManagement.tsx` (876).
