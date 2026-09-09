import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0032_venue_map_rain_contingency_integrity.sql'),
  'utf8',
);

describe('migration 0032 rain-contingency integrity', () => {
  it('matches explicit environment-first and legacy category fallback eligibility', () => {
    expect(migration).toContain('create or replace function public.venue_map_rain_role_eligible(');
    expect(migration).toContain("p_role = 'source'");
    expect(migration).toContain("in ('outdoor', 'ceremony')");
    expect(migration).toContain("p_role = 'backup'");
    expect(migration).toContain("in ('indoor', 'both')");
    expect(migration).toMatch(/not \(p_venue \? 'environment'\)[\s\S]*?category/);
  });

  it('requires one unambiguous current venue for each distinct source and backup', () => {
    expect(migration).toContain('create or replace function public.venue_map_rain_contingency_valid(');
    expect((migration.match(/select count\(\*\) = 1/g) || [])).toHaveLength(2);
    expect(migration).toContain("trim(p_contingency->>'outdoorVenueId') <> trim(p_contingency->>'indoorVenueId')");
    expect(migration).toContain("venue_map_rain_role_eligible(value, 'source')");
    expect(migration).toContain("venue_map_rain_role_eligible(value, 'backup')");
  });

  it('keeps existing canonical JSON for recovery but blocks future invalid publications', () => {
    expect(migration).toContain('create or replace function public.venue_map_has_invalid_rain_contingencies(');
    expect(migration).toMatch(
      /create trigger enforce_valid_venue_map_rain_contingencies[\s\S]*?before insert or update of payload, domain, organization_id[\s\S]*?on public\.org_data/,
    );
    expect(migration).toContain("message = 'venue_map_rain_contingency_invalid'");
    expect(migration).not.toMatch(/delete\s+from\s+public\.org_data/i);
    expect(migration).not.toMatch(/update\s+public\.org_data/i);
  });

  it('sanitizes contingencies before they can expand guest scope', () => {
    expect(migration).toMatch(
      /build_guest_venue_map_projection_with_priority\([\s\S]*?sanitize_venue_map_rain_contingencies\([\s\S]*?canonical_venues\.payload/,
    );
    expect(migration).toMatch(
      /v_portal_source_map := public\.sanitize_venue_map_rain_contingencies[\s\S]*?build_couple_venue_map_projection\(v_portal_source_map\)[\s\S]*?build_guest_venue_map_projection_with_priority\([\s\S]*?v_portal_source_map/,
    );
  });

  it('uses a present canonical venue catalog and only falls back when its row is absent', () => {
    expect(migration).toMatch(
      /data\.domain = 'venues'[\s\S]*?v_has_canonical_venues := found;[\s\S]*?if not v_has_canonical_venues then[\s\S]*?v_payload->'venues'/,
    );
    expect(migration).toMatch(
      /left join public\.org_data as canonical_venues[\s\S]*?canonical_venues\.domain = 'venues'/,
    );
  });

  it('keeps all integrity helpers and portal wrappers off the direct API surface', () => {
    const signatures = [
      'venue_map_rain_role_eligible(jsonb, text)',
      'venue_map_rain_contingency_valid(jsonb, jsonb)',
      'sanitize_venue_map_rain_contingencies(jsonb, jsonb)',
      'venue_map_has_invalid_rain_contingencies(jsonb, jsonb)',
      'enforce_valid_venue_map_rain_contingencies()',
      'apply_guest_venue_map_projection(jsonb, text)',
      'sanitize_couple_portal_map_result(jsonb, uuid)',
    ];
    for (const signature of signatures) {
      expect(migration).toContain(`revoke all on function public.${signature}`);
    }
  });
});
