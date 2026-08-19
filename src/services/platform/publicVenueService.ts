import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';
import type { Config } from '../../types';
import { defaultConfig } from '../../config';

export interface PublicVenueBranding {
  organizationId: string;
  slug: string;
  config: Config;
}

export async function getPublicVenueBranding(slug: string): Promise<PublicVenueBranding | null> {
  if (!isSupabaseConfigured() || !slug.trim()) return null;
  const { data, error } = await getSupabaseClient().rpc('get_public_venue_branding', {
    p_slug: slug.trim(),
  });
  if (error || !data?.ok) return null;

  const config: Config = {
    ...defaultConfig,
    venueName: String(data.venue_name || defaultConfig.venueName),
    tagline: String(data.tagline || defaultConfig.tagline),
    location: String(data.location || ''),
    logoUrl: String(data.logo_url || ''),
    websiteUrl: String(data.website_url || ''),
    supportEmail: String(data.support_email || ''),
    phone: String(data.phone || ''),
    primaryColor: String(data.primary_color || defaultConfig.primaryColor),
    primaryDark: String(data.primary_dark || defaultConfig.primaryDark),
    primaryLight: String(data.primary_light || defaultConfig.primaryLight),
    accentColor: String(data.accent_color || defaultConfig.accentColor),
    backgroundColor: String(data.background_color || defaultConfig.backgroundColor),
    textColor: String(data.text_color || defaultConfig.textColor),
    headerTextColor: String(data.header_text_color || defaultConfig.headerTextColor),
    bodyTextColor: String(data.body_text_color || defaultConfig.bodyTextColor),
    accentTextColor: String(data.accent_text_color || defaultConfig.accentTextColor),
    fontFamily: String(data.font_family || defaultConfig.fontFamily),
    headingFontFamily: String(data.heading_font_family || defaultConfig.headingFontFamily),
  };

  return {
    organizationId: String(data.organization_id),
    slug: String(data.slug || slug),
    config,
  };
}
