import { isPasswordResetPath } from './passwordResetRoute';
import { isVenueOnboardingPath } from './venueAdminInviteRoute';
import { isStaffAcceptInvitePath } from './staffInviteRoute';

/**
 * Hash to show after signing out of a staff/platform session.
 * Platform console paths must not linger on the login screen.
 * Venue invite paths stay put so a platform sign-out cannot steal `/i/<token>`.
 */
export function loginHashAfterLogout(
  hash = '',
  organizationSlug?: string | null,
  pathname?: string,
): string {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  if (isVenueOnboardingPath(path) || isPasswordResetPath(path) || isStaffAcceptInvitePath(path)) {
    return hash || '';
  }

  const route = (hash || '').split('?')[0];

  if (
    route.startsWith('#/venue-onboarding') ||
    route.startsWith('#/password-reset') ||
    route.startsWith('#/accept-invite') ||
    route.startsWith('#/couples-portal') ||
    route.startsWith('#/guest-portal')
  ) {
    return hash || route;
  }

  if (route.startsWith('#/venue-login/')) {
    return route;
  }

  const venueWorkspace =
    route === '#/venue' ||
    route.startsWith('#/home') ||
    route.startsWith('#/dashboard') ||
    route.startsWith('#/studio') ||
    route.startsWith('#/admin') ||
    route.startsWith('#/venuemap');

  if (venueWorkspace && organizationSlug) {
    return `#/venue-login/${encodeURIComponent(organizationSlug)}`;
  }

  return '#/platform-login';
}
