import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('PlatformAdminPortal onboard hang guards', () => {
  it('wraps onboard geocode and create in withTimeout', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/PlatformAdminPortal.tsx'), 'utf8');
    expect(source).toContain('Address verification timed out');
    expect(source).toContain('Creating the venue timed out');
    const onboardSlice = source.slice(source.indexOf('const handleCreateVenue'), source.indexOf('const copyVenueLogin'));
    expect(onboardSlice).toContain('withTimeout');
    expect(onboardSlice).toContain('geocodeVenueAddress');
    expect(onboardSlice).toContain('createVenueOrganization');
  });
});
