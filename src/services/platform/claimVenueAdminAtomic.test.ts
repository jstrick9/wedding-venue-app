import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #247 (P2-G remediation): the venue-admin claim must be atomic and
 * throttled. These guards pin the contract across the Edge Function and
 * migration 0017 — the claim consumes the invite in the same transaction that
 * transfers ownership, brute-force attempts lock out, and every service-only
 * RPC is revoked from anon/authenticated.
 */
describe('claim-venue-admin atomicity and throttle', () => {
  const edgeSource = readFileSync(
    join(process.cwd(), 'supabase/functions/claim-venue-admin/index.ts'),
    'utf8',
  );
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/0017_atomic_venue_admin_claim_and_throttle.sql'),
    'utf8',
  );

  it('Edge Function checks the throttle gate before any Auth mutation', () => {
    expect(edgeSource).toContain("admin.rpc('venue_admin_claim_gate'");
    // The gate must run before the invite-context lookup (which precedes the
    // createUser/updateUserById password writes).
    expect(edgeSource.indexOf('venue_admin_claim_gate')).toBeLessThan(
      edgeSource.indexOf('get_venue_admin_invite_context'),
    );
    expect(edgeSource).toMatch(/429/);
  });

  it('Edge Function registers failed attempts on invalid tokens', () => {
    expect(edgeSource).toContain("admin.rpc('register_venue_admin_claim_failure'");
    expect(edgeSource).toMatch(/registerClaimFailure\(admin, token\)/);
  });

  it('Edge Function claims atomically after the password is set', () => {
    expect(edgeSource).toContain("admin.rpc('claim_venue_admin_account'");
    // The claim call site (not the helper definition) must come after the
    // profile update — the last credential step before claiming.
    expect(edgeSource.indexOf('claimAtomically(admin, token, userId, email)')).toBeGreaterThan(
      edgeSource.indexOf("admin.from('profiles').update"),
    );
    // A rejected claim must fail the request instead of silently succeeding.
    expect(edgeSource).toMatch(/claimResult\.error/);
    // The response reports whether the claim consumed the invite.
    expect(edgeSource).toContain('claimed: claimResult.ok');
  });

  it('migration 0017 locks the invite row and consumes it in the claim transaction', () => {
    expect(migration).toContain('create or replace function public.claim_venue_admin_account');
    // Row lock serializes concurrent claims.
    expect(migration).toMatch(/where vai\.token_hash = v_hash\s*\n\s*for update/);
    // Invite consumption, ownership transfer, and membership upsert all live in
    // the same function body.
    expect(migration).toContain("set status = 'accepted', accepted_by = p_user_id");
    expect(migration).toMatch(/set owner_id = p_user_id/);
    expect(migration).toMatch(/on conflict \(organization_id, user_id\)/);
    // Success clears the throttle counters.
    expect(migration).toMatch(/delete from public\.venue_admin_claim_attempts/);
    // Every claim is audited.
    expect(migration).toContain("'venue_admin_invite.claimed'");
  });

  it('service-only RPCs are revoked from anon and authenticated', () => {
    const revoked = [
      'venue_admin_claim_gate(text)',
      'register_venue_admin_claim_failure(text)',
      'claim_venue_admin_account(text, uuid, text)',
    ];
    for (const fn of revoked) {
      expect(migration).toContain(
        `revoke execute on function public.${fn} from public, anon, authenticated`,
      );
    }
    // The throttle table has RLS and no grants.
    expect(migration).toMatch(
      /alter table public\.venue_admin_claim_attempts enable row level security/,
    );
  });

  it('the throttle locks after 10 failures in a rolling hour for 15 minutes', () => {
    expect(migration).toContain('v_failures >= 10');
    expect(migration).toContain("now() + interval '15 minutes'");
    expect(migration).toContain("now() - interval '1 hour'");
  });

  it('client-side accept is idempotent after an Edge-side claim', () => {
    // accept_venue_admin_invite must succeed when the invite was already
    // accepted by the same signed-in user (the Edge Function consumed it).
    expect(migration).toMatch(/vai\.accepted_by is not distinct from auth\.uid\(\)/);
    expect(migration).toContain("'already_accepted', true");
  });
});
