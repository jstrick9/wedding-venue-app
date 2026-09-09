import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  __dirname,
  '../../../supabase/migrations/0041_venue_map_route_priority_integrity.sql',
), 'utf8');
const portalBoundary = readFileSync(resolve(
  __dirname,
  '../../../supabase/migrations/0032_venue_map_rain_contingency_integrity.sql',
), 'utf8');

describe('venue map route-priority integrity migration', () => {
  it('preserves omitted legacy priorities but identifies every explicitly invalid value', () => {
    expect(migration).toMatch(/p_route \? 'priority'/i);
    expect(migration).toContain("jsonb_typeof(p_route->'priority') is distinct from 'string'");
    expect(migration).toContain(
      "p_route->>'priority' not in (\n        'preferred', 'standard', 'secondary', 'emergency-only'",
    );
  });

  it('omits each affected whole route from the shared portal source without rewriting rows', () => {
    expect(migration).toMatch(
      /route_candidates as \([\s\S]*?venue_map_route_priority_is_invalid\(route\.value\) as priority_invalid[\s\S]*?invalid_priority_ids as/i,
    );
    expect(migration).toMatch(
      /where not route\.priority_invalid[\s\S]*?where invalid\.id = route\.id/i,
    );
    expect(migration).toMatch(
      /return public\.sanitize_venue_map_route_priorities\([\s\S]*?public\.sanitize_venue_map_drawings\(v_space_safe_map\)/i,
    );
    expect(migration).toContain(
      'v_space_safe_map := public.sanitize_venue_map_space_point_links(v_rain_safe_map, p_venues)',
    );
    expect(migration).toContain('contingency.id_occurrences = 1');
    expect(migration).toContain('contingency.outdoor_occurrences = 1');
    expect(portalBoundary).toMatch(
      /build_couple_venue_map_projection\(v_portal_source_map\)/i,
    );
    expect(portalBoundary).toMatch(
      /build_guest_venue_map_projection_with_priority\([\s\S]*?v_portal_source_map/i,
    );
    expect(migration).not.toMatch(/update\s+public\.org_data/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.org_data/i);
  });

  it('rejects future explicit invalid priorities at the canonical table edge', () => {
    expect(migration).toContain('venue_map_has_invalid_route_priorities(new.payload)');
    expect(migration).toContain("message = 'venue_map_route_priority_invalid'");
    expect(migration).toMatch(
      /create trigger enforce_valid_venue_map_route_priorities[\s\S]*?before insert or update of payload, domain, organization_id[\s\S]*?on public\.org_data/i,
    );
  });

  it('keeps all detector, sanitizer, and trigger helpers internal', () => {
    for (const signature of [
      'venue_map_route_priority_is_invalid(jsonb)',
      'venue_map_has_invalid_route_priorities(jsonb)',
      'sanitize_venue_map_route_priorities(jsonb)',
      'sanitize_venue_map_rain_contingencies(jsonb, jsonb)',
      'enforce_valid_venue_map_route_priorities()',
    ]) {
      expect(migration).toMatch(new RegExp(
        `revoke all on function public\\.${signature.replace(/[().]/g, '\\$&')}[\\s\\S]*?from public, anon, authenticated`,
        'i',
      ));
    }
  });
});
