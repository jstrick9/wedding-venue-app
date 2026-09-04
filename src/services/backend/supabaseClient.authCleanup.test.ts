import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { AUTH_STORAGE_KEYS } from '../../utils/authSurface';
import { clearPersistedAuthSurface } from './supabaseClient';

describe('clearPersistedAuthSurface', () => {
  beforeEach(() => localStorage.clear());

  it('captures the bounded access token before removing reloadable auth and PKCE state', () => {
    const key = AUTH_STORAGE_KEYS.venue;
    localStorage.setItem(key, JSON.stringify({
      access_token: 'captured-access-token',
      refresh_token: 'refresh-token',
    }));
    localStorage.setItem(`${key}-code-verifier`, 'verifier');

    expect(clearPersistedAuthSurface('venue')).toBe('captured-access-token');
    expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem(`${key}-code-verifier`)).toBeNull();
  });

  it('still removes a corrupt record that cannot supply a revocation token', () => {
    const key = AUTH_STORAGE_KEYS.platform;
    localStorage.setItem(key, '{broken');
    localStorage.setItem(`${key}-code-verifier`, 'verifier');

    expect(clearPersistedAuthSurface('platform')).toBeUndefined();
    expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem(`${key}-code-verifier`)).toBeNull();
  });

  it('moves a legacy token without revoking that same token on the obsolete client', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/services/backend/supabaseClient.ts'), 'utf8');
    const migration = source.slice(
      source.indexOf('export async function migrateLegacyAuthSessions'),
      source.indexOf('export async function getCurrentAccessToken'),
    );
    expect(migration).not.toContain('legacy.auth.signOut');
    expect(migration).toContain('localStorage.removeItem(legacyKey)');
    expect(migration).toContain('localStorage.removeItem(`${legacyKey}-code-verifier`)');
  });
});
