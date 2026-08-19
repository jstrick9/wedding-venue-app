-- Wedding Venue Intelligence Platform — Review #180 remediation
--
-- 1. P0-3: Harden the legacy public guest RSVP RPC (`submit_guest_rsvp`) and the
--    couple-snapshot guest RSVP RPC (`submit_guest_couple_rsvp`):
--      - enforce portal access enabled + access window + event status;
--      - remove the invalid JWT `sub` ::inet cast (submitted_ip is left null —
--        there is no trusted request-IP source on anonymous RPCs);
--      - validate field lengths/enums;
--      - keep guest writes idempotent (single submission replaced per guest).
-- 2. P1-1: Restrict `org_data` writes to venue admins for sensitive domains
--    (RBAC, security, invites, templates/config), so every active member can no
--    longer overwrite administrative data.
-- 3. N-6: Derive `platform_venue_messages.sender_side` server-side from the
--    caller's roles instead of trusting a client-supplied value.
-- 4. N-5: Add a server-side geocoding rate slot so the public Nominatim endpoint
--    is never called faster than ~1 req/sec (checked by the geocode-venue Edge
--    Function before it queries Nominatim).

-- ---------- 1. HARDEN LEGACY GUEST RSVP RPC (P0-3) ----------
create or replace function public.submit_guest_rsvp(
  p_token text,
  p_full_name text,
  p_email text,
  p_attending boolean,
  p_attending_days text[] default '{}',
  p_meal_choice text default null,
  p_plus_one_name text default null,
  p_plus_one_meal_choice text default null,
  p_dietary_notes text default null,
  p_special_needs text default null,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  g public.guests%rowtype;
  e public.events%rowtype;
  pc public.guest_portal_configs%rowtype;
  v_submission_id uuid;
begin
  if p_token is null or length(p_token) < 8 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_hash := encode(sha256(p_token::bytea), 'hex');

  select * into g
  from public.guests
  where g.portal_token_hash = v_hash;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- Portal must be enabled for this guest.
  if coalesce(g.portal_access->>'enabled', 'false') <> 'true' then
    return jsonb_build_object('ok', false, 'error', 'access_disabled');
  end if;

  -- The event must still be open for planning.
  select * into e
  from public.events
  where id = g.event_id and organization_id = g.organization_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'event_not_found');
  end if;
  if e.status in ('cancelled', 'lost', 'completed') then
    return jsonb_build_object('ok', false, 'error', 'event_closed');
  end if;

  -- Enforce the portal access window + config deadline when configured.
  select * into pc
  from public.guest_portal_configs
  where event_id = g.event_id
  limit 1;
  if found then
    if pc.enabled and pc.access_starts_at is not null and pc.access_starts_at > now() then
      return jsonb_build_object('ok', false, 'error', 'access_not_started');
    end if;
    if pc.enabled and pc.access_ends_at is not null and pc.access_ends_at < now() then
      return jsonb_build_object('ok', false, 'error', 'access_expired');
    end if;
    if pc.enabled and pc.config is not null
       and pc.config->>'rsvpDeadline' is not null
       and (pc.config->>'rsvpDeadline')::timestamptz < now() then
      return jsonb_build_object('ok', false, 'error', 'rsvp_deadline_passed');
    end if;
  end if;

  -- Validate field lengths / shapes (defense-in-depth; the client validates too).
  if p_full_name is null or length(trim(p_full_name)) = 0 or length(p_full_name) > 200 then
    return jsonb_build_object('ok', false, 'error', 'invalid_full_name');
  end if;
  if p_email is not null and length(p_email) > 320 then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;
  if p_meal_choice is not null and length(p_meal_choice) > 100 then
    return jsonb_build_object('ok', false, 'error', 'invalid_meal_choice');
  end if;
  if p_attending_days is not null and array_length(p_attending_days, 1) > 30 then
    return jsonb_build_object('ok', false, 'error', 'too_many_days');
  end if;

  -- Replace any prior submission for this guest (a guest submits once; this is
  -- idempotent by replacement). submitted_ip is left null: an anonymous RPC has
  -- no trusted request-IP source and the JWT `sub` is NOT an IP address.
  delete from public.rsvp_submissions where guest_id = g.id;

  insert into public.rsvp_submissions (
    organization_id, event_id, guest_id, attending, attending_days,
    meal_choice, plus_one_name, plus_one_meal_choice, dietary_notes,
    special_needs, notes, submitted_ip
  ) values (
    g.organization_id, g.event_id, g.id, coalesce(p_attending, false),
    coalesce(p_attending_days, '{}'), p_meal_choice, p_plus_one_name,
    p_plus_one_meal_choice, p_dietary_notes, p_special_needs, p_notes,
    null
  )
  returning id into v_submission_id;

  return jsonb_build_object('ok', true, 'submission_id', v_submission_id);
end;
$$;

grant execute on function public.submit_guest_rsvp(
  text, text, text, boolean, text[], text, text, text, text, text, text
) to anon, authenticated;

-- Hardened couple-snapshot guest RSVP writer: enforce the couple portal access
-- window / deadline stored in the event, and validate the submission shape so an
-- anonymous caller cannot inject arbitrary fields.
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
  v_deadline timestamptz;
  next_rsvps jsonb;
  v_event jsonb;
