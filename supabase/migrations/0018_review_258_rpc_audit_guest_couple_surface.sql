-- Wedding Venue Intelligence Platform — Review #258 remediation (Phase 2 batch 1:
-- the guest/couple public RPC cluster). Findings F-258-1 … F-258-4.
--
-- F-258-1 (P1 grant hygiene): migration 0008 renamed the original couple-portal
--   RPCs to *_unchecked and installed checked wrappers under the old names.
--   RENAME preserves grants, so the renamed internals stayed executable by anon
--   and authenticated. Live-proven during this audit: all four answered
--   {"ok":false,"error":"not_found"} to an anon probe, while the (revoked)
--   claim_venue_admin_account correctly hides with PGRST202.
--     * submit_guest_couple_rsvp_unchecked still carried the PRE-#245 body —
--       no FOR UPDATE lock (the lost-update race) and no RSVP-deadline check —
--       directly callable by anyone.
--     * get/save_couple_portal_snapshot_unchecked and
--       get_guest_couple_portal_snapshot_unchecked bypass the suspended-org gate.
--   Fix: revoke execute from public/anon/authenticated on the three that remain
--   delegation targets of security-definer wrappers (the wrappers call them with
--   owner privileges); DROP the fully-orphaned submit_guest_couple_rsvp_unchecked
--   (verified: nothing in src/, supabase/functions/, or scripts/ references it).
--
-- F-258-2 (P2 lost update): the couple-side save replaced the whole snapshot
--   payload with client-computed state and no compare-and-swap, so a guest
--   submission landing between the couple's pull and push was silently dropped
--   (the #245 FOR UPDATE only serialized the server-side writers). The save
--   functions gain an optional p_base_updated_at: when provided and the row has
--   moved, they return {"ok":false,"error":"conflict"}. Signatures change (new
--   optional arg) — the old forms are dropped and the new ones granted
--   explicitly; PostgREST resolves the previous named-arg calls via the
--   parameter default, so the old client behavior keeps working.
--
-- F-258-3 (P3 duplicate submissions): submit_guest_rsvp did delete+insert with
--   no lock while rsvp_submissions has no unique(guest_id) index, so concurrent
--   double-submits could leave two rows for one guest. The guest row is now
--   locked FOR UPDATE first — the same serialization #245 applied to the
--   couple-snapshot path.
--
-- F-258-4 (P3 unbounded input on anon RPCs): the legacy submit_guest_rsvp
--   validated some fields but left plus_one_name / plus_one_meal_choice /
--   dietary_notes / special_needs / notes and the attending_days entries
--   unbounded; submit_guest_couple_rsvp embedded p_submission wholesale with no
--   size cap. Both now cap input sizes.

-- ---------- 1. GRANT HYGIENE: THE 0008 RENAME ORPHANS (F-258-1) ----------
revoke execute on function public.get_couple_portal_snapshot_unchecked(text)
  from public, anon, authenticated;
revoke execute on function public.get_guest_couple_portal_snapshot_unchecked(text, text)
  from public, anon, authenticated;
-- Fully orphaned (nothing calls it; it duplicates the hardened public path):
drop function if exists public.submit_guest_couple_rsvp_unchecked(text, text, jsonb);

-- ---------- 2. COMPARE-AND-SWAP ON THE COUPLE-SIDE SAVE (F-258-2) ----------
-- Internal writer with CAS. Locked read so the version check and the write see
-- the same row, and guest submissions (FOR UPDATE in submit_guest_couple_rsvp)
-- serialize against this path.
create or replace function public.save_couple_portal_snapshot_unchecked(
  p_token text,
  p_payload jsonb,
  p_base_updated_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_couple_id text;
  v_expires_at timestamptz;
  v_row_updated_at timestamptz;
begin
  if p_token is null or length(p_token) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_hash := encode(sha256(p_token::bytea), 'hex');

  select s.couple_id, s.updated_at,
         public.snapshot_token_expires_at(s.payload, p_token)
    into v_couple_id, v_row_updated_at, v_expires_at
  from public.couple_portal_snapshots s
  where s.couple_token_hash = v_hash
     or s.collaborator_token_hashes @> jsonb_build_array(v_hash)
  limit 1
  for update;

  if v_couple_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_expires_at is not null and v_expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  -- Compare-and-swap (Review #258 F-258-2): if the snapshot moved since the
  -- caller's pull (e.g. a guest submitted in between), refuse the blind
  -- overwrite so the client can re-pull and merge instead of losing writes.
  if p_base_updated_at is not null and v_row_updated_at <> p_base_updated_at then
    return jsonb_build_object('ok', false, 'error', 'conflict', 'updated_at', v_row_updated_at);
  end if;

  update public.couple_portal_snapshots
  set payload = coalesce(p_payload, '{}'::jsonb), updated_at = now()
  where couple_id = v_couple_id;

  return jsonb_build_object('ok', true, 'couple_id', v_couple_id);
end;
$$;
-- Internal only: the checked wrappers invoke it with owner privileges.
revoke execute on function public.save_couple_portal_snapshot_unchecked(text, jsonb, timestamptz)
  from public, anon, authenticated;
drop function if exists public.save_couple_portal_snapshot_unchecked(text, jsonb);

-- Checked wrapper (org must be active; token must be the couple's or a
-- collaborator's) — now forwards the CAS base version.
create or replace function public.save_couple_portal_snapshot(
  p_token text,
  p_payload jsonb,
  p_base_updated_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.couple_portal_snapshots s
    join public.organizations o on o.id = s.organization_id
    where coalesce(o.status, 'active') = 'active'
      and (
        s.couple_token_hash = encode(sha256(p_token::bytea), 'hex')
        or s.collaborator_token_hashes @> jsonb_build_array(encode(sha256(p_token::bytea), 'hex'))
      )
  ) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return public.save_couple_portal_snapshot_unchecked(p_token, p_payload, p_base_updated_at);
end;
$$;
grant execute on function public.save_couple_portal_snapshot(text, jsonb, timestamptz)
  to anon, authenticated;
drop function if exists public.save_couple_portal_snapshot(text, jsonb);

-- Slug-scoped variant for the couple portal running on a venue domain.
create or replace function public.save_couple_portal_snapshot_for_venue(
  p_venue_slug text,
  p_token text,
  p_payload jsonb,
  p_base_updated_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.couple_portal_snapshots s
    join public.organizations o on o.id = s.organization_id
    where lower(o.slug) = lower(trim(coalesce(p_venue_slug, '')))
      and (
        s.couple_token_hash = encode(sha256(p_token::bytea), 'hex')
        or s.collaborator_token_hashes @> jsonb_build_array(encode(sha256(p_token::bytea), 'hex'))
      )
  ) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return public.save_couple_portal_snapshot_unchecked(p_token, p_payload, p_base_updated_at);
end;
$$;
grant execute on function public.save_couple_portal_snapshot_for_venue(text, text, jsonb, timestamptz)
  to anon, authenticated;
drop function if exists public.save_couple_portal_snapshot_for_venue(text, text, jsonb);

-- ---------- 3. LOCK THE GUEST ROW IN THE LEGACY RSVP WRITER (F-258-3) ----------
-- Same 11-arg signature: create or replace, grants persist.
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

  -- FOR UPDATE (Review #258 F-258-3): serialize submissions per guest so the
  -- delete+insert replacement below cannot interleave into duplicate rows
  -- (rsvp_submissions has no unique(guest_id) backstop).
  select * into g
  from public.guests
  where g.portal_token_hash = v_hash
  for update;

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
  if p_plus_one_name is not null and length(p_plus_one_name) > 200 then
    return jsonb_build_object('ok', false, 'error', 'invalid_plus_one_name');
  end if;
  if p_plus_one_meal_choice is not null and length(p_plus_one_meal_choice) > 100 then
    return jsonb_build_object('ok', false, 'error', 'invalid_plus_one_meal_choice');
  end if;
  if p_dietary_notes is not null and length(p_dietary_notes) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_dietary_notes');
  end if;
  if p_special_needs is not null and length(p_special_needs) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_special_needs');
  end if;
  if p_notes is not null and length(p_notes) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_notes');
  end if;
  if p_attending_days is not null and array_length(p_attending_days, 1) > 30 then
    return jsonb_build_object('ok', false, 'error', 'too_many_days');
  end if;
  if exists (select 1 from unnest(coalesce(p_attending_days, '{}')) as d where length(d) > 30) then
    return jsonb_build_object('ok', false, 'error', 'invalid_attending_days');
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

-- ---------- 4. CAP THE GUEST SUBMISSION PAYLOAD (F-258-4) ----------
-- Same 3-arg signature: create or replace, grants persist.
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

  -- Size cap (Review #258 F-258-4): the payload is embedded into the snapshot
  -- array, so an unbounded object is a storage/DoS vector on an anon RPC.
  if octet_length(p_submission::text) > 20000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_submission');
  end if;

  v_hash := encode(sha256(p_guest_token::bytea), 'hex');

  -- FOR UPDATE serializes concurrent guest submissions (and the venue-side
  -- couple snapshot save) on this row so a read-modify-write can no longer
  -- drop a concurrent submission (Review #245 P1-C).
  select * into snapshot_row
  from public.couple_portal_snapshots s
  where s.couple_id = p_couple_id
  for update;

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
