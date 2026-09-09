import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  __dirname,
  '../../../supabase/migrations/0043_venue_map_frame_integrity.sql',
), 'utf8');
const portalBoundary = readFileSync(resolve(
  __dirname,
  '../../../supabase/migrations/0032_venue_map_rain_contingency_integrity.sql',
), 'utf8');

describe('Venue Map frame-integrity migration', () => {
  it('preserves omitted legacy dimensions and rejects every explicit non-number or out-of-range frame', () => {
    expect(migration).toContain('or not (p_map ? p_key) then');
    expect(migration).toContain("jsonb_typeof(p_map->p_key) is distinct from 'number'");
    expect(migration).toContain('return not (v_dimension between 20 and 500)');
    expect(migration).toContain("venue_map_dimension_is_invalid(p_map, 'width')");
    expect(migration).toContain("venue_map_dimension_is_invalid(p_map, 'height')");
  });

  it('returns no portal map before running the existing structural and layered sanitizers', () => {
    expect(migration).toMatch(
      /if public\.venue_map_has_invalid_frame\(p_map\) then\s+return null;[\s\S]*?sanitize_venue_map_structural_integrity\(p_map\)/i,
    );
    expect(migration).toContain(
      'v_space_safe_map := public.sanitize_venue_map_space_point_links(v_rain_safe_map, p_venues)',
    );
    expect(migration).toMatch(
      /return public\.sanitize_venue_map_route_priorities\([\s\S]*?public\.sanitize_venue_map_drawings\(v_space_safe_map\)/i,
    );
    expect(portalBoundary).toMatch(/build_couple_venue_map_projection\(v_portal_source_map\)/i);
    expect(portalBoundary).toMatch(
      /build_guest_venue_map_projection_with_priority\([\s\S]*?v_portal_source_map/i,
    );
    expect(migration).not.toMatch(/update\s+public\.org_data/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.org_data/i);
  });

  it('rejects future explicit malformed frames at the canonical table edge', () => {
    expect(migration).toContain('venue_map_has_invalid_frame(new.payload)');
    expect(migration).toContain("message = 'venue_map_frame_invalid'");
    expect(migration).toMatch(
      /create trigger enforce_valid_venue_map_frame[\s\S]*?before insert or update of payload, domain, organization_id[\s\S]*?on public\.org_data/i,
    );
  });

  it('keeps all frame helpers and the recomposed boundary internal', () => {
    for (const signature of [
      'venue_map_dimension_is_invalid(jsonb, text)',
      'venue_map_has_invalid_frame(jsonb)',
      'sanitize_venue_map_rain_contingencies(jsonb, jsonb)',
      'enforce_valid_venue_map_frame()',
    ]) {
      expect(migration).toMatch(new RegExp(
        `revoke all on function public\\.${signature.replace(/[().]/g, '\\$&')}[\\s\\S]*?from public, anon, authenticated`,
        'i',
      ));
    }
  });
});
