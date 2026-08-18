-- Wedding Venue Intelligence Platform — platform tenancy and venue onboarding
-- Provider: Supabase Postgres/Auth
--
-- This migration adds a platform-control layer above venue organizations.
-- A platform administrator can create venue organizations and issue a one-time
-- setup invite to the first managed venue administrator. Venue administrators
-- remain scoped to their own organization through organization_memberships.
--
-- The platform role is intentionally separate from the venue role. A Supabase
-- Auth user can be both a platform owner and a venue owner, which is useful for
-- the first operator of a single-venue deployment.

-- A new venue is created before its first venue-admin Auth user exists. The
-- platform admin therefore creates the organization with owner_id = null, and
-- the accepted onboarding invite claims the owner_id transactionally.
alter table public.organizations
  alter column owner_id drop not null;

-- ---------- PLATFORM ROLES ----------
do $$ begin
  create type public.platform_role as enum (
    'platform_owner',
    'platform_admin',
    'platform_support'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.platform_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.platform_role not null default 'platform_admin',
  status public.membership_status not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.platform_memberships enable row level security;

-- ---------- PLATFORM SECURITY HELPERS ----------
create or replace function public.has_platform_role(
  allowed_roles public.platform_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_memberships pm
    where pm.user_id = auth.uid()
      and pm.status = 'active'
      and pm.role = any(allowed_roles)
  );
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_platform_role(
    array['platform_owner','platform_admin']::public.platform_role[]
  );
$$;

create or replace function public.is_platform_support()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_platform_role(
    array['platform_owner','platform_admin','platform_support']::public.platform_role[]
  );
$$;

-- ---------- PLATFORM MEMBERSHIP RLS ----------
create policy "platform_memberships_select_self_or_admin"
  on public.platform_memberships for select
  using (
    user_id = auth.uid()
    or public.is_platform_admin()
  );

create policy "platform_memberships_manage_platform_admins"
  on public.platform_memberships for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------- PLATFORM METADATA ACCESS ----------
-- Platform administrators may manage tenant metadata and memberships, but are
-- not granted broad access to org_data or private couple snapshots. Those data
-- domains remain protected by their existing organization/event RLS policies.
create policy "organizations_select_platform_admins"
  on public.organizations for select
  using (public.is_platform_admin());

create policy "organizations_manage_platform_admins"
  on public.organizations for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "membership_select_platform_admins"
  on public.organization_memberships for select
  using (public.is_platform_admin());

create policy "membership_manage_platform_admins"
  on public.organization_memberships for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "profiles_select_platform_admins"
  on public.profiles for select
  using (public.is_platform_admin());

create policy "invites_select_platform_admins"
  on public.org_invites for select
  using (public.is_platform_admin());

-- ---------- AUDITED PLATFORM SUPPORT ACCESS FOUNDATION ----------
-- This audit stream records future break-glass/support actions. It does not
-- itself grant platform administrators access to tenant business data.
create table if not exists public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  platform_user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.platform_audit_logs enable row level security;

create policy "platform_audit_select_platform_admins"
  on public.platform_audit_logs for select
  using (public.is_platform_support());

create policy "platform_audit_insert_platform_admins"
  on public.platform_audit_logs for insert
  with check (
    platform_user_id = auth.uid()
    and public.is_platform_support()
  );

create index if not exists idx_platform_memberships_user
  on public.platform_memberships (user_id);
create index if not exists idx_platform_memberships_status
  on public.platform_memberships (status);
create index if not exists idx_platform_audit_org
  on public.platform_audit_logs (organization_id);
create index if not exists idx_platform_audit_created
  on public.platform_audit_logs (created_at);

drop trigger if exists set_platform_memberships_updated_at on public.platform_memberships;
create trigger set_platform_memberships_updated_at
  before update on public.platform_memberships
  for each row execute function public.set_updated_at();

-- ---------- VENUE ADMIN ONBOARDING INVITES ----------
create table if not exists public.venue_admin_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'owner',
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending','accepted','revoked')),
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.venue_admin_invites enable row level security;

create policy "venue_admin_invites_select_platform_admins"
  on public.venue_admin_invites for select
  using (public.is_platform_admin());

create policy "venue_admin_invites_manage_platform_admins"
  on public.venue_admin_invites for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create index if not exists idx_venue_admin_invites_org
  on public.venue_admin_invites (organization_id);
create index if not exists idx_venue_admin_invites_status
  on public.venue_admin_invites (status);
create index if not exists idx_venue_admin_invites_expires
  on public.venue_admin_invites (expires_at);

-- PostgREST table privileges are still constrained by the RLS policies above.
grant select, insert, update, delete on public.platform_memberships to authenticated;
grant select, insert, update, delete on public.platform_audit_logs to authenticated;
grant select, insert, update, delete on public.venue_admin_invites to authenticated;

-- ---------- PLATFORM RPC: CREATE A VENUE + INITIAL ADMIN INVITE ----------
create or replace function public.create_venue_organization(
  p_name text,
  p_slug text,
  p_admin_email text,
  p_admin_token text,
  p_expires_at timestamptz default (now() + interval '7 days')
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_slug text;
  v_email text;
  v_token_hash text;
begin
  if not public.is_platform_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_name is null or length(trim(p_name)) < 2 then
    return jsonb_build_object('ok', false, 'error', 'invalid_venue_name');
  end if;

  v_email := lower(trim(coalesce(p_admin_email, '')));
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_admin_email');
  end if;

  if p_admin_token is null or length(p_admin_token) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_admin_token');
  end if;

  v_slug := lower(trim(coalesce(p_slug, '')));
  if v_slug = '' then
    v_slug := 'venue-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
  end if;
  v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');
  if v_slug = '' then
    v_slug := 'venue-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
  end if;

  if exists (select 1 from public.organizations o where o.slug = v_slug) then
    return jsonb_build_object('ok', false, 'error', 'venue_slug_exists');
  end if;

  v_token_hash := encode(sha256(p_admin_token::bytea), 'hex');

  insert into public.organizations (
    name,
    slug,
    owner_id
  ) values (
    trim(p_name),
    v_slug,
    null
  )
  returning id into v_org_id;

  insert into public.venue_admin_invites (
    organization_id,
    email,
    role,
    token_hash,
    status,
    expires_at,
    created_by
  ) values (
    v_org_id,
    v_email,
    'owner',
    v_token_hash,
    'pending',
    coalesce(p_expires_at, now() + interval '7 days'),
    auth.uid()
  );

  return jsonb_build_object(
    'ok', true,
    'organization_id', v_org_id,
    'organization_name', trim(p_name),
    'organization_slug', v_slug,
    'expires_at', coalesce(p_expires_at, now() + interval '7 days')
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'venue_slug_exists');
end;
$$;

-- ---------- PUBLIC AUTHENTICATED RPC: CLAIM INITIAL VENUE ADMIN ----------
create or replace function public.accept_venue_admin_invite(
  p_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_invite public.venue_admin_invites%rowtype;
  v_email text;
  v_org_name text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'auth_required');
  end if;

  if p_token is null or length(p_token) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_hash := encode(sha256(p_token::bytea), 'hex');

  select *
  into v_invite
  from public.venue_admin_invites vai
  where vai.token_hash = v_hash
    and vai.status = 'pending'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_invite.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  v_email := lower(coalesce(nullif(auth.jwt()->>'email', ''), nullif(auth.email(), ''), ''));
  if v_email = '' or v_email <> lower(v_invite.email) then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  if exists (
    select 1
    from public.organizations o
    where o.id = v_invite.organization_id
      and o.owner_id is not null
      and o.owner_id <> auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'error', 'venue_already_claimed');
  end if;

  update public.organizations
  set owner_id = auth.uid(), updated_at = now()
  where id = v_invite.organization_id;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status
  ) values (
    v_invite.organization_id,
    auth.uid(),
    v_invite.role,
    'active'
  )
  on conflict (organization_id, user_id)
  do update set
    role = excluded.role,
    status = 'active',
    updated_at = now();

  update public.venue_admin_invites
  set status = 'accepted',
      accepted_by = auth.uid(),
      accepted_at = now()
  where id = v_invite.id;

  select name into v_org_name
  from public.organizations
  where id = v_invite.organization_id;

  return jsonb_build_object(
    'ok', true,
    'organization_id', v_invite.organization_id,
    'organization_name', v_org_name
  );
end;
$$;

grant execute on function public.create_venue_organization(text, text, text, text, timestamptz) to authenticated;
grant execute on function public.accept_venue_admin_invite(text) to authenticated;

-- ---------- HARDEN EXISTING ORGANIZATION INVITE ACCEPTANCE ----------
-- The original invite RPC allowed a token holder to accept an invite without
-- checking the Auth email and could continue with a null auth.uid(). Replace it
-- while this tenant-control migration is being applied.
create or replace function public.accept_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  inv public.org_invites%rowtype;
  v_org_name text;
  v_user_id uuid;
  v_email text;
begin
  if p_token is null or length(p_token) < 8 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'auth_required');
  end if;

  v_hash := encode(sha256(p_token::bytea), 'hex');

  select * into inv
  from public.org_invites
  where token_hash = v_hash
    and status = 'pending';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if inv.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  v_email := lower(coalesce(nullif(auth.jwt()->>'email', ''), nullif(auth.email(), ''), ''));
  if v_email = '' or v_email <> lower(inv.email) then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  insert into public.organization_memberships (organization_id, user_id, role, status)
  values (inv.organization_id, v_user_id, inv.role, 'active')
  on conflict (organization_id, user_id)
  do update set role = excluded.role, status = 'active', updated_at = now();

  update public.org_invites
  set status = 'accepted'
  where id = inv.id;

  select name into v_org_name
  from public.organizations
  where id = inv.organization_id;

  return jsonb_build_object(
    'ok', true,
    'organization_id', inv.organization_id,
    'organization_name', v_org_name
  );
end;
$$;

grant execute on function public.accept_invite(text) to authenticated;
