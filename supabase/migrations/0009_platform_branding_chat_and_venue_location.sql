-- Wedding Venue Intelligence Platform — platform branding, venue contact/location,
-- platform↔venue chat, and geocoding support.

-- ---------- VENUE CONTACT / ADDRESS / MAP FIELDS ----------
alter table public.organizations add column if not exists address_line1 text;
alter table public.organizations add column if not exists address_line2 text;
alter table public.organizations add column if not exists city text;
alter table public.organizations add column if not exists state_region text;
alter table public.organizations add column if not exists postal_code text;
alter table public.organizations add column if not exists country text not null default 'US';
alter table public.organizations add column if not exists primary_contact_name text;
alter table public.organizations add column if not exists primary_contact_phone text;
alter table public.organizations add column if not exists primary_contact_email text;
alter table public.organizations add column if not exists latitude numeric;
alter table public.organizations add column if not exists longitude numeric;
alter table public.organizations add column if not exists geocoded_at timestamptz;
alter table public.organizations add column if not exists geocode_provider text;

-- ---------- PLATFORM BRANDING ----------
create table if not exists public.platform_settings (
  id text primary key default 'default' check (id = 'default'),
  branding jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;
create policy "platform_settings_select_platform_admins"
  on public.platform_settings for select using (public.is_platform_admin());
create policy "platform_settings_manage_platform_admins"
  on public.platform_settings for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select, insert, update, delete on public.platform_settings to authenticated;

drop trigger if exists set_platform_settings_updated_at on public.platform_settings;
create trigger set_platform_settings_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

create or replace function public.get_public_platform_branding()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  value jsonb;
begin
  select branding into value from public.platform_settings where id = 'default';
  return jsonb_build_object(
    'ok', true,
    'branding', coalesce(value, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.get_public_platform_branding() to anon, authenticated;

create or replace function public.upsert_platform_branding(p_branding jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  insert into public.platform_settings (id, branding, updated_by)
  values ('default', coalesce(p_branding, '{}'::jsonb), auth.uid())
  on conflict (id) do update set branding = excluded.branding, updated_by = auth.uid(), updated_at = now();

  insert into public.platform_audit_logs (platform_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'platform_branding_updated', 'platform_settings', 'default', coalesce(p_branding, '{}'::jsonb));

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.upsert_platform_branding(jsonb) to authenticated;

-- ---------- PLATFORM ↔ VENUE CHAT ----------
create table if not exists public.platform_venue_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  sender_side text not null check (sender_side in ('platform','venue')),
  body text not null check (length(trim(body)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_venue_messages enable row level security;
create policy "platform_chat_select_platform_or_venue_members"
  on public.platform_venue_messages for select
  using (public.is_platform_admin() or public.is_org_member(organization_id));
create policy "platform_chat_insert_platform_or_venue_members"
  on public.platform_venue_messages for insert
  with check (
    sender_user_id = auth.uid()
    and (
      (sender_side = 'platform' and public.is_platform_admin())
      or (sender_side = 'venue' and public.is_org_member(organization_id))
    )
  );
create policy "platform_chat_update_sender_or_platform"
  on public.platform_venue_messages for update
  using (sender_user_id = auth.uid() or public.is_platform_admin())
  with check (sender_user_id = auth.uid() or public.is_platform_admin());

grant select, insert, update on public.platform_venue_messages to authenticated;
create index if not exists idx_platform_chat_org_created
  on public.platform_venue_messages (organization_id, created_at);

drop trigger if exists set_platform_chat_updated_at on public.platform_venue_messages;
create trigger set_platform_chat_updated_at
  before update on public.platform_venue_messages
  for each row execute function public.set_updated_at();

do $$ begin
  alter publication supabase_realtime add table public.platform_venue_messages;
exception when duplicate_object then null;
end $$;

create table if not exists public.platform_chat_read_markers (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

alter table public.platform_chat_read_markers enable row level security;
create policy "platform_chat_reads_select_self"
  on public.platform_chat_read_markers for select using (user_id = auth.uid());
create policy "platform_chat_reads_manage_self"
  on public.platform_chat_read_markers for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (public.is_platform_admin() or public.is_org_member(organization_id)));
grant select, insert, update, delete on public.platform_chat_read_markers to authenticated;

-- ---------- GEOCODING CACHE ----------
-- The public Nominatim service must be called server-side, slowly, with a
-- descriptive User-Agent and cached results. The Edge Function owns this table
-- using the service role; browser clients receive only final coordinates.
create table if not exists public.venue_geocode_cache (
  address_hash text primary key,
  normalized_address text not null,
  display_name text,
  latitude numeric not null,
  longitude numeric not null,
  provider text not null default 'nominatim',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.venue_geocode_cache enable row level security;
-- No anon/authenticated grants or policies: only the server-side geocoding
-- function using the service role may read/write this cache.

-- ---------- CREATE VENUE WITH REQUIRED CONTACT / ADDRESS ----------
create or replace function public.create_venue_organization_v2(
  p_name text,
  p_admin_email text,
  p_admin_token text,
  p_expires_at timestamptz,
  p_address_line1 text,
  p_address_line2 text,
  p_city text,
  p_state_region text,
  p_postal_code text,
  p_country text,
  p_primary_contact_name text,
  p_primary_contact_phone text,
  p_primary_contact_email text,
  p_latitude numeric,
  p_longitude numeric
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
  v_contact_email text;
  v_token_hash text;
  v_expiry timestamptz;
begin
  if not public.is_platform_admin() then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if p_name is null or length(trim(p_name)) < 2 then return jsonb_build_object('ok', false, 'error', 'invalid_venue_name'); end if;
  if p_address_line1 is null or length(trim(p_address_line1)) < 3 then return jsonb_build_object('ok', false, 'error', 'address_required'); end if;
  if p_city is null or length(trim(p_city)) < 2 then return jsonb_build_object('ok', false, 'error', 'city_required'); end if;
  if p_state_region is null or length(trim(p_state_region)) < 2 then return jsonb_build_object('ok', false, 'error', 'state_required'); end if;
  if p_postal_code is null or length(trim(p_postal_code)) < 3 then return jsonb_build_object('ok', false, 'error', 'postal_code_required'); end if;
  if p_primary_contact_name is null or length(trim(p_primary_contact_name)) < 2 then return jsonb_build_object('ok', false, 'error', 'contact_name_required'); end if;
  if p_primary_contact_phone is null or length(trim(p_primary_contact_phone)) < 7 then return jsonb_build_object('ok', false, 'error', 'contact_phone_required'); end if;

  v_email := lower(trim(coalesce(p_admin_email, '')));
  v_contact_email := lower(trim(coalesce(p_primary_contact_email, p_admin_email, '')));
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or v_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;
  if p_admin_token is null or length(p_admin_token) < 16 then return jsonb_build_object('ok', false, 'error', 'invalid_admin_token'); end if;

  v_base_slug := regexp_replace(regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g');
  v_base_slug := left(coalesce(nullif(v_base_slug, ''), 'venue'), 64);
  v_slug := v_base_slug;
  while exists (select 1 from public.organizations o where o.slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := left(v_base_slug, 64 - length(v_suffix::text) - 1) || '-' || v_suffix::text;
  end loop;

  v_token_hash := encode(sha256(p_admin_token::bytea), 'hex');
  v_expiry := coalesce(p_expires_at, now() + interval '7 days');

  insert into public.organizations (
    name, slug, owner_id, status, address_line1, address_line2, city,
    state_region, postal_code, country, primary_contact_name,
    primary_contact_phone, primary_contact_email, latitude, longitude,
    geocoded_at, geocode_provider
  ) values (
    trim(p_name), v_slug, null, 'provisioning', trim(p_address_line1), nullif(trim(p_address_line2), ''), trim(p_city),
    trim(p_state_region), trim(p_postal_code), coalesce(nullif(trim(p_country), ''), 'US'), trim(p_primary_contact_name),
    trim(p_primary_contact_phone), v_contact_email, p_latitude, p_longitude,
    case when p_latitude is not null and p_longitude is not null then now() else null end,
    case when p_latitude is not null and p_longitude is not null then 'nominatim' else null end
  ) returning id into v_org_id;

  insert into public.venue_admin_invites (organization_id, email, role, token_hash, status, expires_at, created_by, last_sent_at)
  values (v_org_id, v_email, 'owner', v_token_hash, 'pending', v_expiry, auth.uid(), now());

  insert into public.platform_audit_logs (platform_user_id, organization_id, action, target_type, target_id, metadata)
  values (auth.uid(), v_org_id, 'venue_created', 'organization', v_org_id::text,
    jsonb_build_object('name', trim(p_name), 'slug', v_slug, 'city', trim(p_city), 'state_region', trim(p_state_region)));

  return jsonb_build_object('ok', true, 'organization_id', v_org_id, 'organization_name', trim(p_name), 'organization_slug', v_slug, 'expires_at', v_expiry);
end;
$$;

grant execute on function public.create_venue_organization_v2(text, text, text, timestamptz, text, text, text, text, text, text, text, text, text, numeric, numeric) to authenticated;

-- ---------- PUBLIC BRANDING STORAGE ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-branding', 'public-branding', true, 10485760, array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml'])
on conflict (id) do nothing;

create policy "public_branding_read"
  on storage.objects for select
  using (bucket_id = 'public-branding');
create policy "public_branding_platform_write"
  on storage.objects for all
  using (
    bucket_id = 'public-branding'
    and (name like 'platform/%' and public.is_platform_admin())
  )
  with check (
    bucket_id = 'public-branding'
    and (name like 'platform/%' and public.is_platform_admin())
  );
create policy "public_branding_venue_write"
  on storage.objects for all
  using (
    bucket_id = 'public-branding'
    and name like 'venues/%'
    and public.has_org_role(
      split_part(name, '/', 2)::uuid,
      array['owner','admin']::public.app_role[]
    )
  )
  with check (
    bucket_id = 'public-branding'
    and name like 'venues/%'
    and public.has_org_role(
      split_part(name, '/', 2)::uuid,
      array['owner','admin']::public.app_role[]
    )
  );
