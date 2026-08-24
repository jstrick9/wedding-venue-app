import { describe, expect, it } from 'vitest';
import { detectAuthSurface, isVenueStaffRoute } from './authSurface';

describe('authSurface', () => {
  it('keeps platform console and login on the platform surface', () => {
    expect(detectAuthSurface({ hash: '', pathname: '/' })).toBe('platform');
    expect(detectAuthSurface({ hash: '#/platform-login', pathname: '/' })).toBe('platform');
    expect(detectAuthSurface({ hash: '#/platform-admin/venues', pathname: '/' })).toBe('platform');
  });

  it('keeps venue workspace, venue login, and invite links on the venue surface', () => {
    expect(detectAuthSurface({ hash: '#/home', pathname: '/' })).toBe('venue');
    expect(detectAuthSurface({ hash: '#/admin/venues', pathname: '/' })).toBe('venue');
    expect(detectAuthSurface({ hash: '#/venue-login/seven-paths-manor', pathname: '/' })).toBe('venue');
    expect(detectAuthSurface({ hash: '', pathname: '/i/va-abc123def4567890' })).toBe('venue');
    expect(detectAuthSurface({ hash: '#/venue-onboarding', pathname: '/' })).toBe('venue');
    expect(isVenueStaffRoute('#/home')).toBe(true);
    expect(isVenueStaffRoute('#/platform-admin')).toBe(false);
  });
});
