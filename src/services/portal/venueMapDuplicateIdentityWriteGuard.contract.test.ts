import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0035_venue_map_duplicate_identity_write_guard.sql'),
  'utf8',
);

describe('migration 0035 Venue Map duplicate-identity write guard', () => {
  it('counts valid point, route, and drawing identities independently', () => {
    expect(migration).toContain("'point'::text as family");
    expect(migration).toContain("'route'::text");
    expect(migration).toContain("'drawing'::text");
    expect(migration).toMatch(/group by family, id\s+having count\(\*\) > 1/);
  });

  it('evaluates structural identities without audience or event-space filtering', () => {
    const helper = migration.slice(
      migration.indexOf('create or replace function public.venue_map_has_duplicate_object_ids'),
      migration.indexOf('revoke all on function public.venue_map_has_duplicate_object_ids'),
    );
    expect(helper).not.toMatch(/audience/i);
    expect(helper).not.toMatch(/eventSpaceIds/);
    expect(helper).toMatch(/p_map->'routes'[\s\S]*?jsonb_typeof\(route\.value->'pointIds'\) = 'array'/);
  });

  it('rejects future canonical writes at the org_data boundary', () => {
    expect(migration).toMatch(
      /create trigger enforce_unique_venue_map_object_ids[\s\S]*?before insert or update of payload, domain, organization_id[\s\S]*?on public\.org_data/,
    );
    expect(migration).toContain("message = 'venue_map_duplicate_object_id'");
  });

  it('does not rewrite existing canonical rows', () => {
    expect(migration).not.toMatch(/update\s+public\.org_data/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.org_data/i);
  });

  it('keeps helper and trigger execution internal', () => {
    expect(migration).toContain(
      'revoke all on function public.venue_map_has_duplicate_object_ids(jsonb)',
    );
    expect(migration).toContain(
      'revoke all on function public.enforce_unique_venue_map_object_ids()',
    );
  });
});
