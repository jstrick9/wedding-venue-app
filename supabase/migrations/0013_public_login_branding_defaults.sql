-- Wedding Venue Intelligence Platform — Review #184
-- Public venue login branding: new tenants without saved branding fall back to
-- charcoal / white / gray instead of the Seven Paths Manor plum product theme.
-- Saved venue branding is unchanged. Also expose login-background fields.

create or replace function public.get_public_venue_branding(
  p_slug text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  venue_row public.organizations%rowtype;
  config_payload jsonb;
begin
  if p_slug is null or length(trim(p_slug)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_slug');
  end if;

  select * into venue_row
  from public.organizations o
  where lower(o.slug) = lower(trim(p_slug))
  limit 1;
  if not found then return jsonb_build_object('ok', false, 'error', 'venue_not_found'); end if;

  select d.payload into config_payload
  from public.org_data d
  where d.organization_id = venue_row.id and d.domain = 'config'
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'organization_id', venue_row.id,
    'slug', venue_row.slug,
    'status', coalesce(venue_row.status, 'active'),
    'venue_name', coalesce(nullif(config_payload->>'venueName', ''), venue_row.name),
    'tagline', coalesce(config_payload->>'tagline', ''),
    'location', coalesce(config_payload->>'location', ''),
    'logo_url', coalesce(config_payload->>'logoUrl', ''),
    'website_url', coalesce(nullif(config_payload->>'websiteUrl', ''), venue_row.website_url, ''),
    'support_email', coalesce(nullif(config_payload->>'supportEmail', ''), venue_row.support_email, ''),
    'phone', coalesce(nullif(config_payload->>'phone', ''), venue_row.phone, ''),
    'primary_color', coalesce(nullif(config_payload->>'primaryColor', ''), '#111827'),
    'primary_dark', coalesce(nullif(config_payload->>'primaryDark', ''), '#030712'),
    'primary_light', coalesce(nullif(config_payload->>'primaryLight', ''), '#374151'),
    'accent_color', coalesce(nullif(config_payload->>'accentColor', ''), '#6B7280'),
    'background_color', coalesce(nullif(config_payload->>'backgroundColor', ''), '#F9FAFB'),
    'text_color', coalesce(nullif(config_payload->>'textColor', ''), '#111827'),
    'header_text_color', coalesce(nullif(config_payload->>'headerTextColor', ''), '#FFFFFF'),
    'body_text_color', coalesce(nullif(config_payload->>'bodyTextColor', ''), '#374151'),
    'accent_text_color', coalesce(nullif(config_payload->>'accentTextColor', ''), '#111827'),
    'font_family', coalesce(nullif(config_payload->>'fontFamily', ''), 'Inter, system-ui, sans-serif'),
    'heading_font_family', coalesce(nullif(config_payload->>'headingFontFamily', ''), 'Inter, system-ui, sans-serif'),
    'login_background_type', coalesce(nullif(config_payload->>'loginBackgroundType', ''), 'gradient'),
    'login_background_color', coalesce(nullif(config_payload->>'loginBackgroundColor', ''), '#F3F4F6'),
    'login_background_secondary_color', coalesce(nullif(config_payload->>'loginBackgroundSecondaryColor', ''), '#E5E7EB'),
    'login_background_pattern', coalesce(nullif(config_payload->>'loginBackgroundPattern', ''), 'dots'),
    'login_background_animation', coalesce(nullif(config_payload->>'loginBackgroundAnimation', ''), 'none'),
    'login_background_overlay_opacity', coalesce((config_payload->>'loginBackgroundOverlayOpacity')::numeric, 0),
    'login_welcome_message', coalesce(config_payload->>'loginWelcomeMessage', '')
  );
end;
$$;

comment on function public.get_public_venue_branding(text) is
  'Safe public venue branding by slug. Missing colors default to a neutral charcoal/white/gray login palette, not the Seven Paths product theme.';

grant execute on function public.get_public_venue_branding(text) to anon, authenticated;
