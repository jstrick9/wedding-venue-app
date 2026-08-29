/**
 * Path-only staff org-invite URLs. Query strings and hashes are stripped by
 * Outlook/Brevo click wrappers, the same failure as venue-admin `/i/<token>`
 * (#206). `/accept-invite/<token>` survives those clients. Legacy
 * `#/accept-invite/<token>` links still parse.
 */

export function sanitizeStaffInviteToken(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  let value = String(raw).trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    // already decoded
  }
  value = value.replace(/\s+/g, '').split('#')[0].split('?')[0].replace(/^\/+/, '');
  value = value.replace(/^accept-invite\//i, '');
  return value.length >= 8 ? value : undefined;
}

export function isStaffAcceptInvitePath(pathname?: string): boolean {
  return /^\/accept-invite\/[^/?#]+/i.test(pathname || '');
}

export function isStaffAcceptInviteHash(hash?: string): boolean {
  const route = (hash || '').split('?')[0];
  return route === '#/accept-invite' || route.startsWith('#/accept-invite/');
}

export function shouldShowStaffAcceptInvite(input: {
  hash?: string;
  pathname?: string;
} = {}): boolean {
  return isStaffAcceptInvitePath(input.pathname) || isStaffAcceptInviteHash(input.hash);
}

export function getStaffInviteTokenFromLocation(input: {
  hash?: string;
  pathname?: string;
} = {}): string {
  const pathMatch = (input.pathname || '').match(/^\/accept-invite\/([^/?#]+)/i);
  if (pathMatch?.[1]) {
    try {
      return sanitizeStaffInviteToken(decodeURIComponent(pathMatch[1])) || '';
    } catch {
      return sanitizeStaffInviteToken(pathMatch[1]) || '';
    }
  }
  const route = (input.hash || '').split('?')[0];
  if (route.startsWith('#/accept-invite/')) {
    const raw = route.slice('#/accept-invite/'.length).split('/')[0];
    try {
      return sanitizeStaffInviteToken(decodeURIComponent(raw)) || '';
    } catch {
      return sanitizeStaffInviteToken(raw) || '';
    }
  }
  return '';
}

export function buildStaffInviteUrl(token: string, base?: string): string {
  const origin = (base || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '') || '';
  const trimmed = sanitizeStaffInviteToken(token) || token.trim();
  if (!trimmed) return origin ? `${origin}/accept-invite` : '/accept-invite';
  return `${origin}/accept-invite/${encodeURIComponent(trimmed)}`;
}
