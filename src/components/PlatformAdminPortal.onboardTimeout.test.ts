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

describe('PlatformAdminPortal venue list hang guards', () => {
  it('times out listPlatformOrganizations and does not wait on it before metrics', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/PlatformAdminPortal.tsx'), 'utf8');
    const loadSlice = source.slice(source.indexOf('const loadConsole'), source.indexOf('useEffect(() => { void loadConsole();'));
    expect(loadSlice.indexOf('loadSecondaryConsoleData()')).toBeLessThan(loadSlice.indexOf('listPlatformOrganizations()'));
    expect(loadSlice).toContain('withTimeout');
    expect(loadSlice).toContain('Loading venues timed out');
    const refreshSlice = source.slice(source.indexOf('const refreshVenuesAfterSave'), source.indexOf('const sendInviteEmail'));
    expect(refreshSlice.indexOf('loadSecondaryConsoleData()')).toBeLessThan(refreshSlice.indexOf('listPlatformOrganizations()'));
    expect(refreshSlice).toContain('Refreshing venues timed out');
    expect(source).toContain('venuesReady ? organizations.length : null');
  });
});
