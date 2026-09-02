import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const source = read('supabase/functions/claim-portal-invite/index.ts');
const config = read('supabase/config.toml');

describe('claim-portal-invite Edge Function contract', () => {
  it('allows an unauthenticated invitee to reach token validation', () => {
    expect(config).toMatch(/\[functions\.claim-portal-invite\]\s*verify_jwt = false/);
    expect(source).toContain("admin.rpc('get_portal_invite_context'");
  });

  it('never resets an existing global Auth identity from possession of an invite', () => {
    expect(source).toContain("return json({ error: 'account_exists'");
    expect(source).toContain('admin.auth.admin.createUser');
    expect(source).not.toContain('admin.auth.admin.updateUser');
    expect(source).not.toContain('updateUserById');
  });

  it('rolls back a newly created orphan when the transactional binding fails', () => {
    expect(source).toContain("admin.rpc('claim_portal_invite_account'");
    expect(source).toContain('admin.auth.admin.deleteUser(userId)');
  });
});
