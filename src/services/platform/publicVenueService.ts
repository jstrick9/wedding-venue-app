import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';
import type { Config } from '../../types';
import { mergeVenueLoginBranding } from '../../utils/loginBranding';

export interface PublicVenueBranding {
  organizationId: string;
  slug: string;
  status: 'provisioning' | 'active' | 'suspended' | 'archived';
  config: Config;
}

export async function getPublicVenueBranding(slug: string): Promise<PublicVenueBranding | null> {
  if (!isSupabaseConfigured() || !slug.trim()) return null;
  const { data, error } = await getSupabaseClient().rpc('get_public_venue_branding', {
    p_slug: slug.trim(),
  });
  if (error || !data?.ok) return null;

  const config = mergeVenueLoginBranding({
    venueName: String(data.venue_name || 'Venue'),
    tagline: String(data.tagline || ''),
    location: String(data.location || ''),
    logoUrl: String(data.logo_url || ''),
    websiteUrl: String(data.website_url || ''),
    supportEmail: String(data.support_email || ''),
    phone: String(data.phone || ''),
    primaryColor: String(data.primary_color || ''),
    primaryDark: String(data.primary_dark || ''),
    primaryLight: String(data.primary_light || ''),
    accentColor: String(data.accent_color || ''),
    backgroundColor: String(data.background_color || ''),
    textColor: String(data.text_color || ''),
    headerTextColor: String(data.header_text_color || ''),
    bodyTextColor: String(data.body_text_color || ''),
    accentTextColor: String(data.accent_text_color || ''),
    fontFamily: String(data.font_family || ''),
    headingFontFamily: String(data.heading_font_family || ''),
    loginBackgroundType: (data.login_background_type || undefined) as Config['loginBackgroundType'],
    loginBackgroundColor: data.login_background_color ? String(data.login_background_color) : undefined,
    loginBackgroundSecondaryColor: data.login_background_secondary_color ? String(data.login_background_secondary_color) : undefined,
    loginBackgroundPattern: (data.login_background_pattern || undefined) as Config['loginBackgroundPattern'],
    loginBackgroundAnimation: (data.login_background_animation || undefined) as Config['loginBackgroundAnimation'],
    loginBackgroundOverlayOpacity: data.login_background_overlay_opacity == null ? undefined : Number(data.login_background_overlay_opacity),
    loginWelcomeMessage: data.login_welcome_message ? String(data.login_welcome_message) : undefined,
  });

  return {
    organizationId: String(data.organization_id),
    slug: String(data.slug || slug),
    status: (data.status || 'active') as PublicVenueBranding['status'],
    config,
  };
}
