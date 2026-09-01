import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #262 (Phase 3 — authorization proof matrix): pins the audit_logs RLS
 * fix.
 *
 * F-262-1 (P3, live-proven): the legacy audit_logs policies granted
 * `organization_id is null` rows to ANY caller — both SELECT (read every
 * org-less audit row) and INSERT (forge audit rows by omitting
 * organization_id). The empty-object anon insert probe passed the RLS check
 * (failed only on NOT NULL constraints, 23502 vs the 42501 every other table
 * returned). Migration 0020 replaces both policies with the
 * platform_audit_logs pattern: org admins read org-scoped rows, platform
 * support reads org-less rows, and inserts require a real org membership.
 */
describe('Review #262 migration pins (audit_logs RLS)', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/0020_review_262_audit_logs_rls.sql'),
    'utf8',
  );

  it('replaces both legacy policies (F-262-1)', () => {
    expect(migration).toMatch(/drop policy if exists "audit_select_admins" on public\.audit_logs;/);
    expect(migration).toMatch(/drop policy if exists "audit_insert_members" on public\.audit_logs;/);
    expect(migration.match(/create policy/g)?.length).toBe(2);
  });

  it('no policy treats a null organization as a free pass', () => {
    // the SELECT policy requires either a real org role or platform support…
    expect(migration).toMatch(/organization_id is not null\s*\n\s*and public\.has_org_role/);
    expect(migration).toMatch(/or public\.is_platform_support\(\)/);
    // …and the INSERT policy requires a scoped org membership — never null
    expect(migration).toMatch(/with check \(\s*\n\s*organization_id is not null\s*\n\s*and public\.is_org_member\(organization_id\)/);
    // anchored so the migration's explanatory comments don't match
    expect(migration).not.toMatch(/^\s*organization_id is null or/m);
  });
});
