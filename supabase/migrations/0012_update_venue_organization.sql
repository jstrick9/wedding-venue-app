-- Wedding Venue Intelligence Platform — Review #183
-- Platform console: allow platform administrators to edit venue identity,
-- location, contact, and lifecycle status after a tenant already exists.
-- Slug remains immutable (existing prevent_organization_slug_change trigger).

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

  -- Slug is intentionally omitted from this UPDATE. The prevent_organization_slug_change
  -- trigger is a second line of defense if a future edit reintroduces it.
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
      when p_latitude is not null and p_longitude is not null then 'nominatim'
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
) is 'Platform-admin update of venue identity, contact, location, and lifecycle status. Never changes the immutable slug.';

grant execute on function public.update_venue_organization(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, numeric, numeric, text
) to authenticated;
