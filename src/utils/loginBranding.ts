import type { CSSProperties } from 'react';
import { applyRootStyles } from '../config';
import type { Config } from '../types';
import { applyDocumentBranding } from './documentBranding';

/** Charcoal / white / gray used when a venue has not saved branding yet. */
export const NEUTRAL_LOGIN_CONFIG: Config = {
  logoUrl: '',
  venueName: 'Venue',
  tagline: '',
  location: '',
  websiteUrl: '',
  supportEmail: '',
  phone: '',
  primaryColor: '#111827',
  primaryDark: '#030712',
  primaryLight: '#374151',
  accentColor: '#6B7280',
  backgroundColor: '#F9FAFB',
  textColor: '#111827',
  headerTextColor: '#FFFFFF',
  bodyTextColor: '#374151',
  accentTextColor: '#111827',
  fontFamily: 'Inter, system-ui, sans-serif',
  headingFontFamily: 'Inter, system-ui, sans-serif',
  welcomeLogoUrl: '',
  welcomeTitle: 'Sign in',
  showWelcomeByDefault: false,
  welcomeFeatures: [],
  loginBackgroundType: 'gradient',
  loginBackgroundColor: '#F3F4F6',
  loginBackgroundSecondaryColor: '#E5E7EB',
  loginBackgroundPattern: 'dots',
  loginBackgroundAnimation: 'none',
  loginBackgroundOverlayOpacity: 0,
};

/** Platform administration login defaults (navy). Independent of venue branding. */
export const DEFAULT_PLATFORM_LOGIN_CONFIG: Config = {
  logoUrl: '',
  venueName: 'Wedding Venue Intelligence Platform',
  tagline: 'Platform administration and venue operations',
  location: '',
  websiteUrl: '',
  supportEmail: '',
  phone: '',
  primaryColor: '#26354A',
  primaryDark: '#182436',
  primaryLight: '#3E5875',
  accentColor: '#6B8DB3',
  backgroundColor: '#F4F7FA',
  textColor: '#1F2937',
  headerTextColor: '#FFFFFF',
  bodyTextColor: '#334155',
  accentTextColor: '#26354A',
  fontFamily: 'Inter, system-ui, sans-serif',
  headingFontFamily: 'Inter, system-ui, sans-serif',
  welcomeLogoUrl: '',
  welcomeTitle: 'Platform administration',
  showWelcomeByDefault: false,
  welcomeFeatures: ['Venue organizations', 'Managed administrators', 'Tenant health', 'Secure onboarding'],
  loginBackgroundType: 'gradient',
  loginBackgroundColor: '#F4F7FA',
  loginBackgroundSecondaryColor: '#E7EEF7',
  loginBackgroundPattern: 'dots',
  loginBackgroundAnimation: 'none',
  loginBackgroundOverlayOpacity: 0,
};

export interface LoginChrome {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  background: string;
  headerText: string;
  bodyText: string;
  fontFamily: string;
  headingFontFamily: string;
}

function firstColor(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = String(value ?? '').trim();
    if (trimmed) return trimmed;
  }
  return '';
}

/** Resolve login chrome from branding. Missing colors fall back to neutral — never to Seven Paths plum. */
export function resolveLoginChrome(config?: Partial<Config> | null): LoginChrome {
  const source = config || {};
  return {
    primary: firstColor(source.primaryColor, NEUTRAL_LOGIN_CONFIG.primaryColor),
    primaryDark: firstColor(source.primaryDark, source.primaryColor, NEUTRAL_LOGIN_CONFIG.primaryDark),
    primaryLight: firstColor(source.primaryLight, source.primaryColor, NEUTRAL_LOGIN_CONFIG.primaryLight),
    accent: firstColor(source.accentColor, source.primaryColor, NEUTRAL_LOGIN_CONFIG.accentColor),
    background: firstColor(source.loginBackgroundColor, source.backgroundColor, NEUTRAL_LOGIN_CONFIG.backgroundColor),
    headerText: firstColor(source.headerTextColor, NEUTRAL_LOGIN_CONFIG.headerTextColor),
    bodyText: firstColor(source.bodyTextColor, source.textColor, NEUTRAL_LOGIN_CONFIG.bodyTextColor),
    fontFamily: firstColor(source.fontFamily, NEUTRAL_LOGIN_CONFIG.fontFamily),
    headingFontFamily: firstColor(source.headingFontFamily, source.fontFamily, NEUTRAL_LOGIN_CONFIG.headingFontFamily),
  };
}

