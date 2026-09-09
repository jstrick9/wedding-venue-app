import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration0027 = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0027_venue_map_optimistic_concurrency.sql'),
  'utf8',
);

describe('migration 0027 canonical venue-map compare-and-swap', () => {
  it('serializes the missing-row case and locks an existing row before comparison', () => {
    expect(migration0027).toContain('create or replace function public.save_venue_map_config(');
    expect(migration0027).toContain('pg_advisory_xact_lock(');
    expect(migration0027).toMatch(
      /domain = 'venueMapConfigs'[\s\S]*?for update;[\s\S]*?v_current_updated_at <> p_expected_updated_at/,
    );
  });

  it('distinguishes an expected missing row from an unknown revision', () => {
    expect(migration0027).toContain('p_expected_missing boolean default false');
    expect(migration0027).toMatch(
      /if found then[\s\S]*?p_expected_missing[\s\S]*?else[\s\S]*?not p_expected_missing/,
    );
  });

  it('returns the current server payload on conflict without updating first', () => {
    const conflict = migration0027.indexOf("'error', 'conflict'");
    const update = migration0027.indexOf('update public.org_data');
    expect(conflict).toBeGreaterThan(-1);
    expect(update).toBeGreaterThan(conflict);
    expect(migration0027).toContain("'current_payload', v_current_payload");
    expect(migration0027).toContain("'current_updated_at', v_current_updated_at");
  });

  it('routes map writes through the admin-only RPC and limits browser execution', () => {
    expect(migration0027).toMatch(
      /when lower\(p_domain\) = 'venuemapconfigs' then false/,
    );
    expect(migration0027).toContain(
      "array['owner','admin']::public.app_role[]",
    );
    expect(migration0027).toMatch(
      /revoke all on function public\.save_venue_map_config\([\s\S]*?from public, anon;/,
    );
    expect(migration0027).toMatch(
      /grant execute on function public\.save_venue_map_config\([\s\S]*?to authenticated;/,
    );
  });
});
