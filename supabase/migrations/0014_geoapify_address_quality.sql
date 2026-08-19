-- Wedding Venue Intelligence Platform — Review #185
-- Replace Nominatim geocoding with Geoapify and record geoapify as the
-- provider on create/update. Contact syntax stays enforced in the app/service
-- layer so existing free-form rows are not rejected by a new CHECK.

create or replace function public.create_venue_organization_v2(
  p_name text,
  p_admin_email text,
  p_admin_token text,
  p_expires_at timestamptz,
  p_address_line1 text,
  p_address_line2 text,
  p_city text,
  p_state_region text,
  p_postal_code text,
  p_country text,
  p_primary_contact_name text,
  p_primary_contact_phone text,
  p_primary_contact_email text,
  p_latitude numeric,
  p_longitude numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_base_slug text;
  v_slug text;
  v_suffix integer := 1;
  v_email text;
  v_contact_email text;
  v_token_hash text;
  v_expiry timestamptz;
begin
  if not public.is_platform_admin() then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if p_name is null or length(trim(p_name)) < 2 then return jsonb_build_object('ok', false, 'error', 'invalid_venue_name'); end if;
  if p_address_line1 is null or length(trim(p_address_line1)) < 3 then return jsonb_build_object('ok', false, 'error', 'address_required'); end if;
  if p_city is null or length(trim(p_city)) < 2 then return jsonb_build_object('ok', false, 'error', 'city_required'); end if;
  if p_state_region is null or length(trim(p_state_region)) < 2 then return jsonb_build_object('ok', false, 'error', 'state_required'); end if;
  if p_postal_code is null or length(trim(p_postal_code)) < 3 then return jsonb_build_object('ok', false, 'error', 'postal_code_required'); end if;
  if p_primary_contact_name is null or length(trim(p_primary_contact_name)) < 2 then return jsonb_build_object('ok', false, 'error', 'contact_name_required'); end if;
  if p_primary_contact_phone is null or length(trim(p_primary_contact_phone)) < 7 then return jsonb_build_object('ok', false, 'error', 'contact_phone_required'); end if;

  v_email := lower(trim(coalesce(p_admin_email, '')));
  v_contact_email := lower(trim(coalesce(p_primary_contact_email, p_admin_email, '')));
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or v_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;
  if p_admin_token is null or length(p_admin_token) < 16 then return jsonb_build_object('ok', false, 'error', 'invalid_admin_token'); end if;

  v_base_slug := regexp_replace(regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g');
  v_base_slug := left(coalesce(nullif(v_base_slug, ''), 'venue'), 64);
  v_slug := v_base_slug;
  while exists (select 1 from public.organizations o where o.slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := left(v_base_slug, 64 - length(v_suffix::text) - 1) || '-' || v_suffix::text;
  end loop;

  v_token_hash := encode(sha256(p_admin_token::bytea), 'hex');
  v_expiry := coalesce(p_expires_at, now() + interval '7 days');

  insert into public.organizations (
    name, slug, owner_id, status, address_line1, address_line2, city,
    state_region, postal_code, country, primary_contact_name,
    primary_contact_phone, primary_contact_email, latitude, longitude,
    geocoded_at, geocode_provider
  ) values (
    trim(p_name), v_slug, null, 'provisioning', trim(p_address_line1), nullif(trim(p_address_line2), ''), trim(p_city),
    trim(p_state_region), trim(p_postal_code), coalesce(nullif(trim(p_country), ''), 'US'), trim(p_primary_contact_name),
    trim(p_primary_contact_phone), v_contact_email, p_latitude, p_longitude,
    case when p_latitude is not null and p_longitude is not null then now() else null end,
    case when p_latitude is not null and p_longitude is not null then 'geoapify' else null end
  ) returning id into v_org_id;

  insert into public.venue_admin_invites (organization_id, email, role, token_hash, status, expires_at, created_by, last_sent_at)
  values (v_org_id, v_email, 'owner', v_token_hash, 'pending', v_expiry, auth.uid(), now());

  insert into public.platform_audit_logs (platform_user_id, organization_id, action, target_type, target_id, metadata)
  values (auth.uid(), v_org_id, 'venue_created', 'organization', v_org_id::text,
    jsonb_build_object('name', trim(p_name), 'slug', v_slug, 'city', trim(p_city), 'state_region', trim(p_state_region)));

  return jsonb_build_object('ok', true, 'organization_id', v_org_id, 'organization_name', trim(p_name), 'organization_slug', v_slug, 'expires_at', v_expiry);
end;
$$;

grant execute on function public.create_venue_organization_v2(text, text, text, timestamptz, text, text, text, text, text, text, text, text, text, numeric, numeric) to authenticated;

create or replace function public.update_venue_organization(
  p_organization_id uuid,
  p_name text,
  p_status text,
  p_address_line1 text,
  p_address_line2 text default '',
  p_city text default '',
  p_state_region text default '',
  p_postal_code text default '',
  p_country text default 'US',
  p_primary_contact_name text default '',
  p_primary_contact_phone text default '',
  p_primary_contact_email text default '',
  p_support_email text default '',
  p_phone text default '',
  p_website_url text default '',
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_suspension_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_status text;
  v_previous public.organizations%rowtype;
  v_contact_email text;
  v_support_email text;
  v_coords_changed boolean;
begin
  if not public.is_platform_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_organization_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_organization');
  end if;

  select * into v_previous
  from public.organizations o
  where o.id = p_organization_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'venue_not_found');
  end if;

  v_name := trim(coalesce(p_name, ''));
  if length(v_name) < 2 then
    return jsonb_build_object('ok', false, 'error', 'invalid_venue_name');
  end if;

  v_status := lower(trim(coalesce(p_status, v_previous.status, 'active')));
  if v_status not in ('provisioning', 'active', 'suspended', 'archived') then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;

  if p_address_line1 is null or length(trim(p_address_line1)) < 3 then
    return jsonb_build_object('ok', false, 'error', 'address_required');
  end if;
  if p_city is null or length(trim(p_city)) < 2 then
    return jsonb_build_object('ok', false, 'error', 'city_required');
  end if;
  if p_state_region is null or length(trim(p_state_region)) < 2 then
    return jsonb_build_object('ok', false, 'error', 'region_required');
  end if;
  if p_postal_code is null or length(trim(p_postal_code)) < 3 then
    return jsonb_build_object('ok', false, 'error', 'postal_code_required');
  end if;
  if p_primary_contact_name is null or length(trim(p_primary_contact_name)) < 2 then
    return jsonb_build_object('ok', false, 'error', 'contact_name_required');
  end if;
  if p_primary_contact_phone is null or length(trim(p_primary_contact_phone)) < 7 then
    return jsonb_build_object('ok', false, 'error', 'contact_phone_required');
  end if;

  v_contact_email := lower(trim(coalesce(p_primary_contact_email, '')));
  if v_contact_email = '' or v_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_contact_email');
  end if;

  v_support_email := lower(trim(coalesce(p_support_email, '')));
  if v_support_email <> '' and v_support_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_support_email');
  end if;

  v_coords_changed := (p_latitude is distinct from v_previous.latitude)
    or (p_longitude is distinct from v_previous.longitude);

  update public.organizations
  set
    name = v_name,
    status = v_status,
    address_line1 = trim(p_address_line1),
    address_line2 = nullif(trim(coalesce(p_address_line2, '')), ''),
    city = trim(p_city),
    state_region = trim(p_state_region),
    postal_code = trim(p_postal_code),
    country = coalesce(nullif(trim(coalesce(p_country, '')), ''), 'US'),
    primary_contact_name = trim(p_primary_contact_name),
    primary_contact_phone = trim(p_primary_contact_phone),
    primary_contact_email = v_contact_email,
    support_email = nullif(v_support_email, ''),
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    website_url = nullif(trim(coalesce(p_website_url, '')), ''),
    latitude = p_latitude,
    longitude = p_longitude,
    geocoded_at = case
      when not v_coords_changed then v_previous.geocoded_at
      when p_latitude is not null and p_longitude is not null then now()
      else null
    end,
    geocode_provider = case
      when not v_coords_changed then v_previous.geocode_provider
      when p_latitude is not null and p_longitude is not null then 'geoapify'
      else null
    end,
    suspended_at = case when v_status in ('suspended', 'archived') then coalesce(v_previous.suspended_at, now()) else null end,
    suspended_by = case when v_status in ('suspended', 'archived') then coalesce(v_previous.suspended_by, auth.uid()) else null end,
    suspension_reason = case
      when v_status in ('suspended', 'archived') then nullif(trim(coalesce(p_suspension_reason, v_previous.suspension_reason, '')), '')
      else null
    end,
    updated_at = now()
  where id = p_organization_id;

  if v_status in ('suspended', 'archived') then
    update public.venue_admin_invites
    set status = 'revoked', revoked_at = now(), revoked_by = auth.uid()
    where organization_id = p_organization_id and status = 'pending';
  end if;

  insert into public.platform_audit_logs (
    platform_user_id, organization_id, action, target_type, target_id, reason, metadata
  ) values (
    auth.uid(),
    p_organization_id,
    'venue_updated',
    'organization',
    p_organization_id::text,
    nullif(trim(coalesce(p_suspension_reason, '')), ''),
    jsonb_build_object(
      'previous_status', v_previous.status,
      'status', v_status,
      'name', v_name,
      'slug', v_previous.slug
    )
  );

  return jsonb_build_object(
    'ok', true,
    'organization_id', p_organization_id,
    'organization_name', v_name,
    'organization_slug', v_previous.slug,
    'status', v_status
  );
end;
$$;

comment on function public.update_venue_organization(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, numeric, numeric, text
) is 'Platform-admin update of venue identity, contact, location, and lifecycle status. Never changes the immutable slug. New coordinates are tagged geocode_provider=geoapify.';

grant execute on function public.update_venue_organization(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, numeric, numeric, text
) to authenticated;

comment on column public.venue_geocode_cache.provider is 'Geocoding provider that produced the cached coordinates. New rows use geoapify.';
