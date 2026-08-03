-- Wedding Venue Intelligence Platform — secure public Guest Portal
-- Provider: Supabase Postgres
--
-- The guest portal is public-facing: wedding guests are NOT auth users, so we
-- cannot rely on auth.uid()/RLS for them. Instead we expose two security-definer
-- RPC functions that validate an opaque portal token and only ever touch that
-- one guest's data. Anonymous clients get exactly two entry points and no broad
-- table access. (Org members/staff still use the normal RLS paths for managing
-- guests.)

-- ---------- TOKEN HELPERS ----------
-- Opaque portal tokens are stored as SHA-256 hashes (guests.portal_token_hash),
-- so the raw token is never persisted.

-- ---------- RPC: resolve a guest by portal token ----------
-- Returns only safe fields (no portal_token_hash) for the single guest whose
-- hash matches, if portal access is enabled. Used to confirm identity so the
-- portal can show their event, room, table, schedule, etc.
create or replace function public.get_guest_by_portal_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  g public.guests%rowtype;
begin
  if p_token is null or length(p_token) < 8 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_hash := encode(sha256(p_token::bytea), 'hex');

  select * into g
  from public.guests
  where g.portal_token_hash = v_hash
    and coalesce(g.portal_access->>'enabled', 'false') = 'true';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'guest', jsonb_build_object(
      'id', g.id,
      'full_name', g.full_name,
      'email', g.email,
      'party_name', g.party_name,
      'event_id', g.event_id,
      'table_assignment', g.table_assignment,
      'room_assignment', g.room_assignment,
      'portal_access', g.portal_access
    )
  );
end;
$$;

-- ---------- RPC: submit an RSVP as a verified guest ----------
-- Validates the portal token, then inserts the guest's RSVP row scoped to their
-- own event/org. Returns the new submission id. A guest can only affect their
-- own record.
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

  -- Replace any prior submission for this guest (a guest submits once).
  delete from public.rsvp_submissions where guest_id = g.id;

  insert into public.rsvp_submissions (
    organization_id, event_id, guest_id, attending, attending_days,
    meal_choice, plus_one_name, plus_one_meal_choice, dietary_notes,
    special_needs, notes, submitted_ip
  ) values (
    g.organization_id, g.event_id, g.id, p_attending,
    coalesce(p_attending_days, '{}'), p_meal_choice, p_plus_one_name,
    p_plus_one_meal_choice, p_dietary_notes, p_special_needs, p_notes,
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::inet
  )
  returning id into v_submission_id;

  return jsonb_build_object('ok', true, 'submission_id', v_submission_id);
end;
$$;

-- Only the two RPCs are callable by anonymous/public clients.
grant execute on function public.get_guest_by_portal_token(text) to anon, authenticated;
grant execute on function public.submit_guest_rsvp(
  text, text, text, boolean, text[], text, text, text, text, text, text
) to anon, authenticated;
