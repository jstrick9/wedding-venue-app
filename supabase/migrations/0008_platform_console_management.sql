-- Wedding Venue Intelligence Platform — platform console lifecycle management
--
-- Adds immutable tenant slugs, venue suspension/reactivation, managed-admin
-- invite reissue/revocation, and executive tenant metrics.

-- ---------- TENANT LIFECYCLE ----------
alter table public.organizations
  add column if not exists status text not null default 'active'
    check (status in ('provisioning','active','suspended','archived'));
alter table public.organizations
  add column if not exists suspended_at timestamptz;
alter table public.organizations
  add column if not exists suspended_by uuid references auth.users(id) on delete set null;
alter table public.organizations
  add column if not exists suspension_reason text;

update public.organizations
set status = 'active'
where status is null;

create or replace function public.prevent_organization_slug_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.slug is distinct from new.slug then
    raise exception 'organization_slug_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_organization_slug_change on public.organizations;
create trigger prevent_organization_slug_change
  before update on public.organizations
  for each row execute function public.prevent_organization_slug_change();

-- Organization membership checks now honor tenant suspension. Platform
-- administrators retain metadata access through their separate platform RLS
-- policies, but venue members cannot use a suspended workspace.
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and coalesce(o.status, 'active') = 'active'
  );
$$;

create or replace function public.has_org_role(org_id uuid, allowed_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and coalesce(o.status, 'active') = 'active'
      and m.role = any(allowed_roles)
  );
$$;

-- ---------- INVITE LIFECYCLE ----------
alter table public.venue_admin_invites
  add column if not exists revoked_at timestamptz;
alter table public.venue_admin_invites
  add column if not exists revoked_by uuid references auth.users(id) on delete set null;
alter table public.venue_admin_invites
  add column if not exists resend_count integer not null default 0;
alter table public.venue_admin_invites
  add column if not exists last_sent_at timestamptz;

