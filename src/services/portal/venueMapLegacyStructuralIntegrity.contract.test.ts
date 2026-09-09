import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  __dirname,
  '../../../supabase/migrations/0042_venue_map_legacy_portal_structural_integrity.sql',
), 'utf8');

function migrationText(name: string): string {
  return readFileSync(resolve(__dirname, `../../../supabase/migrations/${name}`), 'utf8');
}

describe('legacy Venue Map portal structural-integrity migration', () => {
  it('counts point identities before required-field filtering and omits malformed coordinates', () => {
    expect(migration).toMatch(
      /point_occurrences as \([\s\S]*?count\(\*\) over \(partition by trim\(point\.value->>'id'\)\)[\s\S]*?\)\s*select/i,
    );
    expect(migration).toMatch(/where point\.id_occurrences = 1[\s\S]*?point\.value->>'kind' in/i);
    expect(migration).toContain("jsonb_typeof(point.value->'x') = 'number'");
    expect(migration).toContain("jsonb_typeof(point.value->'y') = 'number'");
  });

  it('withholds each malformed whole route instead of pruning stops into a shortcut', () => {
    expect(migration).toMatch(
      /route_occurrences as \([\s\S]*?count\(\*\) over \(partition by trim\(route\.value->>'id'\)\)[\s\S]*?where route\.id_occurrences = 1/i,
    );
    expect(migration).toContain("jsonb_typeof(route.value->'pointIds') = 'array'");
    expect(migration).toContain("jsonb_typeof(route_point.value) <> 'string'");
    expect(migration).toContain("trim(route_point.value #>> '{}') = '__invalid_map_point_reference__'");
    expect(migration).toMatch(/jsonb_array_length\([\s\S]*?count\(distinct trim\(route_point\.value #>> '\{\}'\)\)/i);
    expect(migration).toMatch(
      /from jsonb_array_elements\(v_points\) as point\(value\)[\s\S]*?\) <> 1/i,
    );
  });

  it('counts drawing and rain collision identities before filtering malformed twins', () => {
    expect(migration).toMatch(
      /drawing_occurrences as \([\s\S]*?id_occurrences[\s\S]*?where drawing\.id_occurrences = 1[\s\S]*?venue_map_drawing_geometry_valid/i,
    );
    expect(migration).toMatch(
      /contingency_occurrences as \([\s\S]*?count\(\*\) over \(partition by contingency\.id\) as id_occurrences/i,
    );
    expect(migration).toMatch(
      /count\(\*\) over \([\s\S]*?partition by contingency\.outdoor_venue_id[\s\S]*?as outdoor_occurrences/i,
    );
    expect(migration).toMatch(/contingency\.id_occurrences = 1[\s\S]*?contingency\.outdoor_occurrences = 1/i);
  });

  it('runs identity/structure safety before all later portal sanitation layers', () => {
    expect(migration).toContain(
      'v_structural_safe_map jsonb := public.sanitize_venue_map_structural_integrity(p_map)',
    );
    expect(migration).toContain(
      'v_space_safe_map := public.sanitize_venue_map_space_point_links(v_rain_safe_map, p_venues)',
    );
    expect(migration).toMatch(
      /return public\.sanitize_venue_map_route_priorities\([\s\S]*?public\.sanitize_venue_map_drawings\(v_space_safe_map\)/i,
    );
  });

  it('keeps historical rows recoverable while existing guards continue rejecting future writes', () => {
    expect(migration).not.toMatch(/update\s+public\.org_data/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.org_data/i);
    expect(migrationText('0035_venue_map_duplicate_identity_write_guard.sql'))
      .toContain('venue_map_has_duplicate_object_ids(new.payload)');
    expect(migrationText('0036_venue_map_route_reference_integrity.sql'))
      .toContain('venue_map_has_invalid_route_references(new.payload)');
    expect(migrationText('0039_venue_map_drawing_geometry_integrity.sql'))
      .toContain('venue_map_has_invalid_drawing_geometry(new.payload)');
    expect(migrationText('0040_venue_map_structural_artifact_integrity.sql'))
      .toContain('venue_map_has_structural_artifacts(new.payload)');
  });

  it('keeps the new read sanitizer and recomposed boundary internal', () => {
    expect(migration).toMatch(
      /revoke all on function public\.sanitize_venue_map_structural_integrity\(jsonb\)[\s\S]*?from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /revoke all on function public\.sanitize_venue_map_rain_contingencies\(jsonb, jsonb\)[\s\S]*?from public, anon, authenticated/i,
    );
  });
});