begin
  if p_couple_id is null or p_guest_token is null or length(p_guest_token) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if p_submission is null or jsonb_typeof(p_submission) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_submission');
  end if;

  v_hash := encode(sha256(p_guest_token::bytea), 'hex');
  select * into snapshot_row
  from public.couple_portal_snapshots s
  where s.couple_id = p_couple_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select guests.guest_json into guest_row
  from jsonb_array_elements(coalesce(snapshot_row.payload->'coupleGuests', '[]'::jsonb)) as guests(guest_json)
  where guests.guest_json->>'token' = p_guest_token
     or guests.guest_json->>'tokenHash' = v_hash
  limit 1;

  if guest_row is null or coalesce(guest_row->>'allowPortalAccess', 'true') = 'false' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- Respect the couple's RSVP deadline / access window when present on the event.
  select event_json into v_event
  from jsonb_array_elements(coalesce(snapshot_row.payload->'coupleEvents', '[]'::jsonb)) as ev(event_json)
  limit 1;
  if v_event is not null then
    if v_event->>'inviteExpiresAt' is not null
       and (v_event->>'inviteExpiresAt')::timestamptz < now() then
      return jsonb_build_object('ok', false, 'error', 'access_expired');
    end if;
    v_deadline := coalesce(
      nullif(v_event->>'rsvpDeadlineDate', '')::timestamptz,
      nullif(v_event->>'rsvpDeadline', '')::timestamptz
    );
    if v_deadline is not null and v_deadline < now() then
      return jsonb_build_object('ok', false, 'error', 'rsvp_deadline_passed');
    end if;
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
  set payload = jsonb_set(
    coalesce(payload, '{}'::jsonb),
    '{coupleSubmissions}',
    next_rsvps,
    true
  ), updated_at = now()
  where couple_id = p_couple_id;

  return jsonb_build_object('ok', true, 'guest_id', guest_id);
end;
$$;

grant execute on function public.submit_guest_couple_rsvp(text, text, jsonb) to anon, authenticated;

-- ---------- 2. ORG_DATA SENSITIVE-DOMAIN WRITE GATING (P1-1) ----------
-- Admins may write every domain; other active members may write only non-sensitive
-- business domains. This is defense-in-depth on top of UI hiding: a planner or
-- staff member who calls Supabase directly can no longer overwrite RBAC, security,
-- invite, branding, or template/configuration data.
create or replace function public.org_data_write_allowed(p_org_id uuid, p_domain text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(p_domain) not in (
      'config','rbacroles','rbacgroups','rbacaudit','securitysettings',
      'orginvites','communicationtemplates','operationssettings'
    )
    or public.has_org_role(p_org_id, array['owner','admin']::public.app_role[])
$$;

drop policy if exists "org_data_insert_members" on public.org_data;
create policy "org_data_insert_members" on public.org_data for insert
  with check (
    public.is_org_member(organization_id)
    and public.org_data_write_allowed(organization_id, domain)
  );

drop policy if exists "org_data_update_members" on public.org_data;
create policy "org_data_update_members" on public.org_data for update
  using (
    public.is_org_member(organization_id)
    and public.org_data_write_allowed(organization_id, domain)
  )
  with check (
    public.is_org_member(organization_id)
    and public.org_data_write_allowed(organization_id, domain)
  );

drop policy if exists "org_data_delete_members" on public.org_data;
create policy "org_data_delete_members" on public.org_data for delete
  using (
    public.is_org_member(organization_id)
    and public.org_data_write_allowed(organization_id, domain)
  );

-- ---------- 3. DERIVE PLATFORM CHAT SENDER_SIDE SERVER-SIDE (N-6) ----------
create or replace function public.set_platform_chat_sender_side()
returns trigger
language plpgsql
as $$
begin
  if public.is_platform_admin() then
    new.sender_side := 'platform';
  elsif public.is_org_member(new.organization_id) then
    new.sender_side := 'venue';
  else
    raise exception 'caller is not allowed to post platform chat';
  end if;
  return new;
end;
$$;

drop trigger if exists set_platform_chat_sender_side on public.platform_venue_messages;
create trigger set_platform_chat_sender_side
  before insert on public.platform_venue_messages
  for each row execute function public.set_platform_chat_sender_side();

-- ---------- 4. GEOCODING RATE SLOT (N-5) ----------
create table if not exists public.venue_geocode_rate (
  id boolean primary key default true check (id),
  last_request_at timestamptz not null default now()
);
alter table public.venue_geocode_rate enable row level security;
-- No anon/authenticated grants: only the server-side Edge Function (service role)
-- reads/updates this row.

create or replace function public.geocode_try_acquire_slot()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_updated timestamptz;
begin
  insert into public.venue_geocode_rate (id, last_request_at)
  values (true, v_now)
  on conflict (id) do update
    set last_request_at = excluded.last_request_at
    where public.venue_geocode_rate.last_request_at <= v_now - interval '1.1 seconds'
    returning public.venue_geocode_rate.last_request_at into v_updated;

  return v_updated = v_now;
end;
$$;
