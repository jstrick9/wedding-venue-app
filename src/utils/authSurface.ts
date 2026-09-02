import { isPasswordResetPath, passwordResetSurfaceFromLocation } from './passwordResetRoute';
import { shouldShowVenueAdminOnboarding } from './venueAdminInviteRoute';
import { isStaffAcceptInvitePath } from './staffInviteRoute';

export type AuthSurface = 'platform' | 'venue' | 'couple' | 'guest';

export const AUTH_STORAGE_KEYS: Record<AuthSurface, string> = {
  platform: 'wvip-auth-platform',
  venue: 'wvip-auth-venue',
  couple: 'wvip-auth-couple',
  guest: 'wvip-auth-guest',
};

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
  if (isStaffAcceptInvitePath(pathname)) {
    return 'venue';
  }
  const route = (hash || '').split('?')[0];
  if (route.startsWith('#/couples-portal')) return 'couple';
  if (route.startsWith('#/guest-portal')) return 'guest';
  if (
    isVenueStaffRoute(hash) ||
    route.startsWith('#/venue-login') ||
    route.startsWith('#/accept-invite')
  ) {
    return 'venue';
  }
  return 'platform';
}
