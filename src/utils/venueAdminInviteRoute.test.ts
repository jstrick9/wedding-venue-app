import { afterEach, describe, expect, it } from 'vitest';
import {
  buildVenueAdminInviteUrl,
  captureVenueAdminInviteToken,
  clearVenueAdminInviteToken,
  describeVenueAdminInviteError,
  getVenueAdminTokenFromLocation,
  isVenueOnboardingHash,
  isVenueOnboardingPath,
  sanitizeVenueAdminToken,
  shouldShowVenueAdminOnboarding,
} from './venueAdminInviteRoute';

describe('venueAdminInviteRoute', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('builds a path-only invite URL with no query or hash', () => {
    expect(buildVenueAdminInviteUrl('va-abc123def4567890', 'https://weddingvip.vercel.app/')).toBe(
      'https://weddingvip.vercel.app/i/va-abc123def4567890',
    );
    expect(buildVenueAdminInviteUrl('va-abc123def4567890', 'https://weddingvip.vercel.app/')).not.toContain('?');
    expect(buildVenueAdminInviteUrl('va-abc123def4567890', 'https://weddingvip.vercel.app/')).not.toContain('#');
  });

  it('reads the token from pathname, search, hash query, hash path, or session storage', () => {
    expect(getVenueAdminTokenFromLocation({
      hash: '',
      search: '',
      pathname: '/i/va-from-pathaaaa1111',
    })).toBe('va-from-pathaaaa1111');
    expect(getVenueAdminTokenFromLocation({
      hash: '#/venue-onboarding',
      search: '?va=va-from-searchbb2222',
    })).toBe('va-from-searchbb2222');
    expect(getVenueAdminTokenFromLocation({
      hash: '#/venue-onboarding?token=va-from-hashccc3333',
      search: '',
    })).toBe('va-from-hashccc3333');
    expect(getVenueAdminTokenFromLocation({
      hash: '#/venue-onboarding/va-from-hashpath4444',
      search: '',
    })).toBe('va-from-hashpath4444');
    sessionStorage.setItem('wvip_venue_admin_invite_token', 'va-storeddddd5555');
    expect(getVenueAdminTokenFromLocation({
      hash: '#/venue-onboarding',
      search: '',
    })).toBe('va-storeddddd5555');
  });

  it('strips mail-client junk from the token', () => {
    expect(sanitizeVenueAdminToken('va-abc123def4567890#/venue-onboarding')).toBe('va-abc123def4567890');
    expect(sanitizeVenueAdminToken('https://weddingvip.vercel.app/i/va-abc123def4567890')).toBe('va-abc123def4567890');
    expect(sanitizeVenueAdminToken('va-abc123def4567890%23/venue-onboarding')).toBe('va-abc123def4567890');
  });

  it('persists a captured token so a cleaned URL still works', () => {
    const token = captureVenueAdminInviteToken({
      hash: '#/venue-onboarding?token=va-keep-meeeee6666',
      search: '',
    });
    expect(token).toBe('va-keep-meeeee6666');
    expect(captureVenueAdminInviteToken({
      hash: '#/venue-onboarding',
      search: '',
    })).toBe('va-keep-meeeee6666');
    clearVenueAdminInviteToken();
    expect(getVenueAdminTokenFromLocation({
      hash: '#/venue-onboarding',
      search: '',
    })).toBeUndefined();
  });

  it('describes lookup failures specifically', () => {
    expect(isVenueOnboardingHash('#/venue-onboarding?token=x')).toBe(true);
    expect(isVenueOnboardingPath('/i/va-abc123def4567890')).toBe(true);
    expect(describeVenueAdminInviteError('expired')).toMatch(/expired/i);
    expect(describeVenueAdminInviteError('not_found')).toMatch(/reissue/i);
    expect(describeVenueAdminInviteError('missing')).toMatch(/missing/i);
    expect(describeVenueAdminInviteError('invalid input syntax for type uuid: "(abc,def)"')).toMatch(/invalid|reissue/i);
    expect(describeVenueAdminInviteError('invalid input syntax for type uuid: "(abc,def)"')).not.toMatch(/migration|sql|0015/i);
  });

  it('shows the setup screen for path invites without a hash', () => {
    expect(shouldShowVenueAdminOnboarding({
      hash: '',
      locationHash: '',
      search: '',
      pathname: '/i/va-abc123def4567890',
      token: 'va-abc123def4567890',
    })).toBe(true);
    expect(shouldShowVenueAdminOnboarding({
      hash: '',
      locationHash: '',
      search: '',
      token: 'va-keep',
    })).toBe(false);
  });
});
