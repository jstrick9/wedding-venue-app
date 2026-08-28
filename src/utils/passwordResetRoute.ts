/**
 * Path-only password recovery URLs. Query strings and hashes in the
 * `redirectTo` we send to Supabase are stripped by Outlook/Brevo wrappers
 * the same way invite `?va=` links were. `/reset/platform` and `/reset/venue`
 * survive those clients; Supabase then appends `?code=` on the browser redirect.
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

export function readRecoveryCode(search?: string): string | undefined {
  const raw = search || '';
  const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
  const code = params.get('code')?.trim();
  return code || undefined;
}

export function readRecoveryTokensFromHash(hash?: string): { accessToken: string; refreshToken: string } | undefined {
  const raw = hash || '';
  if (!raw.includes('access_token=')) return undefined;
  const withoutHash = raw.startsWith('#') ? raw.slice(1) : raw;
  const tokenPart = withoutHash.includes('access_token=')
    ? (withoutHash.includes('?') ? withoutHash.slice(withoutHash.indexOf('?') + 1) : withoutHash)
    : '';
  const params = new URLSearchParams(tokenPart);
  const accessToken = params.get('access_token') || '';
  const refreshToken = params.get('refresh_token') || '';
  if (!accessToken || !refreshToken) return undefined;
  return { accessToken, refreshToken };
}

export function stripRecoveryParamsFromUrl(location: Pick<Location, 'pathname' | 'hash'> = window.location): void {
  if (typeof history === 'undefined' || typeof history.replaceState !== 'function') return;
  const path = isPasswordResetPath(location.pathname) ? location.pathname : '/';
  history.replaceState(null, '', path);
}
