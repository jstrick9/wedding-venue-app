import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0023_venue_map_guest_projection_and_assets.sql'),
  'utf8',
);

describe('migration 0023 guest venue-map boundary', () => {
  it('server-derives both guest responses from the canonical org map with a protected legacy fallback', () => {
    expect(migration).toContain('public.build_guest_venue_map_projection(');
    expect(migration).toContain('left join public.org_data canonical_map');
    expect(migration).toContain("canonical_map.domain = 'venueMapConfigs'");
    expect(migration).toContain("coalesce(canonical_map.payload, s.payload->'venueMapConfigs')");
    expect(migration).not.toContain("s.payload->'guestVenueMap'");
    expect(migration).toContain("'{venue_map}'");
    expect(migration).toContain("config.value - 'wayfindingPoints'");

    const projectionCalls = migration.match(/apply_guest_venue_map_projection\(v_result, p_couple_id\)/g) || [];
    expect(projectionCalls).toHaveLength(2);
    expect(migration).toContain('function public.get_guest_couple_portal_snapshot(');
    expect(migration).toContain('function public.get_guest_couple_portal_snapshot_for_venue(');
  });

  it('fails closed without a canonical map and keeps projection helpers private', () => {
    expect(migration).toContain("coalesce(v_guest_map, 'null'::jsonb)");
    for (const signature of [
      'guest_venue_map_object_visible\\(jsonb, text\\[\\]\\)',
      'build_guest_venue_map_projection\\(jsonb, jsonb\\)',
      'apply_guest_venue_map_projection\\(jsonb, text\\)',
    ]) {
      expect(migration).toMatch(
        new RegExp(`revoke all on function public\\.${signature}[\\s\\S]*?from public, anon, authenticated;`),
      );
    }
  });

  it('prevents couple-side snapshot saves from replacing venue-controlled maps', () => {
    expect(migration).toContain('function public.save_couple_portal_snapshot_token_impl(');
    expect(migration).toContain("p_payload - 'venueMapConfigs' - 'guestVenueMap'");
    expect(migration).toContain("v_couple_map := v_existing_payload->'venueMapConfigs'");
    expect(migration).toContain("'{guestVenueMap}'");
    expect(migration).toMatch(
      /revoke all on function public\.save_couple_portal_snapshot_token_impl\(text, jsonb, timestamptz\)[\s\S]*?from public, anon, authenticated;/,
    );
  });

  it('creates a bounded private map-image bucket readable by active portal accounts', () => {
    expect(migration).toContain("'venue-map-images'");
    expect(migration).toContain('3145728');
    expect(migration).toContain("a.user_id = auth.uid()");
    expect(migration).toContain("a.status = 'active'");
    expect(migration.match(/coalesce\(o\.status, 'active'\) = 'active'/g) || []).toHaveLength(3);
    expect(migration).toContain("array['owner','admin','planner']::public.app_role[]");
    expect(migration).toContain("split_part(name, '/', 1) ~* '^[0-9a-f]{8}");
    expect(migration.match(/then split_part\(name, '\/', 1\)::uuid/g) || []).toHaveLength(3);
  });
});
