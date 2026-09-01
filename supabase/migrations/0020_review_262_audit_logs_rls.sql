-- Wedding Venue Intelligence Platform — Review #262 remediation (Phase 3,
-- authorization proof matrix).
--
-- F-262-1 (P3 RLS hole, live-proven): the legacy org-level audit_logs table
-- (0001) grants both SELECT and INSERT on `organization_id is null` rows to
-- ANY caller. The clause was meant to cover platform-level rows but forgot a
-- platform-role check:
--   * SELECT: `organization_id is null or has_org_role(...)` — anyone (anon
--     included) can read every org-less audit row.
--   * INSERT: `organization_id is null or is_org_member(...)` — anyone can
--     FORGE audit rows by omitting organization_id.
-- Live evidence: an empty-object anon INSERT failed with 23502 (NOT NULL on
-- `action`) — i.e. it passed the RLS WITH CHECK and was only stopped by a
-- constraint — while every other table correctly failed with 42501. No rows
-- were written during the audit.
--
-- The table is legacy (the app reads platform_audit_logs, and no client code
-- or RPC writes audit_logs), which is why the hole was never noticed — but it
-- is a standing write/read surface for anyone with the anon key.
--
-- Fix (mirrors the platform_audit_logs pattern from 0006):
--   * SELECT: org admins for org-scoped rows; platform_support for org-less
--     rows. Anon and members lose the null-org free pass.
--   * INSERT: org members for org-scoped rows only. Service-role writers (if
--     any ever exist) bypass RLS and are unaffected.

drop policy if exists "audit_select_admins" on public.audit_logs;
drop policy if exists "audit_insert_members" on public.audit_logs;

create policy "audit_select_admins"
  on public.audit_logs for select
  using (
    (
      organization_id is not null
      and public.has_org_role(organization_id, array['owner','admin']::public.app_role[])
    )
    or public.is_platform_support()
  );

create policy "audit_insert_members"
  on public.audit_logs for insert
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );
