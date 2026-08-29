import { describe, expect, it } from 'vitest';
import {
  buildStaffInviteUrl,
  getStaffInviteTokenFromLocation,
  isStaffAcceptInviteHash,
  isStaffAcceptInvitePath,
  sanitizeStaffInviteToken,
  shouldShowStaffAcceptInvite,
} from './staffInviteRoute';

describe('staffInviteRoute', () => {
  it('builds a path-only invite URL with no query or hash', () => {
    expect(buildStaffInviteUrl('abcdef0123456789', 'https://weddingvip.vercel.app/')).toBe(
      'https://weddingvip.vercel.app/accept-invite/abcdef0123456789',
    );
    expect(buildStaffInviteUrl('abcdef0123456789', 'https://weddingvip.vercel.app/')).not.toContain('?');
    expect(buildStaffInviteUrl('abcdef0123456789', 'https://weddingvip.vercel.app/')).not.toContain('#');
  });

  it('reads the token from pathname or hash', () => {
    expect(getStaffInviteTokenFromLocation({
      hash: '',
      pathname: '/accept-invite/abcdef0123456789',
    })).toBe('abcdef0123456789');
    expect(getStaffInviteTokenFromLocation({
      hash: '#/accept-invite/legacytoken99',
      pathname: '/',
    })).toBe('legacytoken99');
  });

  it('strips mail-client junk from the token', () => {
    expect(sanitizeStaffInviteToken('abcdef0123456789#/accept-invite')).toBe('abcdef0123456789');
    expect(sanitizeStaffInviteToken('abcdef0123456789?utm=1')).toBe('abcdef0123456789');
  });

  it('shows the accept screen for path invites without a hash', () => {
    expect(shouldShowStaffAcceptInvite({
      hash: '',
      pathname: '/accept-invite/abcdef0123456789',
    })).toBe(true);
    expect(isStaffAcceptInvitePath('/accept-invite/abcdef0123456789')).toBe(true);
    expect(isStaffAcceptInviteHash('#/accept-invite/legacytoken99')).toBe(true);
    expect(shouldShowStaffAcceptInvite({
      hash: '',
      pathname: '/',
    })).toBe(false);
  });
});
