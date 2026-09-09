import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  __dirname,
  '../../../supabase/migrations/0044_venue_map_point_coordinate_integrity.sql',
), 'utf8');
const portalBoundary = readFileSync(resolve(
  __dirname,
  '../../../supabase/migrations/0032_venue_map_rain_contingency_integrity.sql',
), 'utf8');

describe('Venue Map point-coordinate integrity migration', () => {
  it('uses omitted legacy frame defaults and inclusive coordinate bounds', () => {
    expect(migration).toContain('v_width numeric := 100');
    expect(migration).toContain('v_height numeric := 80');
    expect(migration).toContain("if p_map ? 'width' then");
    expect(migration).toContain("if p_map ? 'height' then");
    expect(migration).toContain("(point.value->>'x')::numeric between 0 and v_width");
    expect(migration).toContain("(point.value->>'y')::numeric between 0 and v_height");
  });

  it('runs identity-first sanitation before coordinate filtering', () => {
    expect(migration).toMatch(
      /v_structural_safe_map := public\.sanitize_venue_map_structural_integrity\(p_map\);\s+v_coordinate_safe_map := public\.sanitize_venue_map_point_coordinates\(v_structural_safe_map\)/i,
    );
    expect(migration).toMatch(
      /if public\.venue_map_has_invalid_frame\(p_map\) then\s+return null;[\s\S]*?sanitize_venue_map_structural_integrity/i,
    );
  });

  it('omits each invalid point and every whole route that references it', () => {
    expect(migration).toMatch(
      /jsonb_agg\(point\.value order by point\.ordinality\)[\s\S]*?between 0 and v_width[\s\S]*?between 0 and v_height/i,
    );
    expect(migration).toMatch(
      /jsonb_agg\(route\.value order by route\.ordinality\)[\s\S]*?not exists \([\s\S]*?jsonb_array_elements\(route\.value->'pointIds'\)[\s\S]*?count\(\*\)[\s\S]*?<> 1/i,
    );
    expect(portalBoundary).toMatch(/build_couple_venue_map_projection\(v_portal_source_map\)/i);
    expect(portalBoundary).toMatch(
      /build_guest_venue_map_projection_with_priority\([\s\S]*?v_portal_source_map/i,
    );
    expect(migration).not.toMatch(/update\s+public\.org_data/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.org_data/i);
  });

  it('preserves every later portal sanitizer layer', () => {
    expect(migration).toContain(
      'v_space_safe_map := public.sanitize_venue_map_space_point_links(v_rain_safe_map, p_venues)',
    );
    expect(migration).toMatch(
      /return public\.sanitize_venue_map_route_priorities\([\s\S]*?public\.sanitize_venue_map_drawings\(v_space_safe_map\)/i,
    );
    expect(migration).toContain('contingency.id_occurrences = 1');
    expect(migration).toContain('contingency.outdoor_occurrences = 1');
  });

  it('rejects future malformed point coordinates at the canonical table edge', () => {
    expect(migration).toContain('venue_map_has_invalid_point_coordinates(new.payload)');
    expect(migration).toContain("message = 'venue_map_point_coordinate_invalid'");
    expect(migration).toMatch(
      /create trigger enforce_valid_venue_map_point_coordinates[\s\S]*?before insert or update of payload, domain, organization_id[\s\S]*?on public\.org_data/i,
    );
  });

  it('keeps all coordinate helpers and the recomposed boundary internal', () => {
    for (const signature of [
      'venue_map_has_invalid_point_coordinates(jsonb)',
      'sanitize_venue_map_point_coordinates(jsonb)',
      'sanitize_venue_map_rain_contingencies(jsonb, jsonb)',
      'enforce_valid_venue_map_point_coordinates()',
    ]) {
      expect(migration).toMatch(new RegExp(
        `revoke all on function public\\.${signature.replace(/[().]/g, '\\$&')}[\\s\\S]*?from public, anon, authenticated`,
        'i',
      ));
    }
  });
});
