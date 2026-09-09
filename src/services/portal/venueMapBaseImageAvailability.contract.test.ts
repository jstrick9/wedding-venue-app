import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0033_venue_map_base_image_availability.sql'),
  'utf8',
);

describe('migration 0033 published base-image availability', () => {
  it('requires the exact tenant-scoped object rather than managed-looking path text', () => {
    expect(migration).toContain('create or replace function public.venue_map_image_object_exists(');
    expect(migration).toContain("v_prefix := 'sp://venue-map-images/' || p_organization_id::text || '/'");
    expect(migration).toMatch(
      /from storage\.objects as object[\s\S]*?object\.bucket_id = 'venue-map-images'[\s\S]*?object\.name = v_object_name/,
    );
  });

  it('strips an unavailable reference while returning an explicit portal status', () => {
    expect(migration).toMatch(
      /create or replace function public\.sanitize_portal_venue_map_base_image\([\s\S]*?venue_map_image_object_exists[\s\S]*?p_map - 'backgroundImageUrl' - 'backgroundOpacity'[\s\S]*?'backgroundImageUnavailable'/,
    );
    expect(migration).toContain("return p_map - 'backgroundImageUnavailable'");
  });

  it('blocks future canonical publication of missing, external, or cross-tenant objects', () => {
    expect(migration).toMatch(
      /enforce_managed_venue_map_base_image[\s\S]*?not public\.venue_map_image_object_exists\(v_ref, new\.organization_id\)/,
    );
    expect(migration).toContain(
      "message = 'venue_map_base_image_must_reference_existing_managed_object'",
    );
    expect(migration).toMatch(
      /create trigger enforce_managed_venue_map_base_image[\s\S]*?before insert or update of payload, domain, organization_id/,
    );
  });

  it('protects only an exact currently published object from delete or rename', () => {
    expect(migration).toMatch(
      /create trigger protect_published_venue_map_image[\s\S]*?before delete or update of bucket_id, name[\s\S]*?on storage\.objects/,
    );
    expect(migration).toContain("data.payload->>'backgroundImageUrl' = v_ref");
    expect(migration).toContain("message = 'published_venue_map_image_cannot_be_removed'");
    expect(migration).not.toMatch(/delete\s+from\s+storage\.objects/i);
  });

  it('does not rewrite canonical customer rows or automatically delete old files', () => {
    expect(migration).not.toMatch(/update\s+public\.org_data/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.org_data/i);
    expect(migration).not.toMatch(/delete\s+from\s+storage\.objects/i);
  });

  it('keeps storage-sensitive helpers internal', () => {
    for (const signature of [
      'venue_map_image_object_exists(text, uuid)',
      'sanitize_portal_venue_map_base_image(jsonb, uuid)',
      'enforce_managed_venue_map_base_image()',
      'protect_published_venue_map_image()',
    ]) {
      expect(migration).toContain(`revoke all on function public.${signature}`);
    }
  });
});
