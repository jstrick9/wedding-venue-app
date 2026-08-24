import { describe, expect, it } from 'vitest';
import { loginHashAfterLogout } from './loginRoute';

describe('loginHashAfterLogout', () => {
  it('clears leftover platform console paths after sign-out', () => {
    expect(loginHashAfterLogout('#/platform-admin/branding')).toBe('#/platform-login');
    expect(loginHashAfterLogout('#/platform-admin')).toBe('#/platform-login');
    expect(loginHashAfterLogout('#/platform-admin/venues/abc')).toBe('#/platform-login');
    expect(loginHashAfterLogout('')).toBe('#/platform-login');
    expect(loginHashAfterLogout('#/')).toBe('#/platform-login');
  });

  it('returns venue staff to that venue login when a slug is known', () => {
    expect(loginHashAfterLogout('#/home', 'seven-paths-manor')).toBe('#/venue-login/seven-paths-manor');
    expect(loginHashAfterLogout('#/dashboard', 'seven-paths-manor')).toBe('#/venue-login/seven-paths-manor');
    expect(loginHashAfterLogout('#/studio', 'hilltop-barn')).toBe('#/venue-login/hilltop-barn');
    expect(loginHashAfterLogout('#/admin', 'hilltop-barn')).toBe('#/venue-login/hilltop-barn');
    expect(loginHashAfterLogout('#/venue-login/hilltop-barn', 'other')).toBe('#/venue-login/hilltop-barn');
  });

  it('does not rewrite public portal or onboarding hashes', () => {
    expect(loginHashAfterLogout('#/couples-portal?token=abc')).toBe('#/couples-portal?token=abc');
    expect(loginHashAfterLogout('#/guest-portal?couple=1')).toBe('#/guest-portal?couple=1');
    expect(loginHashAfterLogout('#/venue-onboarding')).toBe('#/venue-onboarding');
    expect(loginHashAfterLogout('', 'seven-paths-manor', '/i/va-abc123def4567890')).toBe('');
  });
});
