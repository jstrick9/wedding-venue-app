-- Wedding Venue Intelligence Platform — personal accounts for couple/guest invites
--
-- Couple, collaborator, and wedding-guest links were historically bearer links:
-- possession of the URL was sufficient to read (and, for couples/guests, write)
-- the scoped portal snapshot. New email-backed invitations now bind that link to
-- a Supabase Auth user. Existing historical records without an email retain the
-- legacy link behavior until the venue/couple adds an email.
--
-- Passwords are owned by Supabase Auth and never stored in this table. The
-- claim-portal-invite Edge Function creates confirmed users with the service
-- role; existing Auth users sign in and accept with their existing password.

create table if not exists public.portal_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  couple_id text not null references public.couple_portal_snapshots(couple_id) on delete cascade,
  participant_type text not null
    check (participant_type in ('couple', 'collaborator', 'guest')),
  participant_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null
    check (role in ('couple', 'collaborator', 'planner', 'family', 'vendor', 'guest')),
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, couple_id, participant_type, participant_id)
);

create index if not exists idx_portal_accounts_user
  on public.portal_accounts (user_id, status);
create index if not exists idx_portal_accounts_couple
  on public.portal_accounts (organization_id, couple_id, status);

alter table public.portal_accounts enable row level security;

drop policy if exists "portal_accounts_select_self_or_venue_admin" on public.portal_accounts;
create policy "portal_accounts_select_self_or_venue_admin"
  on public.portal_accounts for select
  using (
    user_id = auth.uid()
    or public.has_org_role(
      organization_id,
      array['owner','admin','planner']::public.app_role[]
    )
  );

revoke all on table public.portal_accounts from public, anon, authenticated;
grant select on table public.portal_accounts to authenticated;

drop trigger if exists set_portal_accounts_updated_at on public.portal_accounts;
create trigger set_portal_accounts_updated_at
  before update on public.portal_accounts
  for each row execute function public.set_updated_at();

-- Keep invite lookup hashes synchronized for every snapshot writer: venue-side
-- upserts, couple saves, collaborator reissues, and guest edits. Before this
-- trigger, the payload could contain a newly rotated collaborator token while
-- collaborator_token_hashes still pointed at the superseded link.
create or replace function public.refresh_couple_portal_invite_hashes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_event jsonb;
  v_couple_token text;
begin
  if coalesce(jsonb_typeof(new.payload->'coupleEvents'), 'null') <> 'array' then
    return new;
  end if;
  if jsonb_array_length(new.payload->'coupleEvents') = 0 then
    return new;
  end if;

  v_event := coalesce(new.payload->'coupleEvents'->0, '{}'::jsonb);
  v_couple_token := v_event->>'inviteToken';
  if length(coalesce(v_couple_token, '')) >= 16 then
    new.couple_token_hash := encode(sha256(v_couple_token::bytea), 'hex');
  end if;

  select coalesce(
    jsonb_agg(encode(sha256((c.value->>'inviteToken')::bytea), 'hex')),
    '[]'::jsonb
  ) into new.collaborator_token_hashes
  from jsonb_array_elements(coalesce(v_event->'collaborators', '[]'::jsonb)) as c(value)
  where length(coalesce(c.value->>'inviteToken', '')) >= 16
    and length(coalesce(c.value->>'revokedAt', '')) = 0;

  return new;
end;
$$;

revoke all on function public.refresh_couple_portal_invite_hashes() from public;

drop trigger if exists refresh_couple_portal_invite_hashes
  on public.couple_portal_snapshots;
create trigger refresh_couple_portal_invite_hashes
  before insert or update of payload on public.couple_portal_snapshots
  for each row execute function public.refresh_couple_portal_invite_hashes();

-- Repair any hash drift created by a pre-0021 couple save before the trigger
-- existed. Assigning the same payload intentionally invokes the trigger without
-- changing any portal content.
update public.couple_portal_snapshots
set payload = payload
where case
  when jsonb_typeof(payload->'coupleEvents') = 'array'
    then jsonb_array_length(payload->'coupleEvents') > 0
  else false
