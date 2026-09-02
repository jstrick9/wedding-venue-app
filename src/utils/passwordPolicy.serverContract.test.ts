import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { invitePasswordPolicyError } from '../../supabase/functions/_shared/passwordPolicy.ts';
import { describePasswordPolicyError } from './passwordPolicy';

describe('invite password browser/server contract', () => {
  it.each([
    '',
    'Short#1',
    'lowercase#1',
    'UPPERCASE#1',
    'NoNumber!',
    'NoSpecial1',
    'White space1A',
    'Valid#12',
    'Another$Strong9',
    `Aa1!${'x'.repeat(124)}`,
    `Aa1!${'x'.repeat(125)}`,
  ])('agrees for %j', (password) => {
    expect(Boolean(invitePasswordPolicyError(password))).toBe(Boolean(describePasswordPolicyError(password)));
  });

  it('returns the same user-facing policy message on both invite functions', () => {
    expect(invitePasswordPolicyError('lowercase1!')).toBe(describePasswordPolicyError('lowercase1!'));
    expect(invitePasswordPolicyError('Valid#12')).toBeNull();
  });

  it.each(['claim-venue-admin', 'claim-portal-invite'])(
    'is invoked by the %s Edge Function before account creation',
    (functionName) => {
      const source = readFileSync(
        resolve(process.cwd(), `supabase/functions/${functionName}/index.ts`),
        'utf8',
      );
      expect(source).toContain("import { invitePasswordPolicyError } from '../_shared/passwordPolicy.ts'");
      expect(source).toContain('const passwordError = invitePasswordPolicyError(password);');
      expect(source.indexOf('invitePasswordPolicyError(password)')).toBeLessThan(
        source.indexOf('auth.admin.createUser'),
      );
    },
  );
});
