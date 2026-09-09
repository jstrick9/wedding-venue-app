import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0036_venue_map_route_reference_integrity.sql'),
  'utf8',
);

describe('migration 0036 Venue Map route-reference integrity', () => {
  it('builds the structural point catalog before validating routes', () => {
    expect(migration).toMatch(
      /with point_candidates as \([\s\S]*?point\.value->>'kind' in \('space', 'parking', 'entry', 'amenity', 'path'\)[\s\S]*?route_candidates as/,
    );
  });

  it('rejects non-array, short, malformed, sentinel, and repeated point sequences', () => {
    expect(migration).toContain("jsonb_typeof(route.value->'pointIds') is distinct from 'array'");
    expect(migration).toMatch(/jsonb_array_length\([\s\S]*?\) < 2/);
    expect(migration).toContain("trim(route_point.value #>> '{}') = '__invalid_map_point_reference__'");
    expect(migration).toMatch(
      /jsonb_array_length\([\s\S]*?\) <> \([\s\S]*?count\(distinct trim\(route_point\.value #>> '\{\}'\)\)/,
    );
  });

  it('requires every ordered reference to resolve to exactly one point', () => {
    expect(migration).toMatch(
      /from point_candidates as point[\s\S]*?point\.id = trim\(route_point\.value #>> '\{\}'\)[\s\S]*?\) <> 1/,
    );
  });

  it('blocks future canonical writes without rewriting existing rows', () => {
    expect(migration).toMatch(
      /create trigger enforce_valid_venue_map_route_references[\s\S]*?before insert or update of payload, domain, organization_id[\s\S]*?on public\.org_data/,
    );
    expect(migration).toContain("message = 'venue_map_route_reference_invalid'");
    expect(migration).not.toMatch(/update\s+public\.org_data/i);
  });

  it('keeps helper and trigger execution internal', () => {
    expect(migration).toContain(
      'revoke all on function public.venue_map_has_invalid_route_references(jsonb)',
    );
    expect(migration).toContain(
      'revoke all on function public.enforce_valid_venue_map_route_references()',
    );
  });
});
