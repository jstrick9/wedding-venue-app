import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  __dirname,
  '../../../supabase/migrations/0045_venue_map_complexity_budget.sql',
), 'utf8');
const client = readFileSync(resolve(__dirname, '../../utils/venueMapDesigner.ts'), 'utf8');

describe('Venue Map complexity-budget migration', () => {
  it('keeps client and SQL ceilings aligned', () => {
    const limits = [
      ['VENUE_MAP_MAX_POINTS', '500', /jsonb_array_length\(p_map->'points'\) > 500/i],
      ['VENUE_MAP_MAX_ROUTES', '500', /jsonb_array_length\(p_map->'routes'\) > 500/i],
      ['VENUE_MAP_MAX_DRAWINGS', '500', /jsonb_array_length\(p_map->'drawings'\) > 500/i],
      ['VENUE_MAP_MAX_RAIN_CONTINGENCIES', '250', /jsonb_array_length\(p_map->'rainContingencies'\) > 250/i],
      ['VENUE_MAP_MAX_ROUTE_POINTS', '100', /jsonb_array_length\(route\.value->'pointIds'\) > 100/i],
      ['VENUE_MAP_MAX_LINE_VERTICES', '500', /jsonb_array_length\(drawing\.value->'points'\) > 500/i],
    ] as const;
    for (const [constant, value, sqlPattern] of limits) {
      expect(client).toMatch(new RegExp(`export const ${constant} = ${value}`));
      expect(migration).toMatch(sqlPattern);
    }
    expect(client).toContain('VENUE_MAP_MAX_SERIALIZED_BYTES = 2 * 1024 * 1024');
    expect(migration).toContain('octet_length(p_map::text) > 2097152');
    expect(migration).toMatch(
      /if jsonb_typeof\(p_map\) <> 'object' then\s+return octet_length\(p_map::text\) > 2097152/i,
    );
  });

  it('fails closed before any expensive portal sanitizer', () => {
    expect(migration).toMatch(
      /begin\s+if public\.venue_map_exceeds_complexity_budget\(p_map\) then\s+return null;\s+end if;\s+if public\.venue_map_has_invalid_frame/i,
    );
    expect(migration).toMatch(
      /venue_map_has_invalid_frame[\s\S]*?sanitize_venue_map_structural_integrity[\s\S]*?sanitize_venue_map_point_coordinates/i,
    );
  });

  it('preserves every downstream integrity layer without rewriting history', () => {
    expect(migration).toContain(
      'v_space_safe_map := public.sanitize_venue_map_space_point_links(v_rain_safe_map, p_venues)',
    );
    expect(migration).toMatch(
      /return public\.sanitize_venue_map_route_priorities\([\s\S]*?public\.sanitize_venue_map_drawings\(v_space_safe_map\)/i,
    );
    expect(migration).toContain('contingency.id_occurrences = 1');
    expect(migration).toContain('contingency.outdoor_occurrences = 1');
    expect(migration).not.toMatch(/update\s+public\.org_data/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.org_data/i);
  });

  it('uses bounded identity lookups instead of rescanning every point per stop', () => {
    expect(migration).toContain('v_point_ids text[] := array[]::text[]');
    expect(migration).toContain("trim(route_point.value #>> '{}') = any(v_point_ids)");
    expect(migration).toMatch(/with point_counts as \([\s\S]*?group by left\(trim\(point\.value->>'id'\), 200\)/i);
    expect(migration).toMatch(/left join point_counts as point[\s\S]*?coalesce\(point\.occurrences, 0\) <> 1/i);
  });

  it('installs the budget guard before every existing detailed trigger', () => {
    expect(migration).toMatch(
      /create trigger enforce_000_venue_map_complexity_budget\s+before insert or update of payload, domain, organization_id/i,
    );
    expect(migration).toContain("message = 'venue_map_complexity_budget_exceeded'");
    expect(migration).toContain("errcode = '54000'");
  });

  it('keeps helpers and the recomposed portal boundary internal', () => {
    for (const signature of [
      'venue_map_exceeds_complexity_budget(jsonb)',
      'sanitize_venue_map_point_coordinates(jsonb)',
      'venue_map_has_invalid_route_references(jsonb)',
      'sanitize_venue_map_rain_contingencies(jsonb, jsonb)',
      'enforce_venue_map_complexity_budget()',
    ]) {
      expect(migration).toMatch(new RegExp(
        `revoke all on function public\\.${signature.replace(/[().]/g, '\\$&')}[\\s\\S]*?from public, anon, authenticated`,
        'i',
      ));
    }
  });
});
