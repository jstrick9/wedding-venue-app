import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLATFORM_LOGIN_CONFIG,
  NEUTRAL_LOGIN_CONFIG,
  applyLoginBranding,
  loginBackgroundStyle,
  mergePlatformLoginBranding,
  mergeVenueLoginBranding,
  resolveLoginChrome,
} from './loginBranding';

describe('login branding', () => {
  it('falls back to charcoal / white / gray when venue colors are missing', () => {
    const chrome = resolveLoginChrome({ venueName: 'Hilltop Barn' });
    expect(chrome.primary).toBe(NEUTRAL_LOGIN_CONFIG.primaryColor);
    expect(chrome.primary).toBe('#111827');
    expect(chrome.primary).not.toBe('#4A1942');
    expect(chrome.headerText).toBe('#FFFFFF');
  });

  it('uses saved venue colors when they are present', () => {
    const chrome = resolveLoginChrome({
      primaryColor: '#4A1942',
      primaryDark: '#3d1a45',
      headerTextColor: '#FFFFFF',
    });
    expect(chrome.primary).toBe('#4A1942');
    expect(chrome.primaryDark).toBe('#3d1a45');
  });

  it('keeps the navy platform default when platform branding is empty', () => {
    const merged = mergePlatformLoginBranding({});
    expect(merged.primaryColor).toBe(DEFAULT_PLATFORM_LOGIN_CONFIG.primaryColor);
    expect(merged.primaryColor).toBe('#26354A');
    expect(merged.venueName).toBe('Wedding Venue Intelligence Platform');
    expect(merged.venueAdminInviteTtlDays).toBe(14);
    expect(merged.venueAdminReissueTtlDays).toBe(7);
  });

  it('does not let an empty public payload collapse onto Seven Paths plum', () => {
    const venue = mergeVenueLoginBranding({ venueName: 'New Chapel' });
    expect(venue.primaryColor).toBe('#111827');
    expect(venue.venueName).toBe('New Chapel');
    expect(JSON.stringify(venue)).not.toContain('#4A1942');
  });

  it('sets the browser tab from login branding instead of Seven Paths Manor', () => {
    applyLoginBranding({
      venueName: 'Platform Console',
      logoUrl: '',
      primaryColor: '#26354A',
    });
    expect(document.title).toBe('Platform Console');
    expect(document.title).not.toContain('Seven Paths Manor');
  });

  it('builds a login background from branding instead of a hardcoded plum pattern', () => {
    const style = loginBackgroundStyle({
      primaryColor: '#26354A',
      loginBackgroundType: 'pattern',
      loginBackgroundPattern: 'dots',
      loginBackgroundColor: '#F4F7FA',
    });
    expect(String(style.backgroundImage)).toContain('#26354A');
    expect(String(style.backgroundImage)).not.toContain('#4A1942');
  });
});
