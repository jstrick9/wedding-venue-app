import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0037_venue_map_space_point_link_integrity.sql'),
  'utf8',
);
const projectionMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0032_venue_map_rain_contingency_integrity.sql'),
  'utf8',
);

describe('migration 0037 Venue Map space-point link integrity', () => {
  it('requires a space pin venueId to resolve exactly once in the current catalog', () => {
    expect(migration).toMatch(
      /p_point->>'kind' = 'space'[\s\S]*?jsonb_typeof\(p_point->'venueId'\) = 'string'[\s\S]*?trim\(venue\.value->>'id'\) = trim\(p_point->>'venueId'\)[\s\S]*?\) = 1/,
    );
  });

  it('retains duplicate point groups until downstream identity rejection', () => {
    expect(migration).toMatch(
      /count\(\*\) over \(partition by left\(trim\(point\.value->>'id'\), 200\)\) as id_occurrences/,
    );
    expect(migration).toMatch(
      /where point\.id_occurrences > 1\s+or point\.value->>'kind' <> 'space'/,
    );
  });

  it('removes unique invalid space pins and their dependent routes only in portal sanitation', () => {
    expect(migration).toContain('create or replace function public.sanitize_venue_map_space_point_links(');
    expect(migration).toMatch(
      /invalid_space_ids as \([\s\S]*?point\.id_occurrences = 1[\s\S]*?not public\.venue_map_space_point_link_valid/,
    );
    expect(migration).toMatch(
      /join invalid_space_ids as invalid[\s\S]*?invalid\.id = trim\(route_point\.value #>> '\{\}'\)/,
    );
    expect(migration).toMatch(
      /return public\.sanitize_venue_map_space_point_links\(v_rain_safe_map, p_venues\)/,
    );
  });

  it('feeds both authoritative Guest and Couple wrapper flows through the extended sanitizer', () => {
    expect(projectionMigration).toMatch(
      /create or replace function public\.apply_guest_venue_map_projection[\s\S]*?public\.sanitize_venue_map_rain_contingencies\(/,
    );
    expect(projectionMigration).toMatch(
      /create or replace function public\.sanitize_couple_portal_map_result[\s\S]*?v_portal_source_map := public\.sanitize_venue_map_rain_contingencies\(/,
    );
    expect(migration).toContain(
      'return public.sanitize_venue_map_space_point_links(v_rain_safe_map, p_venues);',
    );
  });

  it('blocks future canonical map writes without rewriting existing rows', () => {
    expect(migration).toMatch(
      /create trigger enforce_valid_venue_map_space_point_links[\s\S]*?before insert or update of payload, domain, organization_id[\s\S]*?on public\.org_data/,
    );
    expect(migration).toContain("message = 'venue_map_space_point_link_invalid'");
    expect(migration).not.toMatch(/update\s+public\.org_data/i);
  });

  it('keeps all validation and sanitation helpers internal', () => {
    for (const signature of [
      'venue_map_space_point_link_valid(jsonb, jsonb)',
      'venue_map_has_invalid_space_point_links(jsonb, jsonb)',
      'sanitize_venue_map_space_point_links(jsonb, jsonb)',
      'sanitize_venue_map_rain_contingencies(jsonb, jsonb)',
      'enforce_valid_venue_map_space_point_links()',
    ]) {
      expect(migration).toContain(`revoke all on function public.${signature}`);
    }
  });
});
