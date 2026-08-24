import { afterEach, describe, expect, it } from 'vitest';
import {
  buildVenueAdminInviteUrl,
  captureVenueAdminInviteToken,
  clearVenueAdminInviteToken,
  describeVenueAdminInviteError,
  getVenueAdminTokenFromLocation,
  isVenueOnboardingHash,
  shouldShowVenueAdminOnboarding,
} from './venueAdminInviteRoute';

describe('venueAdminInviteRoute', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('builds a query-param invite URL that survives hash stripping', () => {
    expect(buildVenueAdminInviteUrl('va-abc123', 'https://weddingvip.vercel.app/')).toBe(
      'https://weddingvip.vercel.app?va=va-abc123#/venue-onboarding',
    );
    expect(buildVenueAdminInviteUrl('va-abc123', 'https://weddingvip.vercel.app/')).not.toContain('#/venue-onboarding?token=');
  });

  it('reads the token from search, hash query, path, or session storage', () => {
    expect(getVenueAdminTokenFromLocation({
      hash: '#/venue-onboarding',
      search: '?va=va-from-search',
    })).toBe('va-from-search');
    expect(getVenueAdminTokenFromLocation({
      hash: '#/venue-onboarding?token=va-from-hash',
      search: '',
    })).toBe('va-from-hash');
    expect(getVenueAdminTokenFromLocation({
      hash: '#/venue-onboarding/va-from-path',
      search: '',
    })).toBe('va-from-path');
    sessionStorage.setItem('wvip_venue_admin_invite_token', 'va-stored');
    expect(getVenueAdminTokenFromLocation({
      hash: '#/venue-onboarding',
      search: '',
    })).toBe('va-stored');
  });

  it('persists a captured token so a cleaned URL still works', () => {
    const token = captureVenueAdminInviteToken({
      hash: '#/venue-onboarding?token=va-keep-me',
      search: '',
    });
    expect(token).toBe('va-keep-me');
    expect(captureVenueAdminInviteToken({
      hash: '#/venue-onboarding',
      search: '',
    })).toBe('va-keep-me');
    clearVenueAdminInviteToken();
    expect(getVenueAdminTokenFromLocation({
      hash: '#/venue-onboarding',
      search: '',
    })).toBeUndefined();
  });

  it('describes lookup failures specifically', () => {
    expect(isVenueOnboardingHash('#/venue-onboarding?token=x')).toBe(true);
    expect(describeVenueAdminInviteError('expired')).toMatch(/expired/i);
    expect(describeVenueAdminInviteError('not_found')).toMatch(/reissue/i);
    expect(describeVenueAdminInviteError('missing')).toMatch(/missing/i);
  });

  it('keeps the setup screen after the query token is stripped', () => {
    expect(shouldShowVenueAdminOnboarding({
      hash: '',
      locationHash: '#/venue-onboarding',
      search: '',
      token: 'va-keep',
    })).toBe(true);
    expect(shouldShowVenueAdminOnboarding({
      hash: '',
      locationHash: '',
      search: '?va=va-keep',
      token: 'va-keep',
    })).toBe(true);
    expect(shouldShowVenueAdminOnboarding({
      hash: '',
      locationHash: '',
      search: '',
      token: 'va-keep',
    })).toBe(false);
  });
});
