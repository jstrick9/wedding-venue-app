-- Wedding Venue Intelligence Platform — Review #182
-- P0-2 / N-4 / P1-9: couple workspace → org_data + relational projection
--
-- 1. Add stable source-id columns so local couple/guest/RSVP ids (opaque
--    tokens, not UUIDs) can be upserted into public.events / public.guests /
--    public.rsvp_submissions without colliding with native UUID keys.
-- 2. Add sync_couple_projection(...) so an authenticated venue member can
--    project the current couple workspace in one transaction.
-- 3. Fix get_platform_console_metrics so couple/guest/RSVP counts read either
--    the relational projection or an org_data payload that is a raw JSON array
--    (the entity repository stores arrays, not { coupleEvents: [...] }).

-- ---------- SOURCE-ID COLUMNS ----------
alter table public.events
  add column if not exists source_couple_id text;
alter table public.guests
  add column if not exists source_guest_id text;
alter table public.rsvp_submissions
  add column if not exists source_submission_id text;

create unique index if not exists idx_events_org_source_couple
  on public.events (organization_id, source_couple_id)
  where source_couple_id is not null;

create unique index if not exists idx_guests_org_source_guest
  on public.guests (organization_id, source_guest_id)
  where source_guest_id is not null;

create unique index if not exists idx_rsvp_org_source_submission
  on public.rsvp_submissions (organization_id, source_submission_id)
  where source_submission_id is not null;

-- ---------- ORG_DATA ARRAY LENGTH (handles raw array OR wrapped object) ----------
create or replace function public.org_data_array_len(payload jsonb)
returns integer
language sql
immutable
as $$
  select case
    when payload is null then 0
    when jsonb_typeof(payload) = 'array' then jsonb_array_length(payload)
    when jsonb_typeof(payload) = 'object' then (
      select coalesce((
        select jsonb_array_length(value)
        from jsonb_each(payload)
        where jsonb_typeof(value) = 'array'
        order by jsonb_array_length(value) desc
        limit 1
      ), 0)
    )
    else 0
  end;
$$;

