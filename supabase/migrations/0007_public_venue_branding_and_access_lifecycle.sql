-- Wedding Venue Intelligence Platform — public venue branding and portal access lifecycle
--
-- Public venue login pages need only safe branding metadata. They must not read
-- organization rows or org_data directly. This migration adds a security-definer
-- lookup that resolves a venue slug to a deliberately limited branding payload.

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

  if not found then
    return jsonb_build_object('ok', false, 'error', 'venue_not_found');
  end if;

  select d.payload into config_payload
  from public.org_data d
  where d.organization_id = venue_row.id
    and d.domain = 'config'
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'organization_id', venue_row.id,
    'slug', venue_row.slug,
    'venue_name', coalesce(nullif(config_payload->>'venueName', ''), venue_row.name),
    'tagline', coalesce(nullif(config_payload->>'tagline', ''), 'Wedding Venue Intelligence Platform'),
    'location', coalesce(config_payload->>'location', ''),
    'logo_url', coalesce(config_payload->>'logoUrl', ''),
    'website_url', coalesce(nullif(config_payload->>'websiteUrl', ''), venue_row.website_url, ''),
    'support_email', coalesce(nullif(config_payload->>'supportEmail', ''), venue_row.support_email, ''),
    'phone', coalesce(nullif(config_payload->>'phone', ''), venue_row.phone, ''),
    'primary_color', coalesce(nullif(config_payload->>'primaryColor', ''), '#4A1942'),
    'primary_dark', coalesce(nullif(config_payload->>'primaryDark', ''), '#3d1a45'),
    'primary_light', coalesce(nullif(config_payload->>'primaryLight', ''), '#6b2c5c'),
    'accent_color', coalesce(nullif(config_payload->>'accentColor', ''), '#8B5A8B'),
    'background_color', coalesce(nullif(config_payload->>'backgroundColor', ''), '#f3f4f6'),
    'text_color', coalesce(nullif(config_payload->>'textColor', ''), '#1f2937'),
    'header_text_color', coalesce(nullif(config_payload->>'headerTextColor', ''), '#FFFFFF'),
    'body_text_color', coalesce(nullif(config_payload->>'bodyTextColor', ''), '#374151'),
    'accent_text_color', coalesce(nullif(config_payload->>'accentTextColor', ''), '#4A1942'),
    'font_family', coalesce(nullif(config_payload->>'fontFamily', ''), 'Inter, system-ui, sans-serif'),
    'heading_font_family', coalesce(nullif(config_payload->>'headingFontFamily', ''), 'Inter, system-ui, sans-serif')
  );
end;
$$;

grant execute on function public.get_public_venue_branding(text) to anon, authenticated;

-- ---------- TOKEN LIFECYCLE HELPERS ----------
-- Public portal access closes at the end of the day after the event's final day.
-- Explicit inviteExpiresAt/tokenExpiresAt values take precedence. The fallback
-- timezone is the current venue default; future venue records can carry a
-- timezone field when multi-region operation is enabled.
create or replace function public.snapshot_token_expires_at(
  p_payload jsonb,
  p_token text default null
) returns timestamptz
language plpgsql
stable
as $$
declare
  v_expiry text;
  v_end_date date;
  collaborator jsonb;
  event_row jsonb;
begin
  event_row := coalesce(p_payload->'coupleEvents'->0, '{}'::jsonb);

  if p_token is not null then
    select c.value->>'inviteExpiresAt'
    into v_expiry
    from jsonb_array_elements(coalesce(event_row->'collaborators', '[]'::jsonb)) as c(value)
    where c.value->>'inviteToken' = p_token
    limit 1;
  end if;

  v_expiry := coalesce(v_expiry, event_row->>'inviteExpiresAt');
  if v_expiry is not null and length(trim(v_expiry)) > 0 then
    begin
      return v_expiry::timestamptz;
    exception when others then
      return null;
    end;
  end if;

  begin
    v_end_date := coalesce(
      nullif(event_row->>'eventEndDate', '')::date,
      nullif(event_row->>'eventDate', '')::date
    );
  exception when others then
    return null;
  end;

  if v_end_date is null then return null; end if;
  return ((v_end_date + 2)::timestamp at time zone 'America/New_York');
end;
$$;

create or replace function public.snapshot_guest_token_expires_at(
  p_payload jsonb,
  p_guest_token text
) returns timestamptz
language plpgsql
stable
as $$
declare
  v_expiry text;
  guest_row jsonb;
begin
  select g.value
  into guest_row
  from jsonb_array_elements(coalesce(p_payload->'coupleGuests', '[]'::jsonb)) as g(value)
  where g.value->>'token' = p_guest_token
     or g.value->>'tokenHash' = encode(sha256(p_guest_token::bytea), 'hex')
  limit 1;

  if guest_row is null then return null; end if;
  v_expiry := guest_row->>'tokenExpiresAt';
  if v_expiry is not null and length(trim(v_expiry)) > 0 then
    begin
      return v_expiry::timestamptz;
    exception when others then
      return null;
    end;
  end if;
  return public.snapshot_token_expires_at(p_payload, null);