export function mergeVenueLoginBranding(partial?: Partial<Config> | null): Config {
  return {
    ...NEUTRAL_LOGIN_CONFIG,
    ...(partial || {}),
    venueName: String(partial?.venueName || NEUTRAL_LOGIN_CONFIG.venueName),
    tagline: String(partial?.tagline || ''),
    primaryColor: firstColor(partial?.primaryColor, NEUTRAL_LOGIN_CONFIG.primaryColor),
    primaryDark: firstColor(partial?.primaryDark, NEUTRAL_LOGIN_CONFIG.primaryDark),
    primaryLight: firstColor(partial?.primaryLight, NEUTRAL_LOGIN_CONFIG.primaryLight),
    accentColor: firstColor(partial?.accentColor, NEUTRAL_LOGIN_CONFIG.accentColor),
    backgroundColor: firstColor(partial?.backgroundColor, NEUTRAL_LOGIN_CONFIG.backgroundColor),
    headerTextColor: firstColor(partial?.headerTextColor, NEUTRAL_LOGIN_CONFIG.headerTextColor),
    bodyTextColor: firstColor(partial?.bodyTextColor, NEUTRAL_LOGIN_CONFIG.bodyTextColor),
    accentTextColor: firstColor(partial?.accentTextColor, NEUTRAL_LOGIN_CONFIG.accentTextColor),
  };
}

export function mergePlatformLoginBranding(partial?: Partial<Config> | null): Config {
  return {
    ...DEFAULT_PLATFORM_LOGIN_CONFIG,
    ...(partial || {}),
    venueName: String(partial?.venueName || DEFAULT_PLATFORM_LOGIN_CONFIG.venueName),
    tagline: String(partial?.tagline || DEFAULT_PLATFORM_LOGIN_CONFIG.tagline),
    primaryColor: firstColor(partial?.primaryColor, DEFAULT_PLATFORM_LOGIN_CONFIG.primaryColor),
    primaryDark: firstColor(partial?.primaryDark, DEFAULT_PLATFORM_LOGIN_CONFIG.primaryDark),
    primaryLight: firstColor(partial?.primaryLight, DEFAULT_PLATFORM_LOGIN_CONFIG.primaryLight),
    accentColor: firstColor(partial?.accentColor, DEFAULT_PLATFORM_LOGIN_CONFIG.accentColor),
    backgroundColor: firstColor(partial?.backgroundColor, DEFAULT_PLATFORM_LOGIN_CONFIG.backgroundColor),
    headerTextColor: firstColor(partial?.headerTextColor, DEFAULT_PLATFORM_LOGIN_CONFIG.headerTextColor),
    bodyTextColor: firstColor(partial?.bodyTextColor, DEFAULT_PLATFORM_LOGIN_CONFIG.bodyTextColor),
    accentTextColor: firstColor(partial?.accentTextColor, DEFAULT_PLATFORM_LOGIN_CONFIG.accentTextColor),
    venueAdminInviteSubject: String(partial?.venueAdminInviteSubject || ''),
    venueAdminInviteBody: String(partial?.venueAdminInviteBody || ''),
  };
}

export function applyLoginBranding(config?: Partial<Config> | null): void {
  const merged = mergeVenueLoginBranding(config);
  applyRootStyles(merged);
  applyDocumentBranding({
    name: config?.venueName || merged.venueName,
    logoUrl: config?.logoUrl || merged.logoUrl,
    primaryColor: config?.primaryColor || merged.primaryColor,
  });
}

export function loginBackgroundStyle(config?: Partial<Config> | null): CSSProperties {
  const chrome = resolveLoginChrome(config);
  const source = config || {};
  const primary = firstColor(source.loginBackgroundColor, source.backgroundColor, chrome.background);
  const secondary = firstColor(source.loginBackgroundSecondaryColor, source.primaryLight, chrome.primaryLight);
  const type = source.loginBackgroundType || 'gradient';
  const pattern = source.loginBackgroundPattern || 'dots';
  let backgroundImage = `linear-gradient(135deg, ${primary}, ${secondary})`;

  if (type === 'solid') backgroundImage = 'none';
  if (type === 'pattern') {
    const patterns: Record<string, string> = {
      dots: `radial-gradient(circle at 1px 1px, ${chrome.primary}22 1px, transparent 0)`,
      grid: `linear-gradient(${chrome.primary}12 1px, transparent 1px), linear-gradient(90deg, ${chrome.primary}12 1px, transparent 1px)`,
      diagonal: `repeating-linear-gradient(135deg, ${chrome.primary}12 0, ${chrome.primary}12 1px, transparent 1px, transparent 12px)`,
      confetti: `radial-gradient(circle at 20% 20%, ${chrome.accent}55 0 2px, transparent 3px), radial-gradient(circle at 80% 35%, ${chrome.primary}33 0 2px, transparent 3px), radial-gradient(circle at 35% 78%, ${chrome.primaryLight}55 0 2px, transparent 3px)`,
    };
    backgroundImage = `${patterns[pattern] || patterns.dots}, linear-gradient(135deg, ${primary}, ${secondary})`;
  }
  if (type === 'animated') {
    backgroundImage = `linear-gradient(120deg, ${primary}, ${secondary}, ${chrome.primaryLight}, ${primary})`;
  }

  return {
    backgroundColor: primary,
    backgroundImage,
    backgroundSize: type === 'pattern' ? (pattern === 'grid' ? '24px 24px, 24px 24px, cover' : '24px 24px, cover') : '300% 300%',
  };
}

export function loginBackgroundAnimationClass(config?: Partial<Config> | null): string {
  if (config?.loginBackgroundType !== 'animated') return '';
  return `spm-login-animation-${config.loginBackgroundAnimation || 'drift'}`;
}
