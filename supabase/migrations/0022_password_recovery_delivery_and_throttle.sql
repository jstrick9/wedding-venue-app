-- Wedding Venue Intelligence Platform — Review #274
-- Branded, self-service password recovery abuse controls.
--
-- Password-reset requests are made before a user has a session. The public
-- request endpoint uses the service role, and this table/RPC are intentionally
-- inaccessible to anon and authenticated clients. Only keyed one-way hashes are
-- retained; raw email addresses and network addresses are never stored here.

create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  requester_hash text not null check (requester_hash ~ '^[0-9a-f]{64}$'),
  surface text not null check (surface in ('platform', 'venue')),
  organization_id uuid references public.organizations(id) on delete set null,
  delivery_state text not null default 'pending'
    check (delivery_state in ('pending', 'skipped', 'sent', 'failed')),
  failure_code text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists password_reset_requests_email_recent_idx
  on public.password_reset_requests (email_hash, requested_at desc);
create index if not exists password_reset_requests_requester_recent_idx
  on public.password_reset_requests (requester_hash, requested_at desc);
create index if not exists password_reset_requests_requested_at_idx
  on public.password_reset_requests (requested_at desc);

alter table public.password_reset_requests enable row level security;
revoke all on table public.password_reset_requests from public, anon, authenticated;
grant all on table public.password_reset_requests to service_role;

comment on table public.password_reset_requests is
  'Service-only, hashed password-recovery throttle and delivery audit. Contains no raw email or network address.';

create or replace function public.begin_password_reset_request(
  p_email_hash text,
  p_requester_hash text,
  p_surface text,
  p_organization_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_email_count integer;
  v_requester_count integer;
  v_global_count integer;
begin
  if p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$'
     or p_requester_hash is null or p_requester_hash !~ '^[0-9a-f]{64}$'
     or p_surface is null or p_surface not in ('platform', 'venue') then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;

  -- Use one consistent lock order so parallel submissions cannot step through
  -- any global, requester, or account threshold together. Password recovery is
  -- low-volume; serializing this short count/insert transaction is intentional.
  perform pg_advisory_xact_lock(hashtext('password-reset:global'));
  perform pg_advisory_xact_lock(hashtext('password-reset:requester:' || p_requester_hash));
  perform pg_advisory_xact_lock(hashtext('password-reset:email:' || p_email_hash));

  delete from public.password_reset_requests
  where requested_at < now() - interval '7 days';

  select count(*) into v_email_count
  from public.password_reset_requests
  where email_hash = p_email_hash
    and requested_at >= now() - interval '15 minutes';

  select count(*) into v_requester_count
  from public.password_reset_requests
  where requester_hash = p_requester_hash
    and requested_at >= now() - interval '1 hour';

  select count(*) into v_global_count
  from public.password_reset_requests
  where requested_at >= now() - interval '1 hour';

  if v_email_count >= 3 or v_requester_count >= 30 or v_global_count >= 1000 then
    return jsonb_build_object('ok', true, 'allowed', false);
  end if;

  insert into public.password_reset_requests (
    email_hash,
    requester_hash,
    surface,
    organization_id
  ) values (
    p_email_hash,
    p_requester_hash,
    p_surface,
    case when p_surface = 'venue' then p_organization_id else null end
  ) returning id into v_request_id;

  return jsonb_build_object(
    'ok', true,
    'allowed', true,
    'request_id', v_request_id
  );
end;
$$;

revoke execute on function public.begin_password_reset_request(text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.begin_password_reset_request(text, text, text, uuid)
  to service_role;

comment on function public.begin_password_reset_request(text, text, text, uuid) is
  'Service-only atomic password-reset throttle. Returns no account-existence information.';

create or replace function public.get_password_reset_account_context(
  p_email text,
  p_surface text,
  p_organization_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_email text;
  v_full_name text;
  v_organization_name text;
  v_organization_slug text;
  v_platform_branding jsonb;
begin
  if p_email is null or length(trim(p_email)) < 3
     or p_surface is null or p_surface not in ('platform', 'venue') then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;

  select u.id, lower(u.email), coalesce(nullif(trim(p.full_name), ''), '')
  into v_user_id, v_email, v_full_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    return jsonb_build_object('ok', true, 'eligible', false);
  end if;

  if p_surface = 'platform' then
    if not exists (
      select 1
      from public.platform_memberships pm
      where pm.user_id = v_user_id
        and pm.status = 'active'
    ) then
      return jsonb_build_object('ok', true, 'eligible', false);
    end if;

    select coalesce(ps.branding, '{}'::jsonb)
    into v_platform_branding
    from public.platform_settings ps
    where ps.id = 'default';

    return jsonb_build_object(
      'ok', true,
      'eligible', true,
      'user_id', v_user_id,
      'email', v_email,
      'full_name', v_full_name,
      'display_name', coalesce(nullif(v_platform_branding->>'venueName', ''), 'Wedding Venue Intelligence Platform')
    );
  end if;

  if p_organization_id is null then
    return jsonb_build_object('ok', true, 'eligible', false);
  end if;

  select o.name, o.slug
  into v_organization_name, v_organization_slug
  from public.organizations o
  where o.id = p_organization_id
    and coalesce(o.status, 'active') not in ('suspended', 'archived')
    and exists (
      select 1
      from public.organization_memberships om
      where om.organization_id = o.id
        and om.user_id = v_user_id
        and om.status = 'active'
    );

  if v_organization_slug is null then
    return jsonb_build_object('ok', true, 'eligible', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'eligible', true,
    'user_id', v_user_id,
    'email', v_email,
    'full_name', v_full_name,
    'organization_id', p_organization_id,
    'organization_slug', v_organization_slug,
    'display_name', v_organization_name
  );
end;
$$;

revoke execute on function public.get_password_reset_account_context(text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.get_password_reset_account_context(text, text, uuid)
  to service_role;

comment on function public.get_password_reset_account_context(text, text, uuid) is
  'Service-only account and membership lookup for password recovery. Public callers receive no existence oracle.';
