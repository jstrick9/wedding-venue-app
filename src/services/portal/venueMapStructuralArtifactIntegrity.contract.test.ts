import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  __dirname,
  '../../../supabase/migrations/0040_venue_map_structural_artifact_integrity.sql',
), 'utf8');
const legacyPortalSanitizer = readFileSync(resolve(
  __dirname,
  '../../../supabase/migrations/0042_venue_map_legacy_portal_structural_integrity.sql',
), 'utf8');

describe('venue map structural artifact integrity migration', () => {
  it('leaves existing canonical rows untouched for admin recovery', () => {
    expect(migration).not.toMatch(/update\s+public\.org_data/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.org_data/i);
  });

  it('rejects malformed map roots, collections, and untyped occurrences in every family', () => {
    expect(migration).toMatch(/p_map is null or jsonb_typeof\(p_map\) is distinct from 'object'[\s\S]*?return true/i);
    for (const collection of ['points', 'routes', 'drawings', 'rainContingencies']) {
      expect(migration).toContain(`p_map ? '${collection}'`);
    }
    expect(migration).toContain("point.value->>'kind' not in ('space', 'parking', 'entry', 'amenity', 'path')");
    expect(migration).toContain("jsonb_typeof(point.value->'x') is distinct from 'number'");
    expect(migration).toContain("jsonb_typeof(point.value->'y') is distinct from 'number'");
    expect(migration).toMatch(/route\.value->'id'[\s\S]*?between 1 and 200/i);
    expect(migration).toMatch(/drawing\.value->'type'[\s\S]*?between 1 and 50/i);
    expect(migration).toContain("contingency.value->'outdoorVenueId'");
    expect(migration).toContain("contingency.value->'indoorVenueId'");
  });

  it('pairs the future-write guard with the current fail-closed legacy portal sanitizer', () => {
    expect(legacyPortalSanitizer).toMatch(
      /point\.id_occurrences = 1[\s\S]*?jsonb_typeof\(point\.value->'x'\) = 'number'[\s\S]*?jsonb_typeof\(point\.value->'y'\) = 'number'/i,
    );
    expect(legacyPortalSanitizer).toMatch(
      /route\.id_occurrences = 1[\s\S]*?jsonb_typeof\(route_point\.value\) <> 'string'/i,
    );
    expect(legacyPortalSanitizer).toMatch(
      /drawing\.id_occurrences = 1[\s\S]*?venue_map_drawing_geometry_valid/i,
    );
    expect(legacyPortalSanitizer).toMatch(
      /contingency\.id_occurrences = 1[\s\S]*?contingency\.outdoor_occurrences = 1/i,
    );
  });

  it('guards future writes at the org_data table boundary', () => {
    expect(migration).toContain('venue_map_has_structural_artifacts(new.payload)');
    expect(migration).toContain("message = 'venue_map_structural_artifact_invalid'");
    expect(migration).toMatch(/before insert or update of payload, domain, organization_id[\s\S]*?on public\.org_data/i);
  });

  it('does not expose the structural detector to portal roles', () => {
    expect(migration).toMatch(/revoke all on function public\.venue_map_has_structural_artifacts\(jsonb\)[\s\S]*?from public, anon, authenticated/i);
  });
});
