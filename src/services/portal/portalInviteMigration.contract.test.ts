import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0021_portal_invitee_accounts.sql'),
  'utf8',
);

describe('migration 0021 portal account contract', () => {
  it('gates every couple and guest read/write RPC behind the bound Auth identity', () => {
    for (const signature of [
      'get_couple_portal_snapshot(p_token text)',
      'save_couple_portal_snapshot(',
      'get_guest_couple_portal_snapshot(',
      'submit_guest_couple_rsvp(',
      'get_couple_portal_snapshot_for_venue(',
      'save_couple_portal_snapshot_for_venue(',
      'get_guest_couple_portal_snapshot_for_venue(',
      'submit_guest_couple_rsvp_for_venue(',
      'get_guest_by_portal_token(p_token text)',
      'submit_guest_rsvp(',
    ]) {
      expect(migration).toContain(`function public.${signature}`);
    }
    expect(migration.match(/'error', 'account_required'/g)).toHaveLength(10);
    expect(migration).toContain("v_account_user_id = auth.uid()");
    expect(migration).toContain('grant execute on function public.accept_portal_invite');
    expect(migration).toContain('to authenticated;');

    const venueSave = migration.match(
      /create or replace function public\.save_couple_portal_snapshot_for_venue\([\s\S]*?\n\$\$;/,
    )?.[0] || '';
    expect(venueSave).toContain("get_portal_invite_context('couple', p_token, null, p_venue_slug)");
    expect(venueSave).toContain('save_couple_portal_snapshot_token_impl');
    expect(venueSave).not.toContain('save_couple_portal_snapshot_unchecked');
    expect(migration).toMatch(
      /revoke all on function public\.get_guest_by_portal_token_token_impl\(text\)[\s\S]*?from public, anon, authenticated;/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.submit_guest_rsvp_token_impl\([\s\S]*?from public, anon, authenticated;/,
    );
  });

  it('keeps service claims private and serializes first-claim and token-reissue races', () => {
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('Re-resolve after waiting for the claim lock');
    expect(migration).toMatch(/revoke all on function public\.claim_portal_invite_account[\s\S]*from public, anon, authenticated;/);
    expect(migration).toMatch(/grant execute on function public\.claim_portal_invite_account[\s\S]*to service_role;/);
  });

  it('refreshes current-token hashes for all snapshot writers and backfills drift', () => {
    expect(migration).toContain('function public.refresh_couple_portal_invite_hashes()');
    expect(migration).toContain('before insert or update of payload on public.couple_portal_snapshots');
    expect(migration).toContain('set payload = payload');
  });

  it('permits legacy no-email records but forbids downgrading newly issued personal invites', () => {
    expect(migration).toContain("v_personal_account_required boolean := false");
    expect(migration).toContain("'error', 'email_required'");
    expect(migration).toContain("@[^[:space:]@]+[.][^[:space:]@]+$");
    expect(migration).toContain('v_account_required := v_personal_account_required');
  });
});
