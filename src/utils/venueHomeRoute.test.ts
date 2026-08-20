import { describe, expect, it } from 'vitest';
import {
  VENUE_HOME_HASH,
  isLegacyVenueHomeHash,
  isVenueHomeHash,
  needsVenueHomeHashRewrite,
} from './venueHomeRoute';

describe('venueHomeRoute', () => {
  it('recognizes Home hashes', () => {
    expect(VENUE_HOME_HASH).toBe('#/home');
    expect(isVenueHomeHash('#/home')).toBe(true);
    expect(isVenueHomeHash('#/home/')).toBe(true);
    expect(isVenueHomeHash('')).toBe(true);
    expect(isVenueHomeHash('#/')).toBe(true);
    expect(isVenueHomeHash('#/admin')).toBe(false);
    expect(isVenueHomeHash('#/studio')).toBe(false);
  });

  it('rewrites leftover dashboard and venue hashes to Home', () => {
    expect(isLegacyVenueHomeHash('#/dashboard')).toBe(true);
    expect(isLegacyVenueHomeHash('#/dashboard/ops')).toBe(true);
    expect(isLegacyVenueHomeHash('#/venue')).toBe(true);
    expect(isLegacyVenueHomeHash('#/venue/')).toBe(true);
    expect(needsVenueHomeHashRewrite('#/dashboard')).toBe(true);
    expect(needsVenueHomeHashRewrite('#/venue')).toBe(true);
    expect(needsVenueHomeHashRewrite('')).toBe(true);
    expect(needsVenueHomeHashRewrite('#/')).toBe(true);
    expect(needsVenueHomeHashRewrite('#/home')).toBe(false);
    expect(needsVenueHomeHashRewrite('#/admin')).toBe(false);
    expect(needsVenueHomeHashRewrite('#/studio')).toBe(false);
  });
});