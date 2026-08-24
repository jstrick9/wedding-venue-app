import { describe, expect, it } from 'vitest';
import { claimVenueWorkspaceTitle, possessiveVenueName } from './claimVenueTitle';

describe('claimVenueWorkspaceTitle', () => {
  it('uses the venue name in the possessive heading', () => {
    expect(claimVenueWorkspaceTitle('Seven Paths Manor')).toBe("Claim Seven Paths Manor's Venue Workspace");
  });

  it('uses a trailing apostrophe when the name already ends in s', () => {
    expect(claimVenueWorkspaceTitle('The Gardens')).toBe("Claim The Gardens' Venue Workspace");
    expect(possessiveVenueName("St. James's")).toBe("St. James's");
  });

  it('falls back when the venue name is not loaded yet', () => {
    expect(claimVenueWorkspaceTitle('')).toBe('Claim Venue Workspace');
    expect(claimVenueWorkspaceTitle(null)).toBe('Claim Venue Workspace');
  });
});
