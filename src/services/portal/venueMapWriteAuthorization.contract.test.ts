import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration0010 = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0010_guest_rsvp_hardening_org_data_and_chat.sql'),
  'utf8',
);
const migration0024 = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0024_venue_map_write_authorization.sql'),
  'utf8',
);

describe('migration 0024 venue-map write authorization', () => {
  it('classifies the canonical venue-map domain as owner/admin controlled', () => {
    expect(migration0024).toContain(
      'create or replace function public.org_data_write_allowed(',
    );
    expect(migration0024).toMatch(
      /lower\(p_domain\)[\s\S]*?'venuemapconfigs'/,
    );
    expect(migration0024).toContain(
      "array['owner','admin']::public.app_role[]",
    );
    expect(migration0024).not.toContain(
      "array['owner','admin','planner']::public.app_role[]",
    );
  });

  it('protects insert, update, and delete through the existing org-data policies', () => {
    expect(migration0010).toMatch(
      /create policy "org_data_insert_members"[\s\S]*?org_data_write_allowed\(organization_id, domain\)/,
    );
    expect(migration0010).toMatch(
      /create policy "org_data_update_members"[\s\S]*?using \([\s\S]*?org_data_write_allowed\(organization_id, domain\)[\s\S]*?with check \([\s\S]*?org_data_write_allowed\(organization_id, domain\)/,
    );
    expect(migration0010).toMatch(
      /create policy "org_data_delete_members"[\s\S]*?org_data_write_allowed\(organization_id, domain\)/,
    );
  });
});
