-- Wedding Venue Intelligence Platform — Review #247 remediation
--
-- P2-G from Review #245: make the venue-admin claim atomic and throttled.
--
-- 1. ATOMIC CLAIM. The claim-venue-admin Edge Function set/reset the invited
--    administrator's password but left the invite `pending` until a *client*
--    called accept_venue_admin_invite after signing in. A user who abandoned
--    onboarding after the password step left a live pending invite whose token
--    could reset that password again. `claim_venue_admin_account` performs the
--    whole claim (ownership transfer + membership + invite consumption + audit)
--    in ONE transaction, called by the Edge Function with the service role
--    immediately after the password is set. Re-claims by the same user are
--    idempotent; claims by anyone else after consumption fail.
-- 2. THROTTLE. `venue_admin_claim_attempts` counts failed token attempts per
--    token hash (service-role only). After 10 failures in a rolling hour the
--    token locks for 15 minutes. The Edge Function checks the gate before any
--    Auth mutation and registers failures on invalid tokens.
-- 3. IDEMPOTENT CLIENT ACCEPT. accept_venue_admin_invite now succeeds when the
--    invite was already accepted by the SAME user (the Edge Function may have
--    consumed it moments earlier), so the existing client flow keeps working
--    and the pre-0017 fallback path (Edge Function absent / migration not yet
--    applied) is unchanged.
--
-- Ordering note: the Edge Function degrades gracefully when this migration is
--    not yet applied (falls back to the client-side accept flow), so the
--    function may be deployed before the SQL runs.

-- ---------- 1. CLAIM ATTEMPT THROTTLE TABLE ----------
create table if not exists public.venue_admin_claim_attempts (
  token_hash text primary key,
  failures integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz
);

alter table public.venue_admin_claim_attempts enable row level security;
-- No policies, no grants: only the service-role Edge Function touches this.

-- ---------- 2. SERVICE-ROLE RPCs (revoke from public/anon/authenticated) ----------

