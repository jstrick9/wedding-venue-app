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

describe('PlatformAdminPortal invite and lifecycle hang guards', () => {
  it('times out reissue, revoke, suspend, and invite email delivery', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/PlatformAdminPortal.tsx'), 'utf8');
    expect(source).toContain('Reissuing the invite timed out');
    expect(source).toContain('Revoking the invite timed out');
    expect(source).toContain('Suspending the venue timed out');
    expect(source).toContain('Sending the invite email timed out');
    const reissueSlice = source.slice(source.indexOf('const handleReissue'), source.indexOf('const handleRevoke'));
    expect(reissueSlice).toContain('withTimeout');
    expect(reissueSlice).toContain('reissueVenueAdminInvite');
    const mailSlice = source.slice(source.indexOf('const sendInviteEmail'), source.indexOf('const handleCreateVenue'));
    expect(mailSlice).toContain('deliverVenueAdminInvite');
    expect(mailSlice).toContain('withTimeout');
  });
});

describe('PlatformAdminPortal branding hang guards', () => {
  it('times out branding save and logo upload', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/PlatformAdminPortal.tsx'), 'utf8');
    expect(source).toContain('Saving platform branding timed out');
    expect(source).toContain('Uploading the platform logo timed out');
    const saveSlice = source.slice(source.indexOf('const handleSavePlatformBranding'), source.indexOf('const handleCreateVenue'));
    expect(saveSlice).toContain('savePlatformBranding');
    expect(saveSlice).toContain('uploadPublicBrandingAsset');
    expect(saveSlice).toContain('withTimeout');
  });
});

describe('PlatformAdminPortal secondary console load hang guards', () => {
  it('times out branding, metrics, and audit and does not save before branding loads', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/PlatformAdminPortal.tsx'), 'utf8');
    const loadSlice = source.slice(source.indexOf('const loadSecondaryConsoleData'), source.indexOf('const loadConsole'));
    expect(loadSlice).toContain('withTimeout');
    expect(loadSlice).toContain('getPlatformBranding');
    expect(loadSlice).toContain('20000');
    expect(loadSlice).toContain('Loading platform branding timed out');
    expect(loadSlice).toContain('getPlatformConsoleMetrics');
    expect(loadSlice).toContain('listPlatformAuditLogs');
    expect(loadSlice).toContain('setBrandingReady(true)');
    expect(loadSlice).toContain('setBrandingReady(false)');
    expect(source).toContain('Loading branding…');
    expect(source).toContain('brandingBusy');
  });
});
