/**
 * Hash to show after signing out of a staff/platform session.
 * Platform console paths must not linger on the login screen.
 */
export function loginHashAfterLogout(hash = '', organizationSlug?: string | null): string {
  const route = (hash || '').split('?')[0];

  if (
    route.startsWith('#/venue-onboarding') ||
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
