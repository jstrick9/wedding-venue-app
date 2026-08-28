import { isPasswordResetPath, passwordResetSurfaceFromLocation } from './passwordResetRoute';
import { shouldShowVenueAdminOnboarding } from './venueAdminInviteRoute';

export type AuthSurface = 'platform' | 'venue';

export const AUTH_STORAGE_KEYS = {
  platform: 'wvip-auth-platform',
  venue: 'wvip-auth-venue',
} as const;

export function isVenueStaffRoute(hash = ''): boolean {
  const route = (hash || '').split('?')[0];
  return (
    route === '#/venue' ||
    route.startsWith('#/home') ||
    route.startsWith('#/dashboard') ||
    route.startsWith('#/studio') ||
    route.startsWith('#/admin') ||
    route.startsWith('#/venuemap')
  );
}

/** Never put the same refresh token on both clients — rotation would sign one out. */
export function surfacesForLegacySession(hasPlatformRole: boolean, hasOrgMembership: boolean): AuthSurface[] {
  if (hasPlatformRole) return ['platform'];
  if (hasOrgMembership) return ['venue'];
  return ['platform'];
}

export function detectAuthSurface(input: { hash?: string; pathname?: string } = {}): AuthSurface {
  const hash = input.hash ?? (typeof window !== 'undefined' ? window.location.hash : '');
  const pathname = input.pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  if (isPasswordResetPath(pathname)) {
    return passwordResetSurfaceFromLocation({ pathname });
  }
  if (shouldShowVenueAdminOnboarding({ hash, locationHash: hash, pathname })) {
    return 'venue';
  }
  const route = (hash || '').split('?')[0];
  if (
    isVenueStaffRoute(hash) ||
    route.startsWith('#/venue-login') ||
    route.startsWith('#/accept-invite') ||
    route.startsWith('#/couples-portal') ||
    route.startsWith('#/guest-portal')
  ) {
    return 'venue';
  }
  return 'platform';
}
