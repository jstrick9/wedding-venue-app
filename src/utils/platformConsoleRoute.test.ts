import { describe, expect, it } from 'vitest';
import {
  buildPlatformConsoleHash,
  isPlatformConsoleHash,
  isPlatformLoginHash,
  parsePlatformConsoleHash,
  platformHashPath,
} from './platformConsoleRoute';

describe('platform console hash routing', () => {
  it('treats the platform root as overview', () => {
    expect(parsePlatformConsoleHash('')).toEqual({ section: 'overview' });
    expect(parsePlatformConsoleHash('#/platform-admin')).toEqual({ section: 'overview' });
    expect(parsePlatformConsoleHash('#/')).toEqual({ section: 'overview' });
  });

  it('parses known sections and venue detail ids', () => {
    expect(parsePlatformConsoleHash('#/platform-admin/venues')).toEqual({
      section: 'venues',
      venueStatus: 'all',
      venueQueue: 'all',
    });
    expect(parsePlatformConsoleHash('#/platform-admin/venues/org-9')).toEqual({
      section: 'venue-detail',
      venueId: 'org-9',
    });
    expect(parsePlatformConsoleHash('#/platform-admin/audit')).toEqual({ section: 'audit' });
  });

  it('parses venue directory status and queue filters', () => {
    expect(parsePlatformConsoleHash('#/platform-admin/venues?status=active')).toEqual({
      section: 'venues',
      venueStatus: 'active',
      venueQueue: 'all',
    });
    expect(parsePlatformConsoleHash('#/platform-admin/venues?queue=awaiting-admin')).toEqual({
      section: 'venues',
      venueStatus: 'all',
      venueQueue: 'awaiting-admin',
    });
    expect(parsePlatformConsoleHash('#/platform-admin/venues?status=suspended&queue=expired-invite')).toEqual({
      section: 'venues',
      venueStatus: 'suspended',
      venueQueue: 'expired-invite',
    });
  });

  it('builds hashes that round-trip', () => {
    expect(parsePlatformConsoleHash(buildPlatformConsoleHash('onboard'))).toEqual({ section: 'onboard' });
    expect(parsePlatformConsoleHash(buildPlatformConsoleHash('venue-detail', 'abc'))).toEqual({
      section: 'venue-detail',
      venueId: 'abc',
    });
    expect(parsePlatformConsoleHash(buildPlatformConsoleHash('map'))).toEqual({ section: 'map' });
    expect(parsePlatformConsoleHash(buildPlatformConsoleHash('branding'))).toEqual({ section: 'branding' });
    expect(parsePlatformConsoleHash(buildPlatformConsoleHash('chat'))).toEqual({ section: 'chat' });
    expect(parsePlatformConsoleHash('#/platform-admin/email')).toEqual({ section: 'branding' });
    expect(parsePlatformConsoleHash(buildPlatformConsoleHash('venues', undefined, { status: 'active', queue: 'pending-invite' }))).toEqual({
      section: 'venues',
      venueStatus: 'active',
      venueQueue: 'pending-invite',
    });
  });

  it('strips unused query strings on venue detail and falls back for unknown sections', () => {
    expect(parsePlatformConsoleHash('#/platform-admin/venues/org-9?from=map')).toEqual({
      section: 'venue-detail',
      venueId: 'org-9',
    });
    expect(parsePlatformConsoleHash('#/platform-admin/not-a-real-area')).toEqual({ section: 'overview' });
    expect(parsePlatformConsoleHash('#/platform-login')).toEqual({ section: 'overview' });
  });
});
