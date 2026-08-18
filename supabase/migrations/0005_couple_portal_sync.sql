-- Wedding Venue Intelligence Platform — cross-device couple/guest portal sync
-- Provider: Supabase Postgres
--
-- The venue is a single organization, while couples and wedding guests access
-- their records through scoped bearer links rather than Supabase Auth accounts.
-- This table is a server-side mirror for one CoupleEvent snapshot. Public access
-- is available only through the token-validated RPCs below; direct anonymous
-- table access is never granted.

create table if not exists public.couple_portal_snapshots (
  couple_id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  couple_token_hash text not null unique,
  collaborator_token_hashes jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.couple_portal_snapshots enable row level security;

create policy "couple_snapshots_select_planners"
  on public.couple_portal_snapshots for select
  using (public.has_org_role(organization_id, array['owner','admin','planner']::public.app_role[]));

create policy "couple_snapshots_manage_planners"
  on public.couple_portal_snapshots for all
  using (public.has_org_role(organization_id, array['owner','admin','planner']::public.app_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin','planner']::public.app_role[]));

create index if not exists idx_couple_snapshots_org
  on public.couple_portal_snapshots (organization_id);
create index if not exists idx_couple_snapshots_updated
  on public.couple_portal_snapshots (updated_at);

do $$ begin
  alter publication supabase_realtime add table public.couple_portal_snapshots;
exception when duplicate_object then null;
end $$;

create or replace function public.set_couple_snapshot_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_couple_snapshot_updated_at on public.couple_portal_snapshots;
create trigger set_couple_snapshot_updated_at
  before update on public.couple_portal_snapshots
  for each row execute function public.set_couple_snapshot_updated_at();

-- Venue-authenticated mirror writer. The caller must be an owner/admin/planner
-- of the organization. The raw link tokens remain inside the private snapshot
-- for now so local-mode invite links continue to work after hydration; public
-- guest RPCs never return another guest's token or the full guest list.
create or replace function public.upsert_couple_portal_snapshot(
  p_organization_id uuid,
  p_couple_id text,
  p_couple_token text,
  p_collaborator_tokens text[] default '{}',
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_collaborator_hashes jsonb;
begin
  if auth.uid() is null
     or not public.has_org_role(p_organization_id, array['owner','admin','planner']::public.app_role[]) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_couple_id is null or length(trim(p_couple_id)) = 0
     or p_couple_token is null or length(p_couple_token) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_snapshot_identity');
  end if;

  v_hash := encode(sha256(p_couple_token::bytea), 'hex');
  select coalesce(
    jsonb_agg(encode(sha256(tokens.token_value::bytea), 'hex')),
    '[]'::jsonb
  )
  into v_collaborator_hashes
  from unnest(coalesce(p_collaborator_tokens, '{}')) as tokens(token_value)
  where tokens.token_value is not null and length(tokens.token_value) >= 16;

  insert into public.couple_portal_snapshots (
    couple_id,
    organization_id,
    couple_token_hash,
    collaborator_token_hashes,
    payload
  ) values (
    trim(p_couple_id),
    p_organization_id,
    v_hash,
    v_collaborator_hashes,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (couple_id) do update set
    organization_id = excluded.organization_id,
    couple_token_hash = excluded.couple_token_hash,
    collaborator_token_hashes = excluded.collaborator_token_hashes,
    payload = excluded.payload,
    updated_at = now();

  return jsonb_build_object('ok', true, 'couple_id', trim(p_couple_id));
end;
$$;

-- Couple/collaborator token reader. The snapshot is returned only after the
-- token matches the couple or one of its collaborator token hashes.
create or replace function public.get_couple_portal_snapshot(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  snapshot_row public.couple_portal_snapshots%rowtype;
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

  return jsonb_build_object(
    'ok', true,
    'couple_id', snapshot_row.couple_id,
    'payload', snapshot_row.payload,
    'updated_at', snapshot_row.updated_at
  );
end;
$$;

-- Couple/collaborator writer. The same bearer token that opened the portal is
-- required to save the snapshot, preventing an arbitrary anonymous overwrite.
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

  update public.couple_portal_snapshots
  set payload = coalesce(p_payload, '{}'::jsonb), updated_at = now()
  where couple_id = v_couple_id;

  return jsonb_build_object('ok', true, 'couple_id', v_couple_id);
end;
$$;

-- Public guest reader. It returns the event/venue presentation data, the one
-- matching guest, that guest's RSVP, and the couple itinerary. It intentionally
-- does not return the complete guest list or any bearer tokens.
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

  select guests.guest_json into guest_row
  from jsonb_array_elements(coalesce(snapshot_row.payload->'coupleGuests', '[]'::jsonb)) as guests(guest_json)
  where guests.guest_json->>'token' = p_guest_token
     or guests.guest_json->>'tokenHash' = v_hash
  limit 1;

  if guest_row is null or coalesce(guest_row->>'allowPortalAccess', 'true') = 'false' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
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

-- Public guest RSVP writer. It validates the guest token against the snapshot,
-- scopes the write to that guest/couple, and replaces only that guest's RSVP.
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

  select guests.guest_json into guest_row
  from jsonb_array_elements(coalesce(snapshot_row.payload->'coupleGuests', '[]'::jsonb)) as guests(guest_json)
  where guests.guest_json->>'token' = p_guest_token
     or guests.guest_json->>'tokenHash' = v_hash
  limit 1;

  if guest_row is null or coalesce(guest_row->>'allowPortalAccess', 'true') = 'false' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
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

grant execute on function public.upsert_couple_portal_snapshot(uuid, text, text, text[], jsonb) to authenticated;
grant execute on function public.get_couple_portal_snapshot(text) to anon, authenticated;
grant execute on function public.save_couple_portal_snapshot(text, jsonb) to anon, authenticated;
grant execute on function public.get_guest_couple_portal_snapshot(text, text) to anon, authenticated;
grant execute on function public.submit_guest_couple_rsvp(text, text, jsonb) to anon, authenticated;
