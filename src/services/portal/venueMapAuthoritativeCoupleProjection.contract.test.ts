import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0031_venue_map_authoritative_couple_projection.sql'),
  'utf8',
);
const managedImageMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0029_venue_map_managed_base_image_boundary.sql'),
  'utf8',
);

describe('migration 0031 authoritative Couple Portal map projection', () => {
  it('admits legacy-public, public, and couple objects but fails staff and malformed audiences closed', () => {
    expect(migration).toMatch(
      /couple_venue_map_object_visible[\s\S]*?when not \(p_object \? 'audience'\) then true[\s\S]*?in \('public', 'couple'\)/,
    );
    expect(migration).not.toMatch(/in \('public', 'couple', 'staff'\)/);
    expect(migration).toContain("coalesce(p_object->>'audience' in ('public', 'couple'), false)");
  });

  it('rebuilds all map object families from allowlists and prevents routes from crossing hidden points', () => {
    for (const family of ['points', 'routes', 'drawings', 'rainContingencies']) {
      expect(migration).toContain(`p_couple_map->'${family}'`);
    }
    expect(migration).toContain('public.normalize_portal_venue_map_event_scope');
    expect(migration).toContain("'__invalid_event_scope__'");
    expect(migration).toMatch(
      /jsonb_array_elements_text\(route\.point_ids\)[\s\S]*?jsonb_array_elements\(v_points\)/,
    );
    expect(migration).toContain("'preferred', 'standard', 'secondary', 'emergency-only'");
    expect(migration).toMatch(/else 'standard'[\s\S]*?'pointIds', route\.point_ids/);
  });

  it('counts identities before audience filtering and rejects duplicate points, routes, and drawings', () => {
    expect((migration.match(/count\(\*\) over \(/g) || [])).toHaveLength(3);
    expect((migration.match(/id_occurrences = 1/g) || [])).toHaveLength(3);

    const sections = [
      migration.slice(
        migration.indexOf('-- Rebuild public/couple points'),
        migration.indexOf('-- A route is publishable'),
      ),
      migration.slice(
        migration.indexOf('-- A route is publishable'),
        migration.indexOf('-- Rebuild drawing geometry'),
      ),
      migration.slice(
        migration.indexOf('-- Rebuild drawing geometry'),
        migration.indexOf('-- Rain contingencies'),
      ),
    ];

    for (const section of sections) {
      expect(section).toContain('count(*) over (');
      expect(section).toContain('id_occurrences = 1');
      expect(section.indexOf('id_occurrences = 1')).toBeLessThan(
        section.indexOf('public.couple_venue_map_object_visible('),
      );
    }
  });

  it('uses a present canonical row—including JSON null—and falls back only when the row is absent', () => {
    expect(migration).toMatch(
      /from public\.org_data as data[\s\S]*?data\.domain = 'venueMapConfigs'[\s\S]*?v_has_canonical_map := found/,
    );
    expect(migration).toMatch(
      /if not v_has_canonical_map then\s+v_source_map := v_payload->'venueMapConfigs'/,
    );
    expect(migration).not.toMatch(/coalesce\(canonical[^,]*,\s*v_payload->'venueMapConfigs'/i);
  });

  it('recomputes both couple and guest keys from the same authoritative source', () => {
    expect(migration).toMatch(
      /build_couple_venue_map_projection\(v_source_map\)[\s\S]*?build_guest_venue_map_projection_with_priority\([\s\S]*?v_source_map/,
    );
    expect(migration).toContain("jsonb_set(\n    v_payload,\n    '{venueMapConfigs}'");
    expect(migration).toContain("jsonb_set(\n    v_payload,\n    '{guestVenueMap}'");
    expect(migration).toContain("v_payload->'coupleEvents'->0->'selectedSpaces'");
  });

  it('keeps exact managed-image sanitation around both server projections', () => {
    expect((migration.match(/sanitize_portal_venue_map_base_image\(/g) || [])).toHaveLength(2);
    expect(migration).toMatch(
      /sanitize_portal_venue_map_base_image\([\s\S]*?build_couple_venue_map_projection/,
    );
    expect(migration).toMatch(
      /sanitize_portal_venue_map_base_image\([\s\S]*?build_guest_venue_map_projection_with_priority/,
    );
  });

  it('keeps the read helper internal and both account-gated Couple RPC wrappers on it', () => {
    expect(migration).toMatch(
      /sanitize_couple_portal_map_result[\s\S]*?stable[\s\S]*?security definer/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.sanitize_couple_portal_map_result\(jsonb, uuid\)[\s\S]*?from public, anon, authenticated/,
    );
    expect((managedImageMigration.match(/return public\.sanitize_couple_portal_map_result\(v_result, v_organization_id\)/g) || [])).toHaveLength(2);
  });

  it('is read-only and does not rewrite snapshots, canonical rows, or storage objects', () => {
    expect(migration).not.toMatch(/\b(update|insert into|delete from|storage\.objects)\b/i);
  });
});
