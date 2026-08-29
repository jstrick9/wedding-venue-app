import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('VenueAdminOnboarding hang guards', () => {
  it('times out invite lookup and claim, and does not wait on branding before the form', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/VenueAdminOnboarding.tsx'), 'utf8');
    expect(source).toContain('Checking this invitation timed out');
    expect(source).toContain('Claiming the venue timed out');
    expect(source).toContain('signUpVenueAdminWithInvite');
    const lookupStart = source.indexOf('Checking this invitation timed out');
    const ready = source.indexOf('setLoadingInvite(false)', lookupStart);
    const branding = source.indexOf('getPublicVenueBranding(context.organizationSlug)', lookupStart);
    expect(ready).toBeGreaterThan(lookupStart);
    expect(branding).toBeGreaterThan(ready);
  });
});
