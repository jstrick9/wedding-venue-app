import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration0025 = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0025_venue_map_invalid_scope_fail_closed.sql'),
  'utf8',
);

describe('migration 0025 malformed venue-map scope boundary', () => {
  it('rejects the internal invalid-scope sentinel before matching selected spaces', () => {
    expect(migration0025).toContain(
      'create or replace function public.guest_venue_map_object_visible(',
    );
    expect(migration0025).toMatch(
      /invalid_scope[\s\S]*?= '__invalid_event_scope__'[\s\S]*?then false[\s\S]*?scope\.value = any\(p_relevant_space_ids\)/,
    );
  });

  it('keeps the projection helper unavailable to browser roles', () => {
    expect(migration0025).toMatch(
      /revoke all on function public\.guest_venue_map_object_visible\(jsonb, text\[\]\)[\s\S]*?from public, anon, authenticated;/,
    );
  });
});
