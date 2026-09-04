import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isAccountRequiredDenial,
  projectedRsvpHasStamp,
  summarizeMutationLedger,
  validateProbeConfig,
} from './e2e-rsvp-concurrency.mjs';

function validConfig() {
  return {
    url: 'https://example.supabase.co',
    anonKey: 'publishable-key',
    coupleId: 'couple-1',
    guests: [
      { token: 'guest-token-a-123456', password: 'StrongA1!' },
      { token: 'guest-token-b-123456', password: 'StrongB2!' },
    ],
  };
}

describe('personal-account RSVP concurrency harness', () => {
  it('requires two distinct guests and strong passwords for a mutating run', () => {
    expect(validateProbeConfig(validConfig())).toEqual([]);

    const duplicate = validConfig();
    duplicate.guests[1].token = duplicate.guests[0].token;
    expect(validateProbeConfig(duplicate)).toContain('Two distinct guest tokens are required.');

    const weak = validConfig();
    weak.guests[1].password = 'weak';
    expect(validateProbeConfig(weak)).toContain(
      'Each guest password must satisfy the shared 8–128 character policy.',
    );
  });

  it('allows password-free preflight but still requires both tokens', () => {
    const preflight = validConfig();
    preflight.guests.forEach((guest) => { guest.password = ''; });
    expect(validateProbeConfig(preflight, true)).toEqual([]);

    preflight.guests[1].token = '';
    expect(validateProbeConfig(preflight, true)).toContain(
      'GUEST_TOKEN_A and GUEST_TOKEN_B are required.',
    );
  });

  it('recognizes only the exact account-required RPC denial', () => {
    expect(isAccountRequiredDenial({
      status: 200,
      body: { ok: false, error: 'account_required' },
    })).toBe(true);
    expect(isAccountRequiredDenial({
      status: 401,
      body: { ok: false, error: 'account_required' },
    })).toBe(false);
    expect(isAccountRequiredDenial({
      status: 200,
      body: { ok: false, error: 'not_found' },
    })).toBe(false);
  });

  it('verifies each privacy-projected RSVP instead of expecting the full submission list', () => {
    expect(projectedRsvpHasStamp({
      ok: true,
      rsvp: { notes: 'e2e-concurrency-a123' },
    }, 'a123')).toBe(true);
    expect(projectedRsvpHasStamp({
      ok: true,
      coupleSubmissions: [{ notes: 'e2e-concurrency-a123' }],
      rsvp: null,
    }, 'a123')).toBe(false);
  });

  it('summarizes confirmed and indeterminate mutation attempts without identity data', () => {
    expect(summarizeMutationLedger([
      { status: 'confirmed', effects: ['auth-user-creation', 'portal-binding-write'] },
      { status: 'no-change', effects: [] },
      { status: 'confirmed', effects: ['rsvp-write'] },
      { status: 'pending', effects: [] },
    ])).toEqual({
      attempts: 4,
      authUserCreations: 1,
      portalBindingWrites: 1,
      rsvpWrites: 1,
      indeterminate: 1,
    });
  });

  it('pins authenticated account isolation and failure-safe mutation accounting', () => {
    const source = readFileSync(resolve(process.cwd(), 'scripts/e2e-rsvp-concurrency.mjs'), 'utf8');
    expect(source).toContain('anonymous snapshot read is denied');
    expect(source).toContain('anonymous RSVP write is denied before mutation');
    expect(source).toContain("{ actor: 'A', target: 'B'");
    expect(source).toContain("{ actor: 'B', target: 'A'");
    expect(source).toContain('guest invitations are bound to two distinct Auth users');
    expect(source).toContain('sessions[0].accessToken');
    expect(source).toContain("if (claimOutcome === 'existing-auth-account')");
    expect(source).toContain('settled = await Promise.allSettled([');
    expect(source).toMatch(/finally \{[\s\S]*?printMutationLedger\(\);/);
    expect(source).not.toContain('process.env.GUEST_TOKEN_B || process.env.GUEST_TOKEN_A');
  });
});