-- ---------- RELATIONAL PROJECTION RPC ----------
create or replace function public.sync_couple_projection(
  p_organization_id uuid,
  p_events jsonb,
  p_guests jsonb,
  p_submissions jsonb,
  p_portal_configs jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_events jsonb := coalesce(p_events, '[]'::jsonb);
  v_guests jsonb := coalesce(p_guests, '[]'::jsonb);
  v_submissions jsonb := coalesce(p_submissions, '[]'::jsonb);
  v_configs jsonb := coalesce(p_portal_configs, '{}'::jsonb);
  v_event jsonb;
  v_guest jsonb;
  v_rsvp jsonb;
  v_config jsonb;
  v_source_couple text;
  v_source_guest text;
  v_source_rsvp text;
  v_event_id uuid;
  v_guest_id uuid;
  v_slug text;
  v_status public.event_status;
  v_rsvp_status text;
  v_token text;
  v_active_couples text[] := '{}';
  v_active_guests text[] := '{}';
  v_active_rsvps text[] := '{}';
  v_event_count integer := 0;
  v_guest_count integer := 0;
  v_rsvp_count integer := 0;
begin
  if p_organization_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_organization');
  end if;

  if not public.has_org_role(
    p_organization_id,
    array['owner','admin','planner','staff']::public.app_role[]
  ) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if jsonb_typeof(v_events) <> 'array' then v_events := '[]'::jsonb; end if;
  if jsonb_typeof(v_guests) <> 'array' then v_guests := '[]'::jsonb; end if;
  if jsonb_typeof(v_submissions) <> 'array' then v_submissions := '[]'::jsonb; end if;
  if jsonb_typeof(v_configs) <> 'object' then v_configs := '{}'::jsonb; end if;

  -- Mirror the arrays into org_data so console metrics have a consistent
  -- fallback even if a later relational write fails mid-loop.
  insert into public.org_data (organization_id, domain, payload)
  values
    (p_organization_id, 'coupleEvents', v_events),
    (p_organization_id, 'coupleGuests', v_guests),
    (p_organization_id, 'coupleSubmissions', v_submissions),
    (p_organization_id, 'couplePortalConfigs', v_configs)
  on conflict (organization_id, domain)
  do update set payload = excluded.payload, updated_at = now();

  for v_event in select value from jsonb_array_elements(v_events)
  loop
    v_source_couple := nullif(v_event->>'sourceCoupleId', '');
    if v_source_couple is null then
      continue;
    end if;
    v_active_couples := array_append(v_active_couples, v_source_couple);
    v_slug := left(coalesce(nullif(v_event->>'slug', ''), 'ce-' || regexp_replace(lower(v_source_couple), '[^a-z0-9]+', '-', 'g')), 64);
    v_status := case v_event->>'status'
      when 'lead' then 'lead'::public.event_status
      when 'hold' then 'hold'::public.event_status
      when 'booked' then 'booked'::public.event_status
      when 'completed' then 'completed'::public.event_status
      when 'cancelled' then 'cancelled'::public.event_status
      when 'lost' then 'lost'::public.event_status
      else 'planning'::public.event_status
    end;

    -- Keep slug unique per org when colliding with a non-projected event.
    if exists (
      select 1 from public.events e
      where e.organization_id = p_organization_id
        and e.slug = v_slug
        and coalesce(e.source_couple_id, '') is distinct from v_source_couple
    ) then
      v_slug := left(v_slug, 48) || '-' || substr(md5(v_source_couple), 1, 8);
    end if;

    insert into public.events (
      organization_id, title, slug, status, start_date, end_date, guest_count,
      metadata, source_couple_id
    ) values (
      p_organization_id,
      left(coalesce(nullif(v_event->>'title', ''), 'Untitled couple'), 200),
      v_slug,
      v_status,
      nullif(v_event->>'startDate', '')::date,
      nullif(v_event->>'endDate', '')::date,
      greatest(coalesce((v_event->>'guestCount')::integer, 0), 0),
      coalesce(v_event->'metadata', '{}'::jsonb),
      v_source_couple
    )
    on conflict (organization_id, source_couple_id)
    where source_couple_id is not null
    do update set
      title = excluded.title,
      slug = excluded.slug,
      status = excluded.status,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      guest_count = excluded.guest_count,
      metadata = excluded.metadata,
      updated_at = now();

    v_event_count := v_event_count + 1;
  end loop;

  for v_guest in select value from jsonb_array_elements(v_guests)
  loop
    v_source_guest := nullif(v_guest->>'sourceGuestId', '');
    v_source_couple := nullif(v_guest->>'sourceCoupleId', '');
    if v_source_guest is null or v_source_couple is null then
      continue;
    end if;

    select e.id into v_event_id
    from public.events e
    where e.organization_id = p_organization_id
      and e.source_couple_id = v_source_couple
    limit 1;
    if v_event_id is null then
      continue;
    end if;

    v_active_guests := array_append(v_active_guests, v_source_guest);
    v_rsvp_status := case v_guest->>'rsvpStatus'
      when 'confirmed' then 'confirmed'
      when 'declined' then 'declined'
      else 'pending'
    end;
    v_token := nullif(v_guest->>'portalToken', '');

    insert into public.guests (
      organization_id, event_id, full_name, email, phone, rsvp_status,
      dietary_restrictions, table_assignment, room_assignment, plus_one_allowed,
      portal_token_hash, portal_access, metadata, source_guest_id
    ) values (
      p_organization_id,
      v_event_id,
      left(coalesce(nullif(v_guest->>'fullName', ''), 'Guest'), 200),
      nullif(v_guest->>'email', ''),
      nullif(v_guest->>'phone', ''),
      v_rsvp_status,
      nullif(v_guest->>'dietaryRestrictions', ''),
      nullif(v_guest->>'tableAssignment', ''),
      nullif(v_guest->>'roomAssignment', ''),
      coalesce((v_guest->>'plusOneAllowed')::boolean, false),
      case when v_token is null then null else encode(sha256(v_token::bytea), 'hex') end,
      jsonb_build_object(
        'enabled', coalesce((v_guest->'portalAccess'->>'enabled')::boolean, true),
        'expires_at', v_guest->'portalAccess'->>'expiresAt'
      ),
      coalesce(v_guest->'metadata', '{}'::jsonb),
      v_source_guest
    )
    on conflict (organization_id, source_guest_id)
    where source_guest_id is not null
    do update set
      event_id = excluded.event_id,
      full_name = excluded.full_name,
      email = excluded.email,
      phone = excluded.phone,
      rsvp_status = excluded.rsvp_status,
      dietary_restrictions = excluded.dietary_restrictions,
      table_assignment = excluded.table_assignment,
      room_assignment = excluded.room_assignment,
      plus_one_allowed = excluded.plus_one_allowed,
      portal_token_hash = excluded.portal_token_hash,
      portal_access = excluded.portal_access,
      metadata = excluded.metadata,
      updated_at = now();

    v_guest_count := v_guest_count + 1;
  end loop;

  for v_rsvp in select value from jsonb_array_elements(v_submissions)
  loop
    v_source_rsvp := nullif(v_rsvp->>'sourceSubmissionId', '');
    v_source_guest := nullif(v_rsvp->>'sourceGuestId', '');
    v_source_couple := nullif(v_rsvp->>'sourceCoupleId', '');
    if v_source_rsvp is null or v_source_guest is null or v_source_couple is null then
      continue;
    end if;

    select e.id into v_event_id
    from public.events e
    where e.organization_id = p_organization_id
      and e.source_couple_id = v_source_couple
    limit 1;
    select g.id into v_guest_id
    from public.guests g
    where g.organization_id = p_organization_id
      and g.source_guest_id = v_source_guest
    limit 1;
    if v_event_id is null then
      continue;
    end if;

    v_active_rsvps := array_append(v_active_rsvps, v_source_rsvp);

    insert into public.rsvp_submissions (
      organization_id, event_id, guest_id, attending, attending_days, meal_choice,
      plus_one_name, plus_one_meal_choice, dietary_notes, special_needs, notes,
      submitted_at, source_submission_id
    ) values (
      p_organization_id,
      v_event_id,
      v_guest_id,
      coalesce((v_rsvp->>'attending')::boolean, false),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_rsvp->'attendingDays', '[]'::jsonb))), '{}'),
      nullif(v_rsvp->>'mealChoice', ''),
      nullif(v_rsvp->>'plusOneName', ''),
      nullif(v_rsvp->>'plusOneMealChoice', ''),
      nullif(v_rsvp->>'dietaryNotes', ''),
      nullif(v_rsvp->>'specialNeeds', ''),
      nullif(v_rsvp->>'notes', ''),
      coalesce(nullif(v_rsvp->>'submittedAt', '')::timestamptz, now()),
      v_source_rsvp
    )
    on conflict (organization_id, source_submission_id)
    where source_submission_id is not null
    do update set
      event_id = excluded.event_id,
      guest_id = excluded.guest_id,
      attending = excluded.attending,
      attending_days = excluded.attending_days,
      meal_choice = excluded.meal_choice,
      plus_one_name = excluded.plus_one_name,
      plus_one_meal_choice = excluded.plus_one_meal_choice,
      dietary_notes = excluded.dietary_notes,
      special_needs = excluded.special_needs,
      notes = excluded.notes,
      submitted_at = excluded.submitted_at;

    v_rsvp_count := v_rsvp_count + 1;
  end loop;

  -- Per-couple portal configs → guest_portal_configs
  for v_source_couple, v_config in
    select key, value from jsonb_each(v_configs)
  loop
    select e.id into v_event_id
    from public.events e
    where e.organization_id = p_organization_id
      and e.source_couple_id = v_source_couple
    limit 1;
    if v_event_id is null then
      continue;
    end if;

    insert into public.guest_portal_configs (
      organization_id, event_id, enabled, password_hash, password_salt,
      access_ends_at, config
    ) values (
      p_organization_id,
      v_event_id,
      true,
      nullif(v_config->>'portalPasswordHash', ''),
      nullif(v_config->>'portalPasswordSalt', ''),
      nullif(v_config->>'rsvpDeadlineDate', '')::timestamptz,
      v_config
    )
    on conflict (event_id)
    do update set
      enabled = true,
      password_hash = excluded.password_hash,
      password_salt = excluded.password_salt,
      access_ends_at = excluded.access_ends_at,
      config = excluded.config,
      updated_at = now();
  end loop;

  -- Remove projected rows that are no longer in the workspace.
  delete from public.rsvp_submissions r
  where r.organization_id = p_organization_id
    and r.source_submission_id is not null
    and not (r.source_submission_id = any (v_active_rsvps));

  delete from public.guests g
  where g.organization_id = p_organization_id
    and g.source_guest_id is not null
    and not (g.source_guest_id = any (v_active_guests));

  delete from public.events e
  where e.organization_id = p_organization_id
    and e.source_couple_id is not null
    and not (e.source_couple_id = any (v_active_couples));

  return jsonb_build_object(
    'ok', true,
    'events', v_event_count,
    'guests', v_guest_count,
    'rsvps', v_rsvp_count
  );
