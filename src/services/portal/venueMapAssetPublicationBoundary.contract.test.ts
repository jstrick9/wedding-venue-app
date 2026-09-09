import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration0028 = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0028_venue_map_asset_publication_boundary.sql'),
  'utf8',
);

describe('migration 0028 venue-map asset publication boundary', () => {
  it('replaces folder-wide portal reads with one security-definer decision', () => {
    expect(migration0028).toContain(
      'create or replace function public.can_read_venue_map_image(',
    );
    expect(migration0028).toMatch(
      /create policy "storage_venue_map_images_select_authorized"[\s\S]*?bucket_id = 'venue-map-images'[\s\S]*?public\.can_read_venue_map_image\(name\)/,
    );
    expect(migration0028).not.toMatch(
      /create policy "storage_venue_map_images_select_authorized"[\s\S]*?from public\.portal_accounts/,
    );
  });

  it('allows only the exact canonical reference and keeps JSON null authoritative', () => {
    expect(migration0028).toContain(
      "v_expected_ref := 'sp://venue-map-images/' || p_object_name",
    );
    expect(migration0028).toContain("data.domain = 'venueMapConfigs'");
    expect(migration0028).toContain(
      "v_canonical_map->>'backgroundImageUrl' = v_expected_ref",
    );
    expect(migration0028).toMatch(
      /when v_has_canonical_map then v_canonical_map[\s\S]*?else v_account\.payload->'venueMapConfigs'/,
    );
  });

  it('requires a current mapped participant and enforces revocation and expiry', () => {
    expect(migration0028).toContain("account.status = 'active'");
    expect(migration0028).toContain("v_account.participant_id = 'primary-couple'");
    expect(migration0028).toContain("v_participant->>'revokedAt'");
    expect(migration0028).toContain("v_participant->>'allowPortalAccess'");
    expect(migration0028).toContain("v_participant->>'tokenRevokedAt'");
    expect(migration0028).toContain('v_expires_at <= now()');
    expect(migration0028).toContain(
      'public.snapshot_token_expires_at(v_account.payload, null)',
    );
  });

  it('keeps the helper unavailable to anonymous callers', () => {
    expect(migration0028).toMatch(
      /revoke all on function public\.can_read_venue_map_image\(text\)[\s\S]*?from public, anon;/,
    );
    expect(migration0028).toMatch(
      /grant execute on function public\.can_read_venue_map_image\(text\)[\s\S]*?to authenticated;/,
    );
  });

  it('aligns draft-asset writes with owner/admin map publication', () => {
    const writePolicy = migration0028.slice(
      migration0028.indexOf('create policy "storage_venue_map_images_write_admins"'),
    );
    expect(writePolicy).toContain("array['owner','admin']::public.app_role[]");
    expect(writePolicy).not.toContain("'planner'");
    expect(writePolicy).toContain('with check');
  });
});
