-- Review #207: fix invite lookup and allow reissue on a claimed venue.
--
-- get_venue_admin_invite_context used `SELECT vai INTO invite_row`. PL/pgSQL
-- assigned that composite to the first column (id uuid), which throws:
--   invalid input syntax for type uuid: "(id,org_id,email,...)"
--
-- Reissue previously required organizations.owner_id IS NULL. Accept then
-- rejected a claimed venue. Platform reissue now transfers managed ownership.

create or replace function public.get_venue_admin_invite_context(
  p_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_email text;
  v_role text;
  v_expires timestamptz;
  v_name text;
  v_slug text;
  v_status text;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select vai.organization_id, vai.email, vai.role::text, vai.expires_at
  into v_org_id, v_email, v_role, v_expires
  from public.venue_admin_invites vai
  where vai.token_hash = encode(sha256(p_token::bytea), 'hex')
    and vai.status = 'pending'
  limit 1;

  if v_org_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_expires < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select o.name, o.slug, coalesce(o.status, 'active')
  into v_name, v_slug, v_status
  from public.organizations o
  where o.id = v_org_id;

  if v_status in ('suspended', 'archived') then
    return jsonb_build_object('ok', false, 'error', 'venue_unavailable');
  end if;

  return jsonb_build_object(
    'ok', true,
    'organization_id', v_org_id,
    'organization_name', v_name,
    'organization_slug', v_slug,
    'email', v_email,
    'role', v_role,
    'expires_at', v_expires
  );
end;
$$;

grant execute on function public.get_venue_admin_invite_context(text) to anon, authenticated;

create or replace function public.reissue_venue_admin_invite(
  p_organization_id uuid,
  p_email text,
  p_admin_token text,
  p_expires_at timestamptz default (now() + interval '7 days')
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_hash text;
  v_expiry timestamptz;
  v_invite_id uuid;
  v_org_name text;
begin
  if not public.is_platform_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if not exists (
    select 1 from public.organizations o
    where o.id = p_organization_id
      and coalesce(o.status, 'active') in ('provisioning', 'active')
  ) then
    return jsonb_build_object('ok', false, 'error', 'venue_unavailable');
  end if;

  v_email := lower(trim(coalesce(p_email, '')));
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_admin_email');
  end if;
  if p_admin_token is null or length(p_admin_token) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_admin_token');
  end if;

  v_hash := encode(sha256(p_admin_token::bytea), 'hex');
  v_expiry := coalesce(p_expires_at, now() + interval '7 days');

  update public.venue_admin_invites
  set status = 'revoked', revoked_at = now(), revoked_by = auth.uid()
  where organization_id = p_organization_id and status = 'pending';

  insert into public.venue_admin_invites (
    organization_id, email, role, token_hash, status, expires_at,
    created_by, last_sent_at, resend_count
  ) values (
    p_organization_id, v_email, 'owner', v_hash, 'pending', v_expiry,
    auth.uid(), now(), 1
  ) returning id into v_invite_id;

  select name into v_org_name from public.organizations where id = p_organization_id;

  insert into public.platform_audit_logs (
    platform_user_id, organization_id, action, target_type, target_id, metadata
  ) values (
    auth.uid(), p_organization_id, 'venue_admin_invite_reissued', 'venue_admin_invite', v_invite_id::text,
    jsonb_build_object('email', v_email, 'expires_at', v_expiry, 'claimed_venue_allowed', true)
  );

  return jsonb_build_object(
    'ok', true,
    'invite_id', v_invite_id,
    'organization_name', v_org_name,
    'expires_at', v_expiry
  );
end;
$$;

grant execute on function public.reissue_venue_admin_invite(uuid, text, text, timestamptz) to authenticated;

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
