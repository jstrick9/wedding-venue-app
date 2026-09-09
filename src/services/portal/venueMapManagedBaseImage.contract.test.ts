import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0029_venue_map_managed_base_image_boundary.sql'),
  'utf8',
);

describe('migration 0029 managed Venue Map base-image boundary', () => {
  it('recognizes only the active venue map bucket prefix and strips unmanaged portal images', () => {
    expect(migration).toContain("v_prefix := 'sp://venue-map-images/' || p_organization_id::text || '/'");
    expect(migration).toContain("return p_map - 'backgroundImageUrl' - 'backgroundOpacity'");
    expect(migration).not.toMatch(/sp:\/\/\(venue-map-images\|venue-images\)/);
    expect(migration).not.toContain("v_ref ~* '^https://'");
    expect(migration).not.toContain("v_ref ~* '^data:image/");
  });

  it('blocks future canonical writes with unmanaged image references without rewriting existing rows', () => {
    expect(migration).toMatch(
      /create trigger enforce_managed_venue_map_base_image[\s\S]*?before insert or update of payload, domain, organization_id[\s\S]*?on public\.org_data/,
    );
    expect(migration).toContain('venue_map_base_image_must_use_managed_storage');
    expect(migration).not.toMatch(/update\s+public\.org_data\s+set/i);
    expect(migration).not.toMatch(/delete\s+from\s+storage\.objects/i);
  });

  it('sanitizes both guest and couple read paths at the authenticated RPC boundary', () => {
    expect(migration).toMatch(
      /create or replace function public\.apply_guest_venue_map_projection[\s\S]*?sanitize_portal_venue_map_base_image\([\s\S]*?snapshot\.organization_id/,
    );
    expect(migration).toContain("v_payload ? 'venueMapConfigs'");
    expect(migration).toContain("v_payload ? 'guestVenueMap'");
    expect(migration).toMatch(
      /create or replace function public\.get_couple_portal_snapshot\(p_token text\)[\s\S]*?sanitize_couple_portal_map_result\(v_result, v_organization_id\)/,
    );
    expect(migration).toMatch(
      /create or replace function public\.get_couple_portal_snapshot_for_venue[\s\S]*?sanitize_couple_portal_map_result\(v_result, v_organization_id\)/,
    );
  });

  it('keeps internal sanitizers uncallable and preserves only the intended public wrapper grants', () => {
    expect(migration).toMatch(
      /revoke all on function public\.sanitize_portal_venue_map_base_image\(jsonb, uuid\)[\s\S]*?from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.sanitize_couple_portal_map_result\(jsonb, uuid\)[\s\S]*?from public, anon, authenticated/,
    );
    expect(migration).toContain('grant execute on function public.get_couple_portal_snapshot(text)\n  to anon, authenticated;');
  });
});
