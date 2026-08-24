const TOKEN_STORAGE_KEY = 'wvip_venue_admin_invite_token';
const QUERY_KEYS = ['va', 'token'] as const;
const OPAQUE_TOKEN_RE = /va-[a-f0-9]{16,}/i;

export type VenueAdminLocation = Pick<Location, 'hash' | 'search'> & { pathname?: string };

export function readStoredVenueAdminInviteToken(): string | undefined {
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    return sanitizeVenueAdminToken(sessionStorage.getItem(TOKEN_STORAGE_KEY) || '');
  } catch {
    return undefined;
  }
}

export function persistVenueAdminInviteToken(token: string): void {
  const trimmed = sanitizeVenueAdminToken(token);
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

/** Pull a va- token out of mail-client junk (#fragments, tracking suffixes, wrapping). */
export function sanitizeVenueAdminToken(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  let value = String(raw).trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    // already decoded
  }
  value = value.replace(/\s+/g, '');
  const opaque = value.match(OPAQUE_TOKEN_RE);
  if (opaque?.[0]) return opaque[0];
  const cleaned = value.split('#')[0].split('?')[0].replace(/^\/+/, '').trim();
  return cleaned.length >= 16 ? cleaned : undefined;
}

function firstQueryToken(search: string): string | undefined {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const key of QUERY_KEYS) {
    const value = sanitizeVenueAdminToken(params.get(key));
    if (value) return value;
  }
  return undefined;
}

export function tokenFromPathname(pathname?: string): string | undefined {
  const path = pathname || '';
  const match = path.match(/\/(?:i|venue-onboarding)\/([^/?#]+)/i);
  if (!match?.[1]) return undefined;
  try {
    return sanitizeVenueAdminToken(decodeURIComponent(match[1]));
  } catch {
    return sanitizeVenueAdminToken(match[1]);
  }
}

export function isVenueOnboardingPath(pathname?: string): boolean {
  return /\/(?:i|venue-onboarding)\/[^/?#]+/i.test(pathname || '');
}

export function getVenueAdminTokenFromLocation(location: VenueAdminLocation = window.location): string | undefined {
  const fromPath = tokenFromPathname(location.pathname);
  if (fromPath) return fromPath;

  const hash = location.hash || '';
  const [route, hashQuery] = hash.split('?');
  const pathMatch = route.match(/^#\/venue-onboarding\/([^/?#]+)/);
  if (pathMatch?.[1]) {
    try {
      return sanitizeVenueAdminToken(decodeURIComponent(pathMatch[1]));
    } catch {
      return sanitizeVenueAdminToken(pathMatch[1]);
    }
  }
  const fromHash = hashQuery ? firstQueryToken(hashQuery) : undefined;
  if (fromHash) return fromHash;
  const fromSearch = firstQueryToken(location.search || '');
  if (fromSearch) return fromSearch;
  if (route.startsWith('#/venue-onboarding') || isVenueOnboardingPath(location.pathname)) {
    return readStoredVenueAdminInviteToken();
  }
  return undefined;
}

/** Capture a token from the URL and persist it. Do not strip the URL here. */
export function captureVenueAdminInviteToken(location: VenueAdminLocation = window.location): string | undefined {
  const token = getVenueAdminTokenFromLocation(location);
  if (token) persistVenueAdminInviteToken(token);
  return token;
}

export function isVenueOnboardingHash(hash: string): boolean {
  const route = (hash || '').split('?')[0];
  return route === '#/venue-onboarding' || route.startsWith('#/venue-onboarding/');
}

/**
 * Keep the setup screen mounted for path, hash, or query invite links.
 */
export function shouldShowVenueAdminOnboarding(input: {
  hash?: string;
  locationHash?: string;
  search?: string;
  pathname?: string;
  token?: string;
} = {}): boolean {
  if (isVenueOnboardingPath(input.pathname)) return true;
  if (isVenueOnboardingHash(input.hash || '') || isVenueOnboardingHash(input.locationHash || '')) {
    return true;
  }
  if (!input.token) return false;
  return Boolean(firstQueryToken(input.search || '') || tokenFromPathname(input.pathname));
}

/**
 * Path-only invite URL. Query strings and hashes are stripped by Outlook/Brevo
 * click wrappers (`?url=https://app/?va=...#/route` treats our ? and # as the
 * wrapper's own). `/i/<token>` survives those clients.
 */
export function buildVenueAdminInviteUrl(token: string, base?: string): string {
  const origin = (base || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '') || '';
  const trimmed = sanitizeVenueAdminToken(token) || token.trim();
  if (!trimmed) return `${origin}/i`;
  return `${origin}/i/${encodeURIComponent(trimmed)}`;
}

export function describeVenueAdminInviteError(code?: string | null): string {
  switch (code) {
    case 'expired':
      return 'This setup link has expired. Ask the platform administrator to reissue the invitation.';
    case 'not_found':
      return 'This setup link is invalid, revoked, or already used. Ask the platform administrator to reissue the invitation from the venue detail page and open the newest email.';
    case 'venue_unavailable':
      return 'This venue is suspended or unavailable.';
    case 'invalid_token':
    case 'missing':
      return 'This setup link is missing or incomplete. Open the newest invitation email and use the Set up your account button, or ask the platform administrator to copy the link from the console.';
    case 'venue_already_claimed':
      return 'This venue already has an owner. Ask the platform administrator to apply migration 0016, then reissue the invitation.';
    default:
      if (/invalid input syntax for type uuid/i.test(code || '')) {
        return 'The invitation is valid, but the lookup function needs a database update. In Supabase → SQL Editor, run supabase/migrations/0016_reissue_claimed_venue_and_invite_lookup.sql, then open this link again.';
      }
      if (code && /[. ]/.test(code) && code.length > 12 && !/invalid input syntax/i.test(code)) {
        return code;
      }
      return 'This setup link is invalid, expired, revoked, or already used. Ask the platform administrator to reissue the invitation.';
  }
}
