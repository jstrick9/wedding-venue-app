import { describe, expect, it } from 'vitest';
import { buildVenueAdminHash, parseVenueAdminHash } from './venueAdminRoute';

describe('venueAdminRoute', () => {
  it('parses admin hashes into sections', () => {
    expect(parseVenueAdminHash('#/admin')).toBe('overview');
    expect(parseVenueAdminHash('#/admin/')).toBe('overview');
    expect(parseVenueAdminHash('#/admin/venues')).toBe('venues');
    expect(parseVenueAdminHash('#/admin/branding')).toBe('branding');
    expect(parseVenueAdminHash('#/dashboard')).toBeNull();
    expect(parseVenueAdminHash('')).toBeNull();
    expect(parseVenueAdminHash('#/administrator')).toBeNull();
    expect(parseVenueAdminHash('#/admin/not-a-section')).toBe('overview');
  });

  it('builds admin hashes', () => {
    expect(buildVenueAdminHash('overview')).toBe('#/admin');
    expect(buildVenueAdminHash('venues')).toBe('#/admin/venues');
    expect(buildVenueAdminHash('communication-templates')).toBe('#/admin/communication-templates');
  });
});