end;
$$;

grant execute on function public.sync_couple_projection(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- Unique constraints referenced by ON CONFLICT must exist as named constraints,
-- not only partial unique indexes. Postgres ON CONFLICT (cols) WHERE requires
-- a matching unique index; the partial unique indexes above satisfy that.
-- The inference form used above matches those indexes.

-- ---------- METRICS: count projection first, then org_data arrays ----------
create or replace function public.get_platform_console_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  venue_metrics jsonb;
  total_venues integer;
  active_venues integer;
  suspended_venues integer;
  provisioning_venues integer;
  pending_invites integer;
  active_admins integer;
  total_couples integer;
  total_guests integer;
  total_rsvps integer;
begin
  if not public.is_platform_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select count(*)::integer into total_venues from public.organizations;
  select count(*)::integer into active_venues from public.organizations where status = 'active';
  select count(*)::integer into suspended_venues from public.organizations where status = 'suspended';
  select count(*)::integer into provisioning_venues from public.organizations where status = 'provisioning';
  select count(*)::integer into pending_invites from public.venue_admin_invites where status = 'pending' and expires_at > now();
  select count(*)::integer into active_admins from public.organization_memberships m join public.organizations o on o.id = m.organization_id where m.status = 'active' and m.role in ('owner','admin') and o.status = 'active';

  select coalesce(sum(metric.couple_count), 0)::integer,
         coalesce(sum(metric.guest_count), 0)::integer,
         coalesce(sum(metric.rsvp_count), 0)::integer
  into total_couples, total_guests, total_rsvps
  from (
    select
      greatest(
        (select count(*)::integer from public.events e where e.organization_id = o.id and e.source_couple_id is not null),
        coalesce((select public.org_data_array_len(d.payload) from public.org_data d where d.organization_id = o.id and d.domain = 'coupleEvents'), 0)
      ) as couple_count,
      greatest(
        (select count(*)::integer from public.guests g where g.organization_id = o.id and g.source_guest_id is not null),
        coalesce((select public.org_data_array_len(d.payload) from public.org_data d where d.organization_id = o.id and d.domain = 'coupleGuests'), 0)
      ) as guest_count,
      greatest(
        (select count(*)::integer from public.rsvp_submissions r where r.organization_id = o.id and r.source_submission_id is not null),
        coalesce((select public.org_data_array_len(d.payload) from public.org_data d where d.organization_id = o.id and d.domain = 'coupleSubmissions'), 0)
      ) as rsvp_count
    from public.organizations o
    where coalesce(o.status, 'active') = 'active'
  ) metric;

  select coalesce(jsonb_agg(to_jsonb(metric) order by metric.created_at), '[]'::jsonb)
  into venue_metrics
  from (
    select
      o.id,
      o.name,
      o.slug,
      o.status,
      o.created_at,
      (select count(*)::integer from public.organization_memberships m where m.organization_id = o.id and m.status = 'active' and m.role in ('owner','admin')) as admin_count,
      greatest(
        (select count(*)::integer from public.events e where e.organization_id = o.id and e.source_couple_id is not null),
        coalesce((select public.org_data_array_len(d.payload) from public.org_data d where d.organization_id = o.id and d.domain = 'coupleEvents'), 0)
      ) as couple_count,
      greatest(
        (select count(*)::integer from public.guests g where g.organization_id = o.id and g.source_guest_id is not null),
        coalesce((select public.org_data_array_len(d.payload) from public.org_data d where d.organization_id = o.id and d.domain = 'coupleGuests'), 0)
      ) as guest_count,
      greatest(
        (select count(*)::integer from public.rsvp_submissions r where r.organization_id = o.id and r.source_submission_id is not null),
        coalesce((select public.org_data_array_len(d.payload) from public.org_data d where d.organization_id = o.id and d.domain = 'coupleSubmissions'), 0)
      ) as rsvp_count,
      (select count(*)::integer from public.venue_admin_invites i where i.organization_id = o.id and i.status = 'pending' and i.expires_at > now()) as pending_invite_count
    from public.organizations o
  ) metric;

  return jsonb_build_object(
    'ok', true,
    'global', jsonb_build_object(
      'total_venues', total_venues,
      'active_venues', active_venues,
      'suspended_venues', suspended_venues,
      'provisioning_venues', provisioning_venues,
      'pending_invites', pending_invites,
      'active_admins', active_admins,
      'total_couples', total_couples,
      'total_guests', total_guests,
      'total_rsvps', total_rsvps
    ),
    'venues', venue_metrics
  );
end;
$$;

grant execute on function public.get_platform_console_metrics() to authenticated;
