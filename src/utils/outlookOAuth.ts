const OAUTH_STORAGE_KEY = 'wvip_outlook_oauth';
export const OUTLOOK_OAUTH_SCOPES = 'offline_access Mail.Send User.Read';
export const OUTLOOK_AUTHORITY = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';

export interface OutlookOAuthSession {
  verifier: string;
  state: string;
  clientId: string;
  redirectUri: string;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function outlookRedirectUri(location: Location = window.location): string {
  return `${location.origin}${location.pathname || '/'}`;
}

export async function createOutlookPkce(): Promise<{ verifier: string; challenge: string; state: string }> {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const stateBytes = crypto.getRandomValues(new Uint8Array(16));
  const verifier = bytesToBase64Url(verifierBytes);
  const state = bytesToBase64Url(stateBytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, state, challenge: bytesToBase64Url(new Uint8Array(digest)) };
}

export function saveOutlookOAuthSession(session: OutlookOAuthSession): void {
  sessionStorage.setItem(OAUTH_STORAGE_KEY, JSON.stringify(session));
}

export function readOutlookOAuthSession(): OutlookOAuthSession | null {
  try {
    const raw = sessionStorage.getItem(OAUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OutlookOAuthSession;
    if (!parsed.verifier || !parsed.state || !parsed.clientId || !parsed.redirectUri) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearOutlookOAuthSession(): void {
  sessionStorage.removeItem(OAUTH_STORAGE_KEY);
}

export function buildOutlookAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  challenge: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    response_type: 'code',
    redirect_uri: input.redirectUri,
    response_mode: 'query',
    scope: OUTLOOK_OAUTH_SCOPES,
    state: input.state,
    code_challenge: input.challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${OUTLOOK_AUTHORITY}/authorize?${params.toString()}`;
}

export function readOutlookOAuthCallback(search: string): { code?: string; state?: string; error?: string } {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return {
    code: params.get('code') || undefined,
    state: params.get('state') || undefined,
    error: params.get('error_description') || params.get('error') || undefined,
  };
}

export function stripOAuthSearch(location: Location = window.location): void {
  const next = `${location.pathname}${location.hash || '#/platform-admin/email'}`;
  window.history.replaceState({}, document.title, next);
}
