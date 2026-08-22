import { describe, expect, it } from 'vitest';
import {
  OUTLOOK_AUTHORITY,
  buildOutlookAuthorizeUrl,
  outlookRedirectUri,
  readOutlookOAuthCallback,
} from './outlookOAuth';

describe('outlookOAuth', () => {
  it('builds a consumers authorize URL with PKCE', () => {
    const href = buildOutlookAuthorizeUrl({
      clientId: 'client-1',
      redirectUri: 'https://weddingvip.vercel.app/',
      challenge: 'abc',
      state: 'xyz',
    });
    expect(href.startsWith(`${OUTLOOK_AUTHORITY}/authorize?`)).toBe(true);
    const parsed = new URL(href);
    expect(parsed.searchParams.get('client_id')).toBe('client-1');
    expect(parsed.searchParams.get('code_challenge')).toBe('abc');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('scope')).toContain('Mail.Send');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://weddingvip.vercel.app/');
  });

  it('reads an OAuth callback and builds the current redirect URI', () => {
    expect(readOutlookOAuthCallback('?code=one&state=two')).toEqual({ code: 'one', state: 'two', error: undefined });
    expect(outlookRedirectUri({ origin: 'https://weddingvip.vercel.app', pathname: '/' } as Location)).toBe('https://weddingvip.vercel.app/');
  });
});
