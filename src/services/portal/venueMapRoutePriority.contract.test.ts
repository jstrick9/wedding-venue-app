import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0030_venue_map_route_priority.sql'),
  'utf8',
);

describe('migration 0030 Venue Map route priority projection', () => {
  it('allowlists all four route priorities and defaults legacy or malformed values to standard', () => {
    for (const priority of ['preferred', 'standard', 'secondary', 'emergency-only']) {
      expect(migration).toContain(`'${priority}'`);
    }
    expect(migration).toMatch(/else 'standard'[\s\S]*?\),\s*'standard'\s*\)/);
  });

  it('merges priority by projected route id without widening the existing point/route boundary', () => {
    expect(migration).toContain('public.build_guest_venue_map_projection(');
    expect(migration).toContain("source.value->>'id' = projected.value->>'id'");
    expect(migration).toContain("jsonb_set(v_projection, '{routes}', v_routes, true)");
    expect(migration).not.toContain("jsonb_set(v_projection, '{points}'");
  });

  it('keeps managed-image sanitation in the authoritative guest read path', () => {
    expect(migration).toMatch(
      /apply_guest_venue_map_projection[\s\S]*?sanitize_portal_venue_map_base_image\([\s\S]*?build_guest_venue_map_projection_with_priority/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.build_guest_venue_map_projection_with_priority\(jsonb, jsonb\)[\s\S]*?from public, anon, authenticated/,
    );
  });
});