-- ---------- CREATE VENUE: AUTO-GENERATED IMMUTABLE SLUG ----------
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
  v_base_slug text;
  v_slug text;
  v_suffix integer := 1;
  v_email text;
  v_token_hash text;
  v_expiry timestamptz;
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

  -- p_slug is intentionally ignored. Tenant slugs are generated from the
  -- venue name and become immutable after creation.
  v_base_slug := lower(trim(p_name));
  v_base_slug := regexp_replace(v_base_slug, '[^a-z0-9]+', '-', 'g');
  v_base_slug := regexp_replace(v_base_slug, '(^-+|-+$)', '', 'g');
  v_base_slug := left(coalesce(nullif(v_base_slug, ''), 'venue'), 64);
  v_slug := v_base_slug;

  while exists (select 1 from public.organizations o where o.slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := left(v_base_slug, 64 - length(v_suffix::text) - 1) || '-' || v_suffix::text;
  end loop;

  v_token_hash := encode(sha256(p_admin_token::bytea), 'hex');
  v_expiry := coalesce(p_expires_at, now() + interval '7 days');

  insert into public.organizations (name, slug, owner_id, status)
  values (trim(p_name), v_slug, null, 'provisioning')
  returning id into v_org_id;

  insert into public.venue_admin_invites (
    organization_id, email, role, token_hash, status, expires_at,
    created_by, last_sent_at
  ) values (
    v_org_id, v_email, 'owner', v_token_hash, 'pending', v_expiry,
    auth.uid(), now()
  );

  insert into public.platform_audit_logs (
    platform_user_id, organization_id, action, target_type, target_id, metadata
  ) values (
    auth.uid(), v_org_id, 'venue_created', 'organization', v_org_id::text,
    jsonb_build_object('name', trim(p_name), 'slug', v_slug, 'admin_email', v_email)
  );

  return jsonb_build_object(
    'ok', true,
    'organization_id', v_org_id,
    'organization_name', trim(p_name),
    'organization_slug', v_slug,
    'expires_at', v_expiry
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'venue_slug_exists');
end;
$$;

grant execute on function public.create_venue_organization(text, text, text, text, timestamptz) to authenticated;

-- ---------- INVITE CONTEXT / REISSUE / REVOCATION ----------
create or replace function public.get_venue_admin_invite_context(
  p_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.venue_admin_invites%rowtype;
  venue_name text;
  venue_slug text;
  venue_status text;
begin
  if p_token is null or length(p_token) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select vai
  into invite_row
  from public.venue_admin_invites vai
  where vai.token_hash = encode(sha256(p_token::bytea), 'hex')
    and vai.status = 'pending'
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select o.name, o.slug, coalesce(o.status, 'active')
  into venue_name, venue_slug, venue_status
  from public.organizations o
  where o.id = invite_row.organization_id;

  if invite_row.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if venue_status in ('suspended', 'archived') then
    return jsonb_build_object('ok', false, 'error', 'venue_unavailable');
  end if;

  return jsonb_build_object(
    'ok', true,
    'organization_id', invite_row.organization_id,
    'organization_name', venue_name,
    'organization_slug', venue_slug,
    'email', invite_row.email,
    'role', invite_row.role,
    'expires_at', invite_row.expires_at
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
      and o.owner_id is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'venue_already_claimed_or_unavailable');
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

  update public.organizations
  set status = 'provisioning'
  where id = p_organization_id;

  select name into v_org_name from public.organizations where id = p_organization_id;

  insert into public.platform_audit_logs (
    platform_user_id, organization_id, action, target_type, target_id, metadata
  ) values (
    auth.uid(), p_organization_id, 'venue_admin_invite_reissued', 'venue_admin_invite', v_invite_id::text,
    jsonb_build_object('email', v_email, 'expires_at', v_expiry)
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

create or replace function public.revoke_venue_admin_invite(
  p_invite_id uuid,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if not public.is_platform_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  update public.venue_admin_invites
  set status = 'revoked', revoked_at = now(), revoked_by = auth.uid()
  where id = p_invite_id and status = 'pending'
  returning organization_id into v_org_id;

  if v_org_id is null then
    return jsonb_build_object('ok', false, 'error', 'invite_not_found');
  end if;

  insert into public.platform_audit_logs (
    platform_user_id, organization_id, action, target_type, target_id, reason
  ) values (
    auth.uid(), v_org_id, 'venue_admin_invite_revoked', 'venue_admin_invite', p_invite_id::text, p_reason
  );

  return jsonb_build_object('ok', true, 'invite_id', p_invite_id);
end;
$$;

grant execute on function public.revoke_venue_admin_invite(uuid, text) to authenticated;

-- ---------- CLAIM INITIAL VENUE ADMIN AND ACTIVATE TENANT ----------
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
  v_org_slug text;
  v_org_status text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'auth_required');
  end if;
  if p_token is null or length(p_token) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_hash := encode(sha256(p_token::bytea), 'hex');
  select * into v_invite
  from public.venue_admin_invites vai
  where vai.token_hash = v_hash and vai.status = 'pending'
  for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_invite.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'expired'); end if;

  select o.name, o.slug, coalesce(o.status, 'active')
  into v_org_name, v_org_slug, v_org_status
  from public.organizations o
  where o.id = v_invite.organization_id;
  if v_org_name is null or v_org_status in ('suspended', 'archived') then
    return jsonb_build_object('ok', false, 'error', 'venue_unavailable');
  end if;

  v_email := lower(coalesce(nullif(auth.jwt()->>'email', ''), nullif(auth.email(), ''), ''));
  if v_email = '' or v_email <> lower(v_invite.email) then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  if exists (
    select 1 from public.organizations o
    where o.id = v_invite.organization_id
      and o.owner_id is not null
      and o.owner_id <> auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'error', 'venue_already_claimed');
  end if;

  update public.organizations
  set owner_id = auth.uid(), status = 'active', updated_at = now(),
      suspended_at = null, suspended_by = null, suspension_reason = null
  where id = v_invite.organization_id;

  insert into public.organization_memberships (organization_id, user_id, role, status)
  values (v_invite.organization_id, auth.uid(), v_invite.role, 'active')
  on conflict (organization_id, user_id)
  do update set role = excluded.role, status = 'active', updated_at = now();

  update public.venue_admin_invites
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
  where id = v_invite.id;

  return jsonb_build_object('ok', true, 'organization_id', v_invite.organization_id, 'organization_name', v_org_name, 'organization_slug', v_org_slug);
end;
$$;

grant execute on function public.accept_venue_admin_invite(text) to authenticated;

-- ---------- SUSPEND / REACTIVATE ----------
create or replace function public.suspend_venue_organization(
  p_organization_id uuid,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  update public.organizations
  set status = 'suspended', suspended_at = now(), suspended_by = auth.uid(), suspension_reason = nullif(trim(p_reason), '')
  where id = p_organization_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'venue_not_found');
  end if;

  update public.venue_admin_invites
  set status = 'revoked', revoked_at = now(), revoked_by = auth.uid()
  where organization_id = p_organization_id and status = 'pending';

  insert into public.platform_audit_logs (
    platform_user_id, organization_id, action, target_type, target_id, reason
  ) values (
    auth.uid(), p_organization_id, 'venue_suspended', 'organization', p_organization_id::text, p_reason
  );

  return jsonb_build_object('ok', true, 'organization_id', p_organization_id, 'status', 'suspended');
end;
$$;

grant execute on function public.suspend_venue_organization(uuid, text) to authenticated;

create or replace function public.reactivate_venue_organization(
  p_organization_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  update public.organizations
  set status = case when owner_id is null then 'provisioning' else 'active' end,
      suspended_at = null,
      suspended_by = null,
      suspension_reason = null
  where id = p_organization_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'venue_not_found');
  end if;

  insert into public.platform_audit_logs (
    platform_user_id, organization_id, action, target_type, target_id
  ) values (
    auth.uid(), p_organization_id, 'venue_reactivated', 'organization', p_organization_id::text
  );

  return jsonb_build_object(
    'ok', true,
    'organization_id', p_organization_id,
    'status', (select status from public.organizations where id = p_organization_id)
  );
end;
$$;

grant execute on function public.reactivate_venue_organization(uuid) to authenticated;

-- ---------- PUBLIC BRANDING STATUS ----------
create or replace function public.get_public_venue_branding(
  p_slug text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  venue_row public.organizations%rowtype;
  config_payload jsonb;
begin
  if p_slug is null or length(trim(p_slug)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_slug');
  end if;

  select * into venue_row
  from public.organizations o
  where lower(o.slug) = lower(trim(p_slug))
  limit 1;
  if not found then return jsonb_build_object('ok', false, 'error', 'venue_not_found'); end if;

  select d.payload into config_payload
  from public.org_data d
  where d.organization_id = venue_row.id and d.domain = 'config'
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'organization_id', venue_row.id,
    'slug', venue_row.slug,
    'status', coalesce(venue_row.status, 'active'),
    'venue_name', coalesce(nullif(config_payload->>'venueName', ''), venue_row.name),
    'tagline', coalesce(nullif(config_payload->>'tagline', ''), 'Wedding Venue Intelligence Platform'),
    'location', coalesce(config_payload->>'location', ''),
    'logo_url', coalesce(config_payload->>'logoUrl', ''),
    'website_url', coalesce(nullif(config_payload->>'websiteUrl', ''), venue_row.website_url, ''),
    'support_email', coalesce(nullif(config_payload->>'supportEmail', ''), venue_row.support_email, ''),
    'phone', coalesce(nullif(config_payload->>'phone', ''), venue_row.phone, ''),
    'primary_color', coalesce(nullif(config_payload->>'primaryColor', ''), '#4A1942'),
    'primary_dark', coalesce(nullif(config_payload->>'primaryDark', ''), '#3d1a45'),
    'primary_light', coalesce(nullif(config_payload->>'primaryLight', ''), '#6b2c5c'),
    'accent_color', coalesce(nullif(config_payload->>'accentColor', ''), '#8B5A8B'),
    'background_color', coalesce(nullif(config_payload->>'backgroundColor', ''), '#f3f4f6'),
    'text_color', coalesce(nullif(config_payload->>'textColor', ''), '#1f2937'),
    'header_text_color', coalesce(nullif(config_payload->>'headerTextColor', ''), '#FFFFFF'),
    'body_text_color', coalesce(nullif(config_payload->>'bodyTextColor', ''), '#374151'),
    'accent_text_color', coalesce(nullif(config_payload->>'accentTextColor', ''), '#4A1942'),
    'font_family', coalesce(nullif(config_payload->>'fontFamily', ''), 'Inter, system-ui, sans-serif'),
    'heading_font_family', coalesce(nullif(config_payload->>'headingFontFamily', ''), 'Inter, system-ui, sans-serif')
  );
end;
$$;

grant execute on function public.get_public_venue_branding(text) to anon, authenticated;

-- ---------- BLOCK PUBLIC LINKS FOR SUSPENDED TENANTS ----------
-- Preserve the existing token/RPC implementations behind private names and
-- place a tenant-status guard in front of every legacy token-only entry point.
alter function public.get_couple_portal_snapshot(text) rename to get_couple_portal_snapshot_unchecked;
alter function public.save_couple_portal_snapshot(text, jsonb) rename to save_couple_portal_snapshot_unchecked;
alter function public.get_guest_couple_portal_snapshot(text, text) rename to get_guest_couple_portal_snapshot_unchecked;
alter function public.submit_guest_couple_rsvp(text, text, jsonb) rename to submit_guest_couple_rsvp_unchecked;

create or replace function public.get_couple_portal_snapshot(p_token text)
returns jsonb
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
  return public.get_couple_portal_snapshot_unchecked(p_token);
end;
$$;

grant execute on function public.get_couple_portal_snapshot(text) to anon, authenticated;

create or replace function public.save_couple_portal_snapshot(p_token text, p_payload jsonb)
returns jsonb
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
  return public.save_couple_portal_snapshot_unchecked(p_token, p_payload);
end;
$$;

grant execute on function public.save_couple_portal_snapshot(text, jsonb) to anon, authenticated;

create or replace function public.get_guest_couple_portal_snapshot(p_couple_id text, p_guest_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.couple_portal_snapshots s
    join public.organizations o on o.id = s.organization_id
    where s.couple_id = p_couple_id and coalesce(o.status, 'active') = 'active'
  ) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return public.get_guest_couple_portal_snapshot_unchecked(p_couple_id, p_guest_token);
end;
$$;

grant execute on function public.get_guest_couple_portal_snapshot(text, text) to anon, authenticated;

create or replace function public.submit_guest_couple_rsvp(p_couple_id text, p_guest_token text, p_submission jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.couple_portal_snapshots s
    join public.organizations o on o.id = s.organization_id
    where s.couple_id = p_couple_id and coalesce(o.status, 'active') = 'active'
  ) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return public.submit_guest_couple_rsvp_unchecked(p_couple_id, p_guest_token, p_submission);
end;
$$;

grant execute on function public.submit_guest_couple_rsvp(text, text, jsonb) to anon, authenticated;

create or replace function public.get_couple_portal_snapshot_for_venue(
  p_venue_slug text,
  p_token text
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
      and coalesce(o.status, 'active') = 'active'
      and (
        s.couple_token_hash = encode(sha256(p_token::bytea), 'hex')
        or s.collaborator_token_hashes @> jsonb_build_array(encode(sha256(p_token::bytea), 'hex'))
      )
  ) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return public.get_couple_portal_snapshot(p_token);
end;
$$;

grant execute on function public.get_couple_portal_snapshot_for_venue(text, text) to anon, authenticated;

create or replace function public.save_couple_portal_snapshot_for_venue(
  p_venue_slug text,
  p_token text,
  p_payload jsonb
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
      and coalesce(o.status, 'active') = 'active'
      and (
        s.couple_token_hash = encode(sha256(p_token::bytea), 'hex')
        or s.collaborator_token_hashes @> jsonb_build_array(encode(sha256(p_token::bytea), 'hex'))
      )
  ) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return public.save_couple_portal_snapshot(p_token, p_payload);
end;
$$;

grant execute on function public.save_couple_portal_snapshot_for_venue(text, text, jsonb) to anon, authenticated;

create or replace function public.get_guest_couple_portal_snapshot_for_venue(
  p_venue_slug text,
  p_couple_id text,
  p_guest_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.couple_portal_snapshots s
    join public.organizations o on o.id = s.organization_id
    where s.couple_id = p_couple_id
      and lower(o.slug) = lower(trim(coalesce(p_venue_slug, '')))
      and coalesce(o.status, 'active') = 'active'
  ) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return public.get_guest_couple_portal_snapshot(p_couple_id, p_guest_token);
end;
$$;

grant execute on function public.get_guest_couple_portal_snapshot_for_venue(text, text, text) to anon, authenticated;

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
begin
  if not exists (
    select 1 from public.couple_portal_snapshots s
    join public.organizations o on o.id = s.organization_id
    where s.couple_id = p_couple_id
      and lower(o.slug) = lower(trim(coalesce(p_venue_slug, '')))
      and coalesce(o.status, 'active') = 'active'
  ) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return public.submit_guest_couple_rsvp(p_couple_id, p_guest_token, p_submission);
end;
$$;

grant execute on function public.submit_guest_couple_rsvp_for_venue(text, text, text, jsonb) to anon, authenticated;

-- ---------- EXECUTIVE PLATFORM METRICS ----------
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

  select coalesce(sum(jsonb_array_length(coalesce(d.payload->'coupleEvents', '[]'::jsonb))), 0)::integer into total_couples
  from public.org_data d join public.organizations o on o.id = d.organization_id
  where d.domain = 'coupleEvents' and coalesce(o.status, 'active') = 'active';
  select coalesce(sum(jsonb_array_length(coalesce(d.payload->'coupleGuests', '[]'::jsonb))), 0)::integer into total_guests
  from public.org_data d join public.organizations o on o.id = d.organization_id
  where d.domain = 'coupleGuests' and coalesce(o.status, 'active') = 'active';
  select coalesce(sum(jsonb_array_length(coalesce(d.payload->'coupleSubmissions', '[]'::jsonb))), 0)::integer into total_rsvps
  from public.org_data d join public.organizations o on o.id = d.organization_id
  where d.domain = 'coupleSubmissions' and coalesce(o.status, 'active') = 'active';

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
      (select coalesce(jsonb_array_length(d.payload->'coupleEvents'), 0)::integer from public.org_data d where d.organization_id = o.id and d.domain = 'coupleEvents') as couple_count,
      (select coalesce(jsonb_array_length(d.payload->'coupleGuests'), 0)::integer from public.org_data d where d.organization_id = o.id and d.domain = 'coupleGuests') as guest_count,
      (select coalesce(jsonb_array_length(d.payload->'coupleSubmissions'), 0)::integer from public.org_data d where d.organization_id = o.id and d.domain = 'coupleSubmissions') as rsvp_count,
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