end;

-- Resolve only the safe setup context for one invitation. It deliberately does
-- not return the private snapshot. `authenticated` is true only when the caller's
-- JWT is already bound to this exact participant.
create or replace function public.get_portal_invite_context(
  p_kind text,
  p_token text,
  p_couple_id text default null,
  p_venue_slug text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := lower(trim(coalesce(p_kind, '')));
  v_token text := trim(coalesce(p_token, ''));
  v_hash text;
  v_snapshot public.couple_portal_snapshots%rowtype;
  v_org public.organizations%rowtype;
  v_event jsonb;
  v_participant jsonb;
  v_participant_type text;
  v_participant_id text;
  v_email text;
  v_full_name text;
  v_role text;
  v_expires_at timestamptz;
  v_account_user_id uuid;
  v_account_email text;
  v_account_required boolean;
  v_personal_account_required boolean := false;
begin
  if v_kind not in ('couple', 'guest')
     or length(v_token) < 16
     or length(v_token) > 512
     or length(coalesce(p_couple_id, '')) > 200
     or length(coalesce(p_venue_slug, '')) > 200 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_hash := encode(sha256(v_token::bytea), 'hex');

  if v_kind = 'couple' then
    select s.* into v_snapshot
    from public.couple_portal_snapshots s
    where s.couple_token_hash = v_hash
       or s.collaborator_token_hashes @> jsonb_build_array(v_hash)
    limit 1;
  else
    if p_couple_id is null or length(trim(p_couple_id)) = 0 then
      return jsonb_build_object('ok', false, 'error', 'invalid_token');
    end if;
    select s.* into v_snapshot
    from public.couple_portal_snapshots s
    where s.couple_id = trim(p_couple_id)
    limit 1;
  end if;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select o.* into v_org
  from public.organizations o
  where o.id = v_snapshot.organization_id
  limit 1;

  if not found
     or coalesce(v_org.status, 'active') <> 'active'
     or (
       p_venue_slug is not null
       and length(trim(p_venue_slug)) > 0
       and lower(coalesce(v_org.slug, '')) <> lower(trim(p_venue_slug))
     ) then
    return jsonb_build_object('ok', false, 'error', 'venue_unavailable');
  end if;

  v_event := coalesce(v_snapshot.payload->'coupleEvents'->0, '{}'::jsonb);

  if v_kind = 'couple' then
    v_expires_at := public.snapshot_token_expires_at(v_snapshot.payload, v_token);
    if v_expires_at is not null and v_expires_at <= now() then
      return jsonb_build_object('ok', false, 'error', 'expired');
    end if;

    if v_event->>'inviteToken' = v_token
       or v_snapshot.couple_token_hash = v_hash then
      select c.value into v_participant
      from jsonb_array_elements(coalesce(v_event->'collaborators', '[]'::jsonb)) as c(value)
      where c.value->>'role' = 'couple'
      order by case when c.value->>'inviteToken' = v_token then 0 else 1 end
      limit 1;

      v_participant_type := 'couple';
      -- Stable across the legacy flow that lazily materializes an owner
      -- collaborator after the first portal load.
      v_participant_id := 'primary-couple';
      v_email := lower(trim(coalesce(
        nullif(v_event->>'primaryEmail', ''),
        nullif(v_participant->>'email', ''),
        ''
      )));
      v_full_name := trim(coalesce(
        nullif(v_participant->>'name', ''),
        nullif(v_event->>'coupleName', ''),
        'Couple'
      ));
      v_role := 'couple';
      v_personal_account_required :=
        coalesce(v_event->>'personalAccountRequired', 'false') = 'true'
        or coalesce(v_participant->>'personalAccountRequired', 'false') = 'true';
    else
      select c.value into v_participant
      from jsonb_array_elements(coalesce(v_event->'collaborators', '[]'::jsonb)) as c(value)
      where c.value->>'inviteToken' = v_token
         or c.value->>'inviteTokenHash' = v_hash
      limit 1;

      if v_participant is null
         or length(coalesce(v_participant->>'revokedAt', '')) > 0 then
        return jsonb_build_object('ok', false, 'error', 'not_found');
      end if;

      v_participant_type := case
        when v_participant->>'role' = 'couple' then 'couple'
        else 'collaborator'
      end;
      v_participant_id := nullif(v_participant->>'id', '');
      v_email := lower(trim(coalesce(v_participant->>'email', '')));
      v_full_name := trim(coalesce(nullif(v_participant->>'name', ''), 'Invitee'));
      v_role := case v_participant->>'role'
        when 'couple' then 'couple'
        when 'planner' then 'planner'
        when 'family' then 'family'
        when 'vendor' then 'vendor'
        else 'collaborator'
      end;
      v_personal_account_required :=
        coalesce(v_participant->>'personalAccountRequired', 'false') = 'true';
    end if;
  else
    v_expires_at := public.snapshot_guest_token_expires_at(v_snapshot.payload, v_token);
    if v_expires_at is not null and v_expires_at <= now() then
      return jsonb_build_object('ok', false, 'error', 'expired');
    end if;

    select g.value into v_participant
    from jsonb_array_elements(coalesce(v_snapshot.payload->'coupleGuests', '[]'::jsonb)) as g(value)
    where g.value->>'token' = v_token
       or g.value->>'tokenHash' = v_hash
    limit 1;

    if v_participant is null
       or coalesce(v_participant->>'allowPortalAccess', 'true') = 'false'
       or length(coalesce(v_participant->>'tokenRevokedAt', '')) > 0 then
      return jsonb_build_object('ok', false, 'error', 'not_found');
    end if;

    v_participant_type := 'guest';
    v_participant_id := nullif(v_participant->>'id', '');
    v_email := lower(trim(coalesce(v_participant->>'email', '')));
    v_full_name := trim(coalesce(nullif(v_participant->>'name', ''), 'Guest'));
    v_role := 'guest';
    v_personal_account_required :=
      coalesce(v_participant->>'personalAccountRequired', 'false') = 'true';
  end if;

  if v_participant_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select a.user_id, a.email into v_account_user_id, v_account_email
  from public.portal_accounts a
  where a.organization_id = v_snapshot.organization_id
    and a.couple_id = v_snapshot.couple_id
    and a.participant_type = v_participant_type
    and a.participant_id = v_participant_id
    and a.status = 'active'
  limit 1;

  if v_account_user_id is not null then
    -- Once claimed, the durable mapping is the canonical identity. A stale or
    -- tampered snapshot email cannot silently transfer an account to someone
    -- else; reissued tokens continue to resolve to the original owner.
    v_email := lower(trim(v_account_email));
    v_account_required := true;
  else
    -- Historical records without a deliverable email remain legacy bearer
    -- links. Every newly issued record carries personalAccountRequired, so
    -- bypassing the UI cannot downgrade it to an anonymous credential.
    if v_personal_account_required
       and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
      return jsonb_build_object('ok', false, 'error', 'email_required');
    end if;
    v_account_required := v_personal_account_required
      or v_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$';
  end if;

  return jsonb_build_object(
    'ok', true,
    'kind', v_kind,
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'organization_slug', v_org.slug,
    'couple_id', v_snapshot.couple_id,
    'couple_name', coalesce(nullif(v_event->>'coupleName', ''), 'Wedding'),
    'participant_type', v_participant_type,
    'participant_id', v_participant_id,
    'email', v_email,
    'full_name', v_full_name,
    'role', v_role,
    'expires_at', v_expires_at,
    'account_required', v_account_required,
    'account_claimed', v_account_user_id is not null,
    'authenticated', v_account_user_id is not null and v_account_user_id = auth.uid()
  );
end;
$$;

revoke all on function public.get_portal_invite_context(text, text, text, text)
  from public;
grant execute on function public.get_portal_invite_context(text, text, text, text)
  to anon, authenticated, service_role;

-- One internal transaction binds an Auth user to exactly the participant named
-- by the current invite. Both public authenticated acceptance and the service-
-- role account-creation path delegate here.
create or replace function public.accept_portal_invite_internal(
  p_kind text,
  p_token text,
  p_couple_id text,
  p_user_id uuid,
  p_email text,
  p_full_name text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context jsonb;
  v_org_id uuid;
  v_couple_id text;
  v_participant_type text;
  v_participant_id text;
  v_existing_user_id uuid;
  v_existing_status text;
  v_name text;
  v_was_active boolean := false;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'auth_required');
  end if;

  v_context := public.get_portal_invite_context(
    p_kind,
    p_token,
    p_couple_id,
    null
  );
  if coalesce((v_context->>'ok')::boolean, false) is not true then
    return v_context;
  end if;
  if coalesce((v_context->>'account_required')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'email_required');
  end if;
  if lower(trim(coalesce(p_email, ''))) <> lower(v_context->>'email') then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  v_org_id := (v_context->>'organization_id')::uuid;
  v_couple_id := v_context->>'couple_id';
  v_participant_type := v_context->>'participant_type';
  v_participant_id := v_context->>'participant_id';
  v_name := left(coalesce(nullif(trim(coalesce(p_full_name, '')), ''), v_context->>'full_name', 'Invitee'), 200);

  -- Serialize an absent-row claim as well as an existing-row claim. A plain
  -- SELECT ... FOR UPDATE cannot lock a key that has not been inserted yet;
  -- without this transaction-scoped lock, two first claims could race into an
  -- ON CONFLICT update and the later request could steal the participant.
  perform pg_advisory_xact_lock(hashtextextended(
    concat_ws(
      chr(31),
      v_org_id::text,
      v_couple_id,
      v_participant_type,
      v_participant_id
    ),
    0
  ));

  -- Re-resolve after waiting for the claim lock. A venue/couple may have
  -- reissued the invitation between the first validation and this transaction;
  -- a superseded token must not win that race from a stale context snapshot.
  v_context := public.get_portal_invite_context(
    p_kind,
    p_token,
    p_couple_id,
    null
  );
  if coalesce((v_context->>'ok')::boolean, false) is not true then
    return v_context;
  end if;
  if (v_context->>'organization_id')::uuid <> v_org_id
     or v_context->>'couple_id' <> v_couple_id
     or v_context->>'participant_type' <> v_participant_type
     or v_context->>'participant_id' <> v_participant_id then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if coalesce((v_context->>'account_required')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'email_required');
  end if;
  if lower(trim(coalesce(p_email, ''))) <> lower(v_context->>'email') then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;
  v_name := left(coalesce(nullif(trim(coalesce(p_full_name, '')), ''), v_context->>'full_name', 'Invitee'), 200);

  select a.user_id, a.status
    into v_existing_user_id, v_existing_status
  from public.portal_accounts a
  where a.organization_id = v_org_id
    and a.couple_id = v_context->>'couple_id'
    and a.participant_type = v_context->>'participant_type'
    and a.participant_id = v_context->>'participant_id'
  limit 1
  for update;

  if v_existing_user_id is not null and v_existing_user_id <> p_user_id then
    return jsonb_build_object('ok', false, 'error', 'already_claimed');
  end if;
  v_was_active := v_existing_user_id = p_user_id and v_existing_status = 'active';

  insert into public.portal_accounts (
    organization_id,
    couple_id,
    participant_type,
    participant_id,
    user_id,
    email,
    full_name,
    role,
    status
  ) values (
    v_org_id,
    v_context->>'couple_id',
    v_context->>'participant_type',
    v_context->>'participant_id',
    p_user_id,
    lower(v_context->>'email'),
    v_name,
    v_context->>'role',
    'active'
  )
  on conflict (organization_id, couple_id, participant_type, participant_id)
  do update set
    user_id = excluded.user_id,
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    status = 'active',
    updated_at = now();

  if not v_was_active then
    insert into public.audit_logs (
      organization_id,
      actor_id,
      action,
      entity_type,
      after_data
    ) values (
      v_org_id,
      p_user_id,
      'portal_invite.claimed',
      'portal_account',
      jsonb_build_object(
        'couple_id', v_context->>'couple_id',
        'participant_type', v_context->>'participant_type',
        'participant_id', v_context->>'participant_id',
        'role', v_context->>'role'
      )
    );
  end if;

  return v_context || jsonb_build_object(
    'ok', true,
    'account_claimed', true,
    'authenticated', true
  );
end;
$$;

revoke all on function public.accept_portal_invite_internal(text, text, text, uuid, text, text)
  from public, anon, authenticated;

create or replace function public.accept_portal_invite(
  p_kind text,
  p_token text,
  p_couple_id text default null,
  p_full_name text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'auth_required');
  end if;
  return public.accept_portal_invite_internal(
    p_kind,
    p_token,
    p_couple_id,
    auth.uid(),
    coalesce(auth.jwt()->>'email', ''),
    p_full_name
  );
end;
$$;

revoke all on function public.accept_portal_invite(text, text, text, text)
  from public, anon;
grant execute on function public.accept_portal_invite(text, text, text, text)
  to authenticated;

create or replace function public.claim_portal_invite_account(
  p_kind text,
  p_token text,
  p_couple_id text,
  p_user_id uuid,
  p_email text,
  p_full_name text default null
) returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.accept_portal_invite_internal(
    p_kind,
    p_token,
    p_couple_id,
    p_user_id,
    p_email,
    p_full_name
  );
$$;

revoke all on function public.claim_portal_invite_account(text, text, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_portal_invite_account(text, text, text, uuid, text, text)
  to service_role;

-- Account gate layered around the already-hardened token implementations. A
-- no-email historical participant is allowed through for compatibility. An
-- email-backed participant must present the JWT bound in portal_accounts.
alter function public.get_couple_portal_snapshot(text)
  rename to get_couple_portal_snapshot_token_impl;
revoke all on function public.get_couple_portal_snapshot_token_impl(text)
  from public, anon, authenticated;

create or replace function public.get_couple_portal_snapshot(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context jsonb;
begin
  v_context := public.get_portal_invite_context('couple', p_token, null, null);
  if coalesce((v_context->>'ok')::boolean, false) is not true then return v_context; end if;
  if coalesce((v_context->>'account_required')::boolean, false)
     and not coalesce((v_context->>'authenticated')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  return public.get_couple_portal_snapshot_token_impl(p_token);
end;
$$;
revoke all on function public.get_couple_portal_snapshot(text) from public;
grant execute on function public.get_couple_portal_snapshot(text) to anon, authenticated;

alter function public.save_couple_portal_snapshot(text, jsonb, timestamptz)
  rename to save_couple_portal_snapshot_token_impl;
revoke all on function public.save_couple_portal_snapshot_token_impl(text, jsonb, timestamptz)
  from public, anon, authenticated;

create or replace function public.save_couple_portal_snapshot(
  p_token text,
  p_payload jsonb,
  p_base_updated_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context jsonb;
  v_result jsonb;
begin
  v_context := public.get_portal_invite_context('couple', p_token, null, null);
  if coalesce((v_context->>'ok')::boolean, false) is not true then return v_context; end if;
  if coalesce((v_context->>'account_required')::boolean, false)
     and not coalesce((v_context->>'authenticated')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;

  v_result := public.save_couple_portal_snapshot_token_impl(
    p_token,
    p_payload,
    p_base_updated_at
  );
  if coalesce((v_result->>'ok')::boolean, false) is not true then return v_result; end if;

  -- refresh_couple_portal_invite_hashes runs inside the implementation's
  -- payload update, so all current tokens are discoverable before this call
  -- commits regardless of which browser surface initiated the write.
  return v_result;
end;
$$;
revoke all on function public.save_couple_portal_snapshot(text, jsonb, timestamptz)
  from public;
grant execute on function public.save_couple_portal_snapshot(text, jsonb, timestamptz)
  to anon, authenticated;

alter function public.get_guest_couple_portal_snapshot(text, text)
  rename to get_guest_couple_portal_snapshot_token_impl;
revoke all on function public.get_guest_couple_portal_snapshot_token_impl(text, text)
  from public, anon, authenticated;

create or replace function public.get_guest_couple_portal_snapshot(
  p_couple_id text,
  p_guest_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context jsonb;
begin
  v_context := public.get_portal_invite_context('guest', p_guest_token, p_couple_id, null);
  if coalesce((v_context->>'ok')::boolean, false) is not true then return v_context; end if;
  if coalesce((v_context->>'account_required')::boolean, false)
     and not coalesce((v_context->>'authenticated')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  return public.get_guest_couple_portal_snapshot_token_impl(p_couple_id, p_guest_token);
end;
$$;
revoke all on function public.get_guest_couple_portal_snapshot(text, text)
  from public;
grant execute on function public.get_guest_couple_portal_snapshot(text, text)
  to anon, authenticated;

alter function public.submit_guest_couple_rsvp(text, text, jsonb)
  rename to submit_guest_couple_rsvp_token_impl;
revoke all on function public.submit_guest_couple_rsvp_token_impl(text, text, jsonb)
  from public, anon, authenticated;

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
  v_context jsonb;
begin
  v_context := public.get_portal_invite_context('guest', p_guest_token, p_couple_id, null);
  if coalesce((v_context->>'ok')::boolean, false) is not true then return v_context; end if;
  if coalesce((v_context->>'account_required')::boolean, false)
     and not coalesce((v_context->>'authenticated')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  return public.submit_guest_couple_rsvp_token_impl(
    p_couple_id,
    p_guest_token,
    p_submission
  );
end;
$$;
revoke all on function public.submit_guest_couple_rsvp(text, text, jsonb)
  from public;
grant execute on function public.submit_guest_couple_rsvp(text, text, jsonb)
  to anon, authenticated;

-- Recreate every venue-slug overload explicitly after the base-function
-- renames above. The 0018 save overload called the unchecked writer directly;
-- leaving it unchanged would let a token bypass the personal-account gate on
-- the primary venue-link path used by the browser.
create or replace function public.get_couple_portal_snapshot_for_venue(
  p_venue_slug text,
  p_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context jsonb;
begin
  v_context := public.get_portal_invite_context('couple', p_token, null, p_venue_slug);
  if coalesce((v_context->>'ok')::boolean, false) is not true then return v_context; end if;
  if coalesce((v_context->>'account_required')::boolean, false)
     and not coalesce((v_context->>'authenticated')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  return public.get_couple_portal_snapshot_token_impl(p_token);
end;
$$;
revoke all on function public.get_couple_portal_snapshot_for_venue(text, text)
  from public;
grant execute on function public.get_couple_portal_snapshot_for_venue(text, text)
  to anon, authenticated;

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
declare
  v_context jsonb;
begin
  v_context := public.get_portal_invite_context('couple', p_token, null, p_venue_slug);
  if coalesce((v_context->>'ok')::boolean, false) is not true then return v_context; end if;
  if coalesce((v_context->>'account_required')::boolean, false)
     and not coalesce((v_context->>'authenticated')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  return public.save_couple_portal_snapshot_token_impl(
    p_token,
    p_payload,
    p_base_updated_at
  );
end;
$$;
revoke all on function public.save_couple_portal_snapshot_for_venue(text, text, jsonb, timestamptz)
  from public;
grant execute on function public.save_couple_portal_snapshot_for_venue(text, text, jsonb, timestamptz)
  to anon, authenticated;

create or replace function public.get_guest_couple_portal_snapshot_for_venue(
  p_venue_slug text,
  p_couple_id text,
  p_guest_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context jsonb;
begin
  v_context := public.get_portal_invite_context('guest', p_guest_token, p_couple_id, p_venue_slug);
  if coalesce((v_context->>'ok')::boolean, false) is not true then return v_context; end if;
  if coalesce((v_context->>'account_required')::boolean, false)
     and not coalesce((v_context->>'authenticated')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  return public.get_guest_couple_portal_snapshot_token_impl(p_couple_id, p_guest_token);
end;
$$;
revoke all on function public.get_guest_couple_portal_snapshot_for_venue(text, text, text)
  from public;
grant execute on function public.get_guest_couple_portal_snapshot_for_venue(text, text, text)
  to anon, authenticated;

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
declare
  v_context jsonb;
begin
  v_context := public.get_portal_invite_context('guest', p_guest_token, p_couple_id, p_venue_slug);
  if coalesce((v_context->>'ok')::boolean, false) is not true then return v_context; end if;
  if coalesce((v_context->>'account_required')::boolean, false)
     and not coalesce((v_context->>'authenticated')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  return public.submit_guest_couple_rsvp_token_impl(
    p_couple_id,
    p_guest_token,
    p_submission
  );
end;
$$;
revoke all on function public.submit_guest_couple_rsvp_for_venue(text, text, text, jsonb)
  from public;
grant execute on function public.submit_guest_couple_rsvp_for_venue(text, text, text, jsonb)
  to anon, authenticated;

-- The older relational guest RPCs expose the same projected couple guests by
-- portal_token_hash. Gate projected rows too, otherwise callers could bypass
-- the snapshot-account wrappers by invoking these legacy endpoints directly.
-- Native venue guests (events.source_couple_id is null) remain on their
-- historical token flow.
alter function public.get_guest_by_portal_token(text)
  rename to get_guest_by_portal_token_token_impl;
revoke all on function public.get_guest_by_portal_token_token_impl(text)
  from public, anon, authenticated;

create or replace function public.get_guest_by_portal_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id text;
  v_context jsonb;
begin
  select e.source_couple_id into v_couple_id
  from public.guests g
  join public.events e
    on e.id = g.event_id
   and e.organization_id = g.organization_id
  where g.portal_token_hash = encode(sha256(p_token::bytea), 'hex')
  limit 1;

  if v_couple_id is not null then
    v_context := public.get_portal_invite_context('guest', p_token, v_couple_id, null);
    if coalesce((v_context->>'ok')::boolean, false) is not true then return v_context; end if;
    if coalesce((v_context->>'account_required')::boolean, false)
       and not coalesce((v_context->>'authenticated')::boolean, false) then
      return jsonb_build_object('ok', false, 'error', 'account_required');
    end if;
  end if;

  return public.get_guest_by_portal_token_token_impl(p_token);
end;
$$;
revoke all on function public.get_guest_by_portal_token(text) from public;
grant execute on function public.get_guest_by_portal_token(text)
  to anon, authenticated;

alter function public.submit_guest_rsvp(
  text, text, text, boolean, text[], text, text, text, text, text, text
) rename to submit_guest_rsvp_token_impl;
revoke all on function public.submit_guest_rsvp_token_impl(
  text, text, text, boolean, text[], text, text, text, text, text, text
) from public, anon, authenticated;

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
  v_couple_id text;
  v_context jsonb;
begin
  select e.source_couple_id into v_couple_id
  from public.guests g
  join public.events e
    on e.id = g.event_id
   and e.organization_id = g.organization_id
  where g.portal_token_hash = encode(sha256(p_token::bytea), 'hex')
  limit 1;

  if v_couple_id is not null then
    v_context := public.get_portal_invite_context('guest', p_token, v_couple_id, null);
    if coalesce((v_context->>'ok')::boolean, false) is not true then return v_context; end if;
    if coalesce((v_context->>'account_required')::boolean, false)
       and not coalesce((v_context->>'authenticated')::boolean, false) then
      return jsonb_build_object('ok', false, 'error', 'account_required');
    end if;
  end if;

  return public.submit_guest_rsvp_token_impl(
    p_token,
    p_full_name,
    p_email,
    p_attending,
    p_attending_days,
    p_meal_choice,
    p_plus_one_name,
    p_plus_one_meal_choice,
    p_dietary_notes,
    p_special_needs,
    p_notes
  );
end;
$$;
revoke all on function public.submit_guest_rsvp(
  text, text, text, boolean, text[], text, text, text, text, text, text
) from public;
grant execute on function public.submit_guest_rsvp(
  text, text, text, boolean, text[], text, text, text, text, text, text
) to anon, authenticated;