end;
$$;

-- ---------- ENFORCE EXPIRATION ON COUPLE LINKS ----------
create or replace function public.get_couple_portal_snapshot(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  snapshot_row public.couple_portal_snapshots%rowtype;
  v_expires_at timestamptz;
begin
  if p_token is null or length(p_token) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_hash := encode(sha256(p_token::bytea), 'hex');
  select * into snapshot_row
  from public.couple_portal_snapshots s
  where s.couple_token_hash = v_hash
     or s.collaborator_token_hashes @> jsonb_build_array(v_hash)
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_expires_at := public.snapshot_token_expires_at(snapshot_row.payload, p_token);
  if v_expires_at is not null and v_expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  return jsonb_build_object(
    'ok', true,
    'couple_id', snapshot_row.couple_id,
    'payload', snapshot_row.payload,
    'updated_at', snapshot_row.updated_at
  );
end;
$$;

grant execute on function public.get_couple_portal_snapshot(text) to anon, authenticated;

create or replace function public.save_couple_portal_snapshot(
  p_token text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_couple_id text;
  v_expires_at timestamptz;
begin
  if p_token is null or length(p_token) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_hash := encode(sha256(p_token::bytea), 'hex');
  select s.couple_id into v_couple_id
  from public.couple_portal_snapshots s
  where s.couple_token_hash = v_hash
     or s.collaborator_token_hashes @> jsonb_build_array(v_hash)
  limit 1;

  if v_couple_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select public.snapshot_token_expires_at(s.payload, p_token)
  into v_expires_at
  from public.couple_portal_snapshots s
  where s.couple_id = v_couple_id;

  if v_expires_at is not null and v_expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  update public.couple_portal_snapshots
  set payload = coalesce(p_payload, '{}'::jsonb), updated_at = now()
  where couple_id = v_couple_id;

  return jsonb_build_object('ok', true, 'couple_id', v_couple_id);
end;
$$;

grant execute on function public.save_couple_portal_snapshot(text, jsonb) to anon, authenticated;

-- ---------- ENFORCE EXPIRATION ON GUEST LINKS ----------
create or replace function public.get_guest_couple_portal_snapshot(
  p_couple_id text,
  p_guest_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot_row public.couple_portal_snapshots%rowtype;
  guest_row jsonb;
  guest_id text;
  v_hash text;
  rsvp_row jsonb;
  v_expires_at timestamptz;
begin
  if p_couple_id is null or p_guest_token is null or length(p_guest_token) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_hash := encode(sha256(p_guest_token::bytea), 'hex');
  select * into snapshot_row
  from public.couple_portal_snapshots s
  where s.couple_id = p_couple_id
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_expires_at := public.snapshot_token_expires_at(snapshot_row.payload, null);
  if v_expires_at is not null and v_expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select guests.guest_json into guest_row
  from jsonb_array_elements(coalesce(snapshot_row.payload->'coupleGuests', '[]'::jsonb)) as guests(guest_json)
  where guests.guest_json->>'token' = p_guest_token
     or guests.guest_json->>'tokenHash' = v_hash
  limit 1;

  if guest_row is null or coalesce(guest_row->>'allowPortalAccess', 'true') = 'false' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_expires_at := public.snapshot_guest_token_expires_at(snapshot_row.payload, p_guest_token);
  if v_expires_at is not null and v_expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  guest_id := guest_row->>'id';
  select rsvps.rsvp_json into rsvp_row
  from jsonb_array_elements(coalesce(snapshot_row.payload->'coupleSubmissions', '[]'::jsonb)) as rsvps(rsvp_json)
  where rsvps.rsvp_json->>'guestId' = guest_id
  order by rsvps.rsvp_json->>'submittedAt' desc
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'couple_id', snapshot_row.couple_id,
    'updated_at', snapshot_row.updated_at,
    'event', snapshot_row.payload->'coupleEvents',
    'venues', snapshot_row.payload->'venues',
    'table_specs', snapshot_row.payload->'tableSpecs',
    'fixture_types', snapshot_row.payload->'fixtureTypes',
    'portal_config', snapshot_row.payload->'couplePortalConfigs',
    'venue_map', snapshot_row.payload->'venueMapConfigs',
    'venue_rules', snapshot_row.payload->'venueRules',
    'venue_weather', snapshot_row.payload->'venueWeather',
    'guest_events', snapshot_row.payload->'coupleGuestEvents',
    'guest', guest_row - 'token',
    'rsvp', coalesce(rsvp_row - 'token', 'null'::jsonb)
  );
end;
$$;

grant execute on function public.get_guest_couple_portal_snapshot(text, text) to anon, authenticated;

create or replace function public.submit_guest_couple_rsvp(
  p_couple_id text,
  p_guest_token text,
  p_submission jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot_row public.couple_portal_snapshots%rowtype;
  guest_row jsonb;
  guest_id text;
  v_hash text;
  next_rsvps jsonb;
  v_expires_at timestamptz;
begin
  if p_couple_id is null or p_guest_token is null or length(p_guest_token) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_hash := encode(sha256(p_guest_token::bytea), 'hex');
  select * into snapshot_row
  from public.couple_portal_snapshots s
  where s.couple_id = p_couple_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_expires_at := public.snapshot_token_expires_at(snapshot_row.payload, null);
  if v_expires_at is not null and v_expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select guests.guest_json into guest_row
  from jsonb_array_elements(coalesce(snapshot_row.payload->'coupleGuests', '[]'::jsonb)) as guests(guest_json)
  where guests.guest_json->>'token' = p_guest_token
     or guests.guest_json->>'tokenHash' = v_hash
  limit 1;

  if guest_row is null or coalesce(guest_row->>'allowPortalAccess', 'true') = 'false' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_expires_at := public.snapshot_guest_token_expires_at(snapshot_row.payload, p_guest_token);
  if v_expires_at is not null and v_expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  guest_id := guest_row->>'id';
  select coalesce(jsonb_agg(rsvps.rsvp_json), '[]'::jsonb) into next_rsvps
  from jsonb_array_elements(coalesce(snapshot_row.payload->'coupleSubmissions', '[]'::jsonb)) as rsvps(rsvp_json)
  where rsvps.rsvp_json->>'guestId' <> guest_id;

  next_rsvps := next_rsvps || jsonb_build_array(
    (coalesce(p_submission, '{}'::jsonb) - 'token')
      || jsonb_build_object(
        'guestId', guest_id,
        'eventKey', p_couple_id,
        'eventName', p_couple_id,
        'submittedAt', now()
      )
  );

  update public.couple_portal_snapshots
  set payload = jsonb_set(coalesce(payload, '{}'::jsonb), '{coupleSubmissions}', next_rsvps, true),
      updated_at = now()
  where couple_id = p_couple_id;

  return jsonb_build_object('ok', true, 'guest_id', guest_id);
end;
$$;

grant execute on function public.submit_guest_couple_rsvp(text, text, jsonb) to anon, authenticated;

-- ---------- VENUE-BOUND PUBLIC RPC WRAPPERS ----------
-- New invite URLs carry the venue slug. These wrappers make the venue binding
-- explicit while retaining the older token-only functions for legacy links.
create or replace function public.get_couple_portal_snapshot_for_venue(
  p_venue_slug text,
  p_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.couple_portal_snapshots s
    join public.organizations o on o.id = s.organization_id
    where lower(o.slug) = lower(trim(coalesce(p_venue_slug, '')))
      and (
        s.couple_token_hash = encode(sha256(p_token::bytea), 'hex')
        or s.collaborator_token_hashes @> jsonb_build_array(encode(sha256(p_token::bytea), 'hex'))
      )
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return public.get_couple_portal_snapshot(p_token);
end;
$$;

grant execute on function public.get_couple_portal_snapshot_for_venue(text, text) to anon, authenticated;

create or replace function public.save_couple_portal_snapshot_for_venue(
  p_venue_slug text,
  p_token text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.couple_portal_snapshots s
    join public.organizations o on o.id = s.organization_id
    where lower(o.slug) = lower(trim(coalesce(p_venue_slug, '')))
      and (
        s.couple_token_hash = encode(sha256(p_token::bytea), 'hex')
        or s.collaborator_token_hashes @> jsonb_build_array(encode(sha256(p_token::bytea), 'hex'))
      )
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return public.save_couple_portal_snapshot(p_token, p_payload);
end;
$$;

grant execute on function public.save_couple_portal_snapshot_for_venue(text, text, jsonb) to anon, authenticated;

create or replace function public.get_guest_couple_portal_snapshot_for_venue(
  p_venue_slug text,
  p_couple_id text,
  p_guest_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.couple_portal_snapshots s
    join public.organizations o on o.id = s.organization_id
    where s.couple_id = p_couple_id
      and lower(o.slug) = lower(trim(coalesce(p_venue_slug, '')))
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return public.get_guest_couple_portal_snapshot(p_couple_id, p_guest_token);
end;
$$;

grant execute on function public.get_guest_couple_portal_snapshot_for_venue(text, text, text) to anon, authenticated;

create or replace function public.submit_guest_couple_rsvp_for_venue(
  p_venue_slug text,
  p_couple_id text,
  p_guest_token text,
  p_submission jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.couple_portal_snapshots s
    join public.organizations o on o.id = s.organization_id
    where s.couple_id = p_couple_id
      and lower(o.slug) = lower(trim(coalesce(p_venue_slug, '')))
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return public.submit_guest_couple_rsvp(p_couple_id, p_guest_token, p_submission);
end;
$$;

grant execute on function public.submit_guest_couple_rsvp_for_venue(text, text, text, jsonb) to anon, authenticated;
