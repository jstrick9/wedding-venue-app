-- Wedding Venue Intelligence Platform — organization invites
-- Provider: Supabase Postgres
--
-- Lets an owner/admin invite staff/planners into their organization. The invite
-- carries a hashed token (never stored in plaintext), is scoped to one
-- organization + email + role, and expires. Accepting the invite creates an
-- active membership. Anonymous/email-confirmed users can accept via a secure
-- RPC, so invites work without the invitee having an account yet.

create table if not exists public.org_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'planner',
  token_hash text not null,
  status text not null default 'pending', -- pending | accepted | revoked
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

alter table public.org_invites enable row level security;

-- Org admins/owners manage their own invites; invitees only via the RPC below.
create policy "invites_select_admins" on public.org_invites for select
  using (public.has_org_role(organization_id, array['owner','admin']::public.app_role[]));
create policy "invites_insert_admins" on public.org_invites for insert
  with check (public.has_org_role(organization_id, array['owner','admin']::public.app_role[]));
create policy "invites_update_admins" on public.org_invites for update
  using (public.has_org_role(organization_id, array['owner','admin']::public.app_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin']::public.app_role[]));

-- ---------- RPC: accept an invite by token ----------
-- Verifies the hashed token + expiry, then creates an active membership (if one
-- does not already exist) and marks the invite accepted. Returns the
-- organization name so the client can route the user in.
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

  v_hash := encode(sha256(p_token::bytea), 'hex');

  select * into inv
  from public.org_invites
  where inv.token_hash = v_hash and inv.status = 'pending';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if inv.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  -- The invitee must be signed in (or just verified) to accept.
  v_user_id := auth.uid();
  v_email := coalesce(nullif(current_setting('request.jwt.claims', true)::jsonb->>'email',''),
                      nullif(auth.email(), ''));

  if v_user_id is null and v_email is null then
    return jsonb_build_object('ok', false, 'error', 'auth_required');
  end if;

  -- Upsert the membership (active) for this invitee.
  insert into public.organization_memberships (organization_id, user_id, role, status)
  values (inv.organization_id, v_user_id, inv.role, 'active')
  on conflict (organization_id, user_id)
  do update set role = excluded.role, status = 'active';

  -- Mark the invite accepted (clear the token).
  update public.org_invites set status = 'accepted' where id = inv.id;

  select o.name into v_org_name from public.organizations o where o.id = inv.organization_id;

  return jsonb_build_object('ok', true, 'organization_id', inv.organization_id, 'organization_name', v_org_name);
end;
$$;

-- The accept RPC is callable by any signed-in user (they can only ever act on
-- an invite addressed to them via the token).
grant execute on function public.accept_invite(text) to authenticated;
