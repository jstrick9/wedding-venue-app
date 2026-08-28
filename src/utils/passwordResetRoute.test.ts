import { describe, expect, it } from 'vitest';
import {
  buildPasswordResetRedirectUrl,
  isPasswordResetHash,
  isPasswordResetPath,
  passwordResetSurfaceFromLocation,
  readRecoveryCode,
  readRecoveryTokensFromHash,
  shouldShowPasswordRecovery,
} from './passwordResetRoute';

describe('password reset route', () => {
  it('recognizes path-only recovery URLs and maps the surface', () => {
    expect(isPasswordResetPath('/reset')).toBe(true);
    expect(isPasswordResetPath('/reset/platform')).toBe(true);
    expect(isPasswordResetPath('/reset/venue')).toBe(true);
    expect(isPasswordResetPath('/reset/venue/')).toBe(true);
    expect(isPasswordResetPath('/i/va-abc')).toBe(false);
    expect(passwordResetSurfaceFromLocation({ pathname: '/reset/venue' })).toBe('venue');
    expect(passwordResetSurfaceFromLocation({ pathname: '/reset/platform' })).toBe('platform');
    expect(passwordResetSurfaceFromLocation({ pathname: '/reset' })).toBe('platform');
  });

  it('builds a path-only redirect with no query or hash', () => {
    expect(buildPasswordResetRedirectUrl('platform', 'https://weddingvip.vercel.app')).toBe(
      'https://weddingvip.vercel.app/reset/platform',
    );
    expect(buildPasswordResetRedirectUrl('venue', 'https://weddingvip.vercel.app/')).toBe(
      'https://weddingvip.vercel.app/reset/venue',
    );
    expect(buildPasswordResetRedirectUrl('platform', 'https://weddingvip.vercel.app')).not.toMatch(/[?#]/);
  });

  it('keeps the legacy hash as a recovery landing and reads PKCE/implicit tokens', () => {
    expect(isPasswordResetHash('#/password-reset')).toBe(true);
    expect(shouldShowPasswordRecovery({ pathname: '/reset/platform' })).toBe(true);
    expect(shouldShowPasswordRecovery({ hash: '#/password-reset' })).toBe(true);
    expect(shouldShowPasswordRecovery({ pathname: '/', hash: '#/platform-login' })).toBe(false);
    expect(readRecoveryCode('?code=abc123')).toBe('abc123');
    expect(readRecoveryTokensFromHash('#access_token=tok&refresh_token=ref&type=recovery')).toEqual({
      accessToken: 'tok',
      refreshToken: 'ref',
    });
  });
});
