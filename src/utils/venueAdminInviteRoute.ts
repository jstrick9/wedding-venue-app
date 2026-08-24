const TOKEN_STORAGE_KEY = 'wvip_venue_admin_invite_token';
const QUERY_KEYS = ['va', 'token'] as const;

export function readStoredVenueAdminInviteToken(): string | undefined {
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY)?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export function persistVenueAdminInviteToken(token: string): void {
  const trimmed = token.trim();
  if (!trimmed || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, trimmed);
  } catch {
    // Private mode can block sessionStorage.
  }
}

export function clearVenueAdminInviteToken(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function firstQueryToken(search: string): string | undefined {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const key of QUERY_KEYS) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }
  return undefined;
}

export function getVenueAdminTokenFromLocation(location: Pick<Location, 'hash' | 'search'> = window.location): string | undefined {
  const hash = location.hash || '';
  const [route, hashQuery] = hash.split('?');
  const pathMatch = route.match(/^#\/venue-onboarding\/([^/?#]+)/);
  if (pathMatch?.[1]) {
    try {
      return decodeURIComponent(pathMatch[1]).trim() || undefined;
    } catch {
      return pathMatch[1].trim() || undefined;
    }
  }
  const fromHash = hashQuery ? firstQueryToken(hashQuery) : undefined;
  if (fromHash) return fromHash;
  const fromSearch = firstQueryToken(location.search || '');
  if (fromSearch) return fromSearch;
  if (route.startsWith('#/venue-onboarding')) return readStoredVenueAdminInviteToken();
  return undefined;
}

/** Capture a token from the URL, persist it, and keep using it after the URL is cleaned. */
export function captureVenueAdminInviteToken(location: Pick<Location, 'hash' | 'search'> = window.location): string | undefined {
  const token = getVenueAdminTokenFromLocation(location);
  if (token) persistVenueAdminInviteToken(token);
  return token;
}

export function isVenueOnboardingHash(hash: string): boolean {
  const route = (hash || '').split('?')[0];
  return route === '#/venue-onboarding' || route.startsWith('#/venue-onboarding/');
}

/**
 * Keep the setup screen mounted after the URL is cleaned. Auth re-renders used
 * to remount App, re-read a stripped URL, and show the generic invalid page.
 */
export function shouldShowVenueAdminOnboarding(input: {
  hash?: string;
  locationHash?: string;
  search?: string;
  token?: string;
} = {}): boolean {
  if (isVenueOnboardingHash(input.hash || '') || isVenueOnboardingHash(input.locationHash || '')) {
    return true;
  }
  if (!input.token) return false;
  return Boolean(firstQueryToken(input.search || ''));
}

/**
 * Put the token in a real query string (`?va=`) so Outlook and other mail
 * clients cannot strip it with the hash fragment.
 */
export function buildVenueAdminInviteUrl(token: string, base?: string): string {
  const origin = (base || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '')).replace(/\/+$/, '') || '';
  const trimmed = token.trim();
  if (!trimmed) return `${origin}#/venue-onboarding`;
  return `${origin}?va=${encodeURIComponent(trimmed)}#/venue-onboarding`;
}

export function describeVenueAdminInviteError(code?: string | null): string {
  switch (code) {
    case 'expired':
      return 'This setup link has expired. Ask the platform administrator to reissue the invitation.';
    case 'not_found':
      return 'This setup link is invalid, revoked, or already used. Ask the platform administrator to reissue the invitation.';
    case 'venue_unavailable':
      return 'This venue is suspended or unavailable.';
    case 'invalid_token':
    case 'missing':
      return 'This setup link is missing or incomplete. Open the full invitation link from the email, or ask the platform administrator to reissue it.';
    default:
      return 'This setup link is invalid, expired, revoked, or already used.';
  }
}
