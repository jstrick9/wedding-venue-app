import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  __dirname,
  '../../../supabase/migrations/0039_venue_map_drawing_geometry_integrity.sql',
), 'utf8');
const projectionBoundary = readFileSync(resolve(
  __dirname,
  '../../../supabase/migrations/0032_venue_map_rain_contingency_integrity.sql',
), 'utf8');

describe('venue map drawing geometry integrity migration', () => {
  it('preserves existing canonical rows for explicit recovery', () => {
    expect(migration).not.toMatch(/update\s+public\.org_data/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.org_data/i);
  });

  it('allowlists renderable shapes and requires complete geometry', () => {
    expect(migration).toContain("trim(p_drawing->>'type') in ('zone', 'rectangle')");
    expect(migration).toContain("trim(p_drawing->>'type') = 'circle'");
    expect(migration).toContain("trim(p_drawing->>'type') = 'line'");
    expect(migration).toMatch(/width[\s\S]*?> 0[\s\S]*?height[\s\S]*?> 0/i);
    expect(migration).toMatch(/radius[\s\S]*?> 0/i);
    expect(migration).toMatch(/distinct_vertices[\s\S]*?>= 2/i);
    expect(migration).toContain('else false');
  });

  it('removes invalid drawings before the existing projection chain', () => {
    expect(migration).toMatch(/sanitize_venue_map_drawings\([\s\S]*?where public\.venue_map_drawing_geometry_valid/i);
    expect(migration).toMatch(/v_space_safe_map := public\.sanitize_venue_map_space_point_links[\s\S]*?return public\.sanitize_venue_map_drawings\(v_space_safe_map\)/i);
    expect(projectionBoundary).toMatch(/public\.sanitize_venue_map_rain_contingencies\(/i);
  });

  it('rejects future malformed publications at the table boundary', () => {
    expect(migration).toContain('venue_map_has_invalid_drawing_geometry(new.payload)');
    expect(migration).toContain("message = 'venue_map_drawing_geometry_invalid'");
    expect(migration).toMatch(/before insert or update of payload, domain, organization_id[\s\S]*?on public\.org_data/i);
  });

  it('keeps integrity helpers inaccessible to portal callers', () => {
    expect(migration).toMatch(/revoke all on function public\.venue_map_drawing_geometry_valid\(jsonb\)[\s\S]*?from public, anon, authenticated/i);
    expect(migration).toMatch(/revoke all on function public\.sanitize_venue_map_drawings\(jsonb\)[\s\S]*?from public, anon, authenticated/i);
  });
});
