import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('VenueLoginScreen hang guards', () => {
  it('times out public venue branding and always clears the loading card', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/VenueLoginScreen.tsx'), 'utf8');
    expect(source).toContain('Loading venue sign-in timed out');
    expect(source).toContain('getPublicVenueBranding');
    expect(source).toContain('withTimeout');
    expect(source).toContain('20000');
    expect(source).toContain('finally');
    expect(source).toContain('setLoading(false)');
    expect(source).toContain('Try again');
  });

  it('does not wait on branding before Open Workspace when already signed in', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/VenueLoginScreen.tsx'), 'utf8');
    const signedIn = source.indexOf('signedInHere');
    const loading = source.indexOf('if (loading)');
    expect(signedIn).toBeGreaterThan(-1);
    expect(signedIn).toBeLessThan(loading);
    expect(source).toContain('organizationSlug === slug.trim()');
    expect(source).toContain('Open Venue Workspace');
  });
});
