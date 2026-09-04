/**
 * Stable path-only password recovery landings. The delivery endpoint validates
 * the app-owned destination before appending a one-time proof in the fragment.
 */

export type PasswordResetSurface = 'platform' | 'venue';

const RESET_PATH_RE = /^\/reset(?:\/(platform|venue))?\/?$/i;

export function isPasswordResetPath(pathname?: string): boolean {
  return RESET_PATH_RE.test(pathname || '');
}

export function isPasswordResetHash(hash?: string): boolean {
  const route = (hash || '').split('?')[0];
  return route === '#/password-reset' || route.startsWith('#/password-reset/');
}

export function passwordResetSurfaceFromLocation(input: { pathname?: string } = {}): PasswordResetSurface {
  const match = (input.pathname || '').match(/^\/reset\/(platform|venue)/i);
  if (match?.[1]?.toLowerCase() === 'venue') return 'venue';
  return 'platform';
}

export function shouldShowPasswordRecovery(input: { pathname?: string; hash?: string } = {}): boolean {
  return isPasswordResetPath(input.pathname) || isPasswordResetHash(input.hash);
}

export function buildPasswordResetRedirectUrl(surface: PasswordResetSurface, base?: string): string {
  const origin = (base || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '') || '';
  const safe: PasswordResetSurface = surface === 'venue' ? 'venue' : 'platform';
  return `${origin}/reset/${safe}`;
}

export function passwordResetLoginHash(surface: PasswordResetSurface, venueSlug?: string): string {
  if (surface !== 'venue') return '#/platform-login';
  const slug = (venueSlug || '').trim().toLowerCase();
  return slug ? `#/venue-login/${encodeURIComponent(slug)}` : '#/home';
}

function searchParams(value?: string): URLSearchParams {
  let raw = value || '';
  if (raw.length > 4096) return new URLSearchParams();
  if (raw.startsWith('?') || raw.startsWith('#')) raw = raw.slice(1);
  if (raw.includes('?')) raw = raw.slice(raw.indexOf('?') + 1);
  return new URLSearchParams(raw);
}

export function readRecoveryCode(search?: string): string | undefined {
  const code = searchParams(search).get('code')?.trim();
  return code && code.length <= 2048 ? code : undefined;
}

export function readRecoveryTokenHash(search?: string): string | undefined {
  const tokenHash = searchParams(search).get('token_hash')?.trim();
  if (!tokenHash || tokenHash.length > 512 || /\s/.test(tokenHash)) return undefined;
  return tokenHash;
}

export function readRecoveryVenueSlug(search?: string): string | undefined {
  const slug = searchParams(search).get('venue')?.trim().toLowerCase();
  if (!slug || !/^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/.test(slug)) return undefined;
  return slug;
}

export function readRecoveryTokensFromHash(hash?: string): { accessToken: string; refreshToken: string } | undefined {
  const raw = hash || '';
  if (raw.length > 20_000 || !raw.includes('access_token=')) return undefined;
  const withoutHash = raw.startsWith('#') ? raw.slice(1) : raw;
  const tokenPart = withoutHash.includes('access_token=')
    ? (withoutHash.includes('?') ? withoutHash.slice(withoutHash.indexOf('?') + 1) : withoutHash)
    : '';
  const params = new URLSearchParams(tokenPart);
  const accessToken = params.get('access_token') || '';
  const refreshToken = params.get('refresh_token') || '';
  if (
    !accessToken
    || !refreshToken
    || accessToken.length > 10_000
    || refreshToken.length > 10_000
    || /\s/.test(accessToken)
    || /\s/.test(refreshToken)
  ) return undefined;
  return { accessToken, refreshToken };
}

export function stripRecoveryParamsFromUrl(location: Pick<Location, 'pathname' | 'hash'> = window.location): void {
  if (typeof history === 'undefined' || typeof history.replaceState !== 'function') return;
  const path = isPasswordResetPath(location.pathname) ? location.pathname : '/';
  history.replaceState(null, '', path);
}
