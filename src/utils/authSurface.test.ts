import { describe, expect, it } from 'vitest';
import { AUTH_STORAGE_KEYS, detectAuthSurface, isVenueStaffRoute } from './authSurface';

describe('authSurface', () => {
  it('keeps platform console and login on the platform surface', () => {
    expect(detectAuthSurface({ hash: '', pathname: '/' })).toBe('platform');
    expect(detectAuthSurface({ hash: '#/platform-login', pathname: '/' })).toBe('platform');
    expect(detectAuthSurface({ hash: '#/platform-admin/venues', pathname: '/' })).toBe('platform');
    expect(detectAuthSurface({ hash: '', pathname: '/reset/platform' })).toBe('platform');
  });

  it('isolates couple and guest portal sessions from staff authentication', () => {
    expect(detectAuthSurface({ hash: '#/couples-portal?token=cp-secret', pathname: '/' })).toBe('couple');
    expect(detectAuthSurface({ hash: '#/guest-portal?token=guest-secret', pathname: '/' })).toBe('guest');
    expect(new Set(Object.values(AUTH_STORAGE_KEYS)).size).toBe(4);
    expect(AUTH_STORAGE_KEYS.couple).not.toBe(AUTH_STORAGE_KEYS.venue);
    expect(AUTH_STORAGE_KEYS.guest).not.toBe(AUTH_STORAGE_KEYS.venue);
    expect(isVenueStaffRoute('#/couples-portal')).toBe(false);
    expect(isVenueStaffRoute('#/guest-portal')).toBe(false);
  });

  it('keeps venue workspace, venue login, and staff invite links on the venue surface', () => {
    expect(detectAuthSurface({ hash: '#/home', pathname: '/' })).toBe('venue');
    expect(detectAuthSurface({ hash: '#/admin/venues', pathname: '/' })).toBe('venue');
    expect(detectAuthSurface({ hash: '#/venue-login/seven-paths-manor', pathname: '/' })).toBe('venue');
    expect(detectAuthSurface({ hash: '', pathname: '/i/va-abc123def4567890' })).toBe('venue');
    expect(detectAuthSurface({ hash: '', pathname: '/accept-invite/abcdef0123456789' })).toBe('venue');
    expect(detectAuthSurface({ hash: '#/venue-onboarding', pathname: '/' })).toBe('venue');
    expect(detectAuthSurface({ hash: '', pathname: '/reset/venue' })).toBe('venue');
    expect(isVenueStaffRoute('#/home')).toBe(true);
    expect(isVenueStaffRoute('#/platform-admin')).toBe(false);
  });
});
