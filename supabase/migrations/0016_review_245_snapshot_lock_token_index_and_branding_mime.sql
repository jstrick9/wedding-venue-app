-- Wedding Venue Intelligence Platform — Review #245 remediation
--
-- 1. P1-C (RSVP lost-update race): `submit_guest_couple_rsvp` read the snapshot
--    payload, computed the next submissions array, and wrote it back with no row
--    lock. Two guests submitting concurrently (the RSVP-deadline crush) each
--    computed from the same base payload and the second write silently dropped
--    the first submission. The snapshot row is now locked `for update` so guest
--    submissions serialize on it. The `_for_venue` variant delegates to this
--    function, so both anonymous paths are covered.
-- 2. P1-D (anon token lookups seq-scan): `guests.portal_token_hash` had no
--    index. `submit_guest_rsvp()` and `get_guest_by_portal_token()` are anon
--    callable security-definer RPCs, so every call scanned every organization's
--    guests. Add the index.
-- 3. P2-E (stored script risk in a public bucket): the public-read
--    `public-branding` bucket accepted `image/svg+xml`. SVG executes script when
--    opened directly from the storage origin. PNG/JPEG/WebP/GIF cover every
--    branding use case; drop SVG from the allow-list.

-- ---------- 1. LOCK THE SNAPSHOT ROW IN THE GUEST RSVP WRITER (P1-C) ----------
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

-- ---------- 2. INDEX THE GUEST PORTAL TOKEN LOOKUP (P1-D) ----------
-- submit_guest_rsvp() and get_guest_by_portal_token() are anon-callable
-- security-definer functions that filter guests by portal_token_hash; without
-- this index every call is a sequential scan across all organizations' guests.
create index if not exists idx_guests_portal_token_hash
  on public.guests (portal_token_hash);

-- ---------- 3. REMOVE SVG FROM THE PUBLIC BRANDING BUCKET (P2-E) ----------
update storage.buckets
set allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif']
where id = 'public-branding';