create or replace function public.venue_admin_claim_gate(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_row public.venue_admin_claim_attempts%rowtype;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return jsonb_build_object('ok', true, 'locked', false);
  end if;

  v_hash := encode(sha256(p_token::bytea), 'hex');
  select * into v_row
  from public.venue_admin_claim_attempts a
  where a.token_hash = v_hash;

  if v_row.token_hash is null then
    return jsonb_build_object('ok', true, 'locked', false);
  end if;

  if v_row.locked_until is not null and v_row.locked_until > now() then
    return jsonb_build_object('ok', false, 'locked', true, 'locked_until', v_row.locked_until);
  end if;

  return jsonb_build_object('ok', true, 'locked', false);
end;
$$;

create or replace function public.register_venue_admin_claim_failure(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_row public.venue_admin_claim_attempts%rowtype;
  v_failures integer;
  v_locked_until timestamptz;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return jsonb_build_object('ok', true);
  end if;

  v_hash := encode(sha256(p_token::bytea), 'hex');

  select * into v_row
  from public.venue_admin_claim_attempts a
  where a.token_hash = v_hash
  for update;

  if v_row.token_hash is null then
    insert into public.venue_admin_claim_attempts (token_hash, failures, window_started_at)
    values (v_hash, 1, now())
    on conflict (token_hash) do nothing;
    return jsonb_build_object('ok', true, 'failures', 1);
  end if;

  -- Rolling one-hour window: stale windows restart the count.
  if v_row.window_started_at < now() - interval '1 hour' then
    v_failures := 1;
  else
    v_failures := v_row.failures + 1;
  end if;

  v_locked_until := v_row.locked_until;
  if v_failures >= 10 then
    v_locked_until := now() + interval '15 minutes';
  end if;

  update public.venue_admin_claim_attempts
  set failures = v_failures,
      window_started_at = case when v_row.window_started_at < now() - interval '1 hour' then now() else v_row.window_started_at end,
      locked_until = v_locked_until
  where token_hash = v_hash;

  return jsonb_build_object('ok', true, 'failures', v_failures, 'locked_until', v_locked_until);
end;
$$;

-- ---------- 3. ATOMIC CLAIM (service-role; called by claim-venue-admin) ----------
create or replace function public.claim_venue_admin_account(
  p_token text,
  p_user_id uuid,
  p_email text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_invite public.venue_admin_invites%rowtype;
  v_org_name text;
  v_org_slug text;
  v_org_status text;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_user');
  end if;

  v_hash := encode(sha256(p_token::bytea), 'hex');

  -- Serialize concurrent claims on the same invite.
  select * into v_invite
  from public.venue_admin_invites vai
  where vai.token_hash = v_hash
  for update;

  if v_invite.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- Idempotent re-claim by the same user (Edge Function retry / response loss).
  if v_invite.status = 'accepted' then
    if v_invite.accepted_by = p_user_id then
      select o.name, o.slug into v_org_name, v_org_slug
      from public.organizations o
      where o.id = v_invite.organization_id;
      return jsonb_build_object(
        'ok', true,
        'already_claimed', true,
        'organization_id', v_invite.organization_id,
        'organization_name', v_org_name,
        'organization_slug', v_org_slug
      );
    end if;
    return jsonb_build_object('ok', false, 'error', 'already_claimed');
  end if;

  if v_invite.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_invite.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if p_email is null or lower(trim(p_email)) <> lower(v_invite.email) then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  select o.name, o.slug, coalesce(o.status, 'active')
  into v_org_name, v_org_slug, v_org_status
  from public.organizations o
  where o.id = v_invite.organization_id;

  if v_org_name is null or v_org_status in ('suspended', 'archived') then
    return jsonb_build_object('ok', false, 'error', 'venue_unavailable');
  end if;

  -- Ownership transfer (same semantics as accept_venue_admin_invite / #211):
  -- a platform reissue transfers managed ownership to the invitee and demotes
  -- any previous owner membership to admin.
  update public.organization_memberships
  set role = 'admin', updated_at = now()
  where organization_id = v_invite.organization_id
    and user_id is distinct from p_user_id
    and role = 'owner';

  update public.organizations
  set owner_id = p_user_id, status = 'active', updated_at = now(),
      suspended_at = null, suspended_by = null, suspension_reason = null
  where id = v_invite.organization_id;

  insert into public.organization_memberships (organization_id, user_id, role, status)
  values (v_invite.organization_id, p_user_id, v_invite.role, 'active')
  on conflict (organization_id, user_id)
  do update set role = excluded.role, status = 'active', updated_at = now();

  update public.venue_admin_invites
  set status = 'accepted', accepted_by = p_user_id, accepted_at = now()
  where id = v_invite.id;

  delete from public.venue_admin_claim_attempts
  where token_hash = v_hash;

  insert into public.platform_audit_logs (
    platform_user_id, organization_id, action, target_type, target_id, reason, metadata
  ) values (
    p_user_id,
    v_invite.organization_id,
    'venue_admin_invite.claimed',
    'venue_admin_invite',
    v_invite.id::text,
    'Atomic claim via claim-venue-admin Edge Function (Review #247)',
    jsonb_build_object('via', 'edge_function', 'email', lower(v_invite.email))
  );

  return jsonb_build_object(
    'ok', true,
    'organization_id', v_invite.organization_id,
    'organization_name', v_org_name,
    'organization_slug', v_org_slug
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'claim_conflict');
end;
$$;

-- These three RPCs are for the service-role Edge Function only.
revoke execute on function public.venue_admin_claim_gate(text) from public, anon, authenticated;
revoke execute on function public.register_venue_admin_claim_failure(text) from public, anon, authenticated;
revoke execute on function public.claim_venue_admin_account(text, uuid, text) from public, anon, authenticated;

-- ---------- 4. IDEMPOTENT CLIENT-SIDE ACCEPT ----------
create or replace function public.accept_venue_admin_invite(
  p_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_invite_id uuid;
  v_org_id uuid;
  v_invite_email text;
  v_role public.app_role;
  v_expires timestamptz;
  v_email text;
  v_org_name text;
  v_org_slug text;
  v_org_status text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'auth_required');
  end if;
  if p_token is null or length(trim(p_token)) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_hash := encode(sha256(p_token::bytea), 'hex');

  select vai.id, vai.organization_id, vai.email, vai.role, vai.expires_at
  into v_invite_id, v_org_id, v_invite_email, v_role, v_expires
  from public.venue_admin_invites vai
  where vai.token_hash = v_hash and vai.status = 'pending'
  for update;

  if v_invite_id is null then
    -- Idempotent re-accept (Review #247): the claim-venue-admin Edge Function
    -- may have already consumed this invite for the signed-in user during
    -- onboarding. A client-side accept that follows must succeed, not error
    -- with "not_found".
    select vai.organization_id into v_org_id
    from public.venue_admin_invites vai
    where vai.token_hash = v_hash
      and vai.status = 'accepted'
      and vai.accepted_by is not distinct from auth.uid();

    if v_org_id is not null
       and exists (
         select 1 from public.organization_memberships m
         where m.organization_id = v_org_id
           and m.user_id = auth.uid()
           and m.status = 'active'
       ) then
      select o.name, o.slug into v_org_name, v_org_slug
      from public.organizations o
      where o.id = v_org_id;
      return jsonb_build_object(
        'ok', true,
        'already_accepted', true,
        'organization_id', v_org_id,
        'organization_name', v_org_name,
        'organization_slug', v_org_slug
      );
    end if;

    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_expires < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select o.name, o.slug, coalesce(o.status, 'active')
  into v_org_name, v_org_slug, v_org_status
  from public.organizations o
  where o.id = v_org_id;

  if v_org_name is null or v_org_status in ('suspended', 'archived') then
    return jsonb_build_object('ok', false, 'error', 'venue_unavailable');
  end if;

  v_email := lower(coalesce(nullif(auth.jwt()->>'email', ''), nullif(auth.email(), ''), ''));
  if v_email = '' or v_email <> lower(v_invite_email) then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  -- Platform reissue may transfer managed ownership to the invited email.
  update public.organization_memberships
  set role = 'admin', updated_at = now()
  where organization_id = v_org_id
    and user_id is distinct from auth.uid()
    and role = 'owner';

  update public.organizations
  set owner_id = auth.uid(), status = 'active', updated_at = now(),
      suspended_at = null, suspended_by = null, suspension_reason = null
  where id = v_org_id;

  insert into public.organization_memberships (organization_id, user_id, role, status)
  values (v_org_id, auth.uid(), v_role, 'active')
  on conflict (organization_id, user_id)
  do update set role = excluded.role, status = 'active', updated_at = now();

  update public.venue_admin_invites
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
  where id = v_invite_id;

  return jsonb_build_object(
    'ok', true,
    'organization_id', v_org_id,
    'organization_name', v_org_name,
    'organization_slug', v_org_slug
  );
end;
$$;

grant execute on function public.accept_venue_admin_invite(text) to authenticated;
