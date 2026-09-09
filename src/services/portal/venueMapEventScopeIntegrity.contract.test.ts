import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0034_venue_map_event_scope_integrity.sql'),
  'utf8',
);

describe('migration 0034 Venue Map event-scope integrity', () => {
  it('allows missing/global scope but rejects malformed and reserved values', () => {
    expect(migration).toContain('create or replace function public.venue_map_event_scope_valid(');
    expect(migration).toContain("if not (p_object ? 'eventSpaceIds') then");
    expect(migration).toContain("jsonb_typeof(p_object->'eventSpaceIds') <> 'array'");
    expect(migration).toContain("trim(scope.value #>> '{}') = '__invalid_event_scope__'");
  });

  it('requires each scope id to resolve to exactly one current venue', () => {
    expect(migration).toMatch(
      /jsonb_typeof\(p_venues\) = 'array'[\s\S]*?venue\.value->'id'[\s\S]*?trim\(venue\.value->>'id'\) = trim\(scope\.value #>> '\{\}'\)[\s\S]*?\) <> 1/,
    );
    expect(migration).toMatch(/group by trim\(scope\.id\)[\s\S]*?having count\(\*\) > 1/);
  });

  it('checks points, routes, and drawings at one canonical write boundary', () => {
    expect(migration).toContain("p_map->'points'");
    expect(migration).toContain("p_map->'routes'");
    expect(migration).toContain("p_map->'drawings'");
    expect(migration).toMatch(
      /create trigger enforce_valid_venue_map_event_scopes[\s\S]*?before insert or update of payload, domain, organization_id[\s\S]*?on public\.org_data/,
    );
    expect(migration).toContain("message = 'venue_map_event_scope_invalid'");
  });

  it('does not rewrite existing canonical data or venue catalogs', () => {
    expect(migration).not.toMatch(/update\s+public\.org_data/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.org_data/i);
  });

  it('keeps validation helpers and the trigger function internal', () => {
    for (const signature of [
      'venue_map_event_scope_valid(jsonb, jsonb)',
      'venue_map_has_invalid_event_scopes(jsonb, jsonb)',
      'enforce_valid_venue_map_event_scopes()',
    ]) {
      expect(migration).toContain(`revoke all on function public.${signature}`);
    }
  });
});
