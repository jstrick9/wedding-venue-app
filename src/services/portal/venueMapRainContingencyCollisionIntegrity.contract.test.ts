import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0038_venue_map_rain_contingency_collision_integrity.sql'),
  'utf8',
);
const projectionMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0032_venue_map_rain_contingency_integrity.sql'),
  'utf8',
);

describe('migration 0038 Venue Map rain-contingency collision integrity', () => {
  it('detects both duplicate plan IDs and competing outdoor-source mappings', () => {
    expect(migration).toMatch(/group by id having count\(\*\) > 1/);
    expect(migration).toMatch(/group by outdoor_venue_id having count\(\*\) > 1/);
  });

  it('counts collision sets before validating individual catalog references', () => {
    expect(migration).toMatch(
      /count\(\*\) over \(partition by trim\(contingency\.value->>'id'\)\) as id_occurrences/,
    );
    expect(migration).toMatch(
      /count\(\*\) over \([\s\S]*?outdoorVenueId[\s\S]*?\) as outdoor_occurrences/,
    );
    expect(migration).toMatch(
      /where contingency\.id_occurrences = 1\s+and contingency\.outdoor_occurrences = 1\s+and public\.venue_map_rain_contingency_valid/,
    );
  });

  it('continues through space-pin sanitation at the shared Couple/Guest boundary', () => {
    expect(projectionMigration).toMatch(
      /create or replace function public\.apply_guest_venue_map_projection[\s\S]*?sanitize_venue_map_rain_contingencies/,
    );
    expect(projectionMigration).toMatch(
      /create or replace function public\.sanitize_couple_portal_map_result[\s\S]*?sanitize_venue_map_rain_contingencies/,
    );
    expect(migration).toContain(
      'return public.sanitize_venue_map_space_point_links(v_rain_safe_map, p_venues);',
    );
  });

  it('blocks future canonical writes without rewriting existing rows', () => {
    expect(migration).toMatch(
      /create trigger enforce_valid_venue_map_rain_contingency_collisions[\s\S]*?before insert or update of payload, domain, organization_id[\s\S]*?on public\.org_data/,
    );
    expect(migration).toContain("message = 'venue_map_rain_contingency_collision'");
    expect(migration).not.toMatch(/update\s+public\.org_data/i);
  });

  it('keeps every helper and trigger function internal', () => {
    for (const signature of [
      'venue_map_has_rain_contingency_collisions(jsonb)',
      'sanitize_venue_map_rain_contingencies(jsonb, jsonb)',
      'enforce_valid_venue_map_rain_contingency_collisions()',
    ]) {
      expect(migration).toContain(`revoke all on function public.${signature}`);
    }
  });
});
