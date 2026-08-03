-- Wedding Venue Intelligence Platform backend schema
-- Provider: Supabase Postgres/Auth/Storage
-- This migration creates production tables and RLS policies for venue owners,
-- couples/planners, staff, guests, layout collaboration, object storage, and audit trails.

create extension if not exists pgcrypto;

-- ---------- ENUMS ----------
do $$ begin
  create type public.app_role as enum ('owner', 'admin', 'planner', 'couple', 'staff', 'guest');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.membership_status as enum ('invited', 'active', 'suspended', 'disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.event_status as enum ('lead', 'hold', 'booked', 'planning', 'completed', 'cancelled', 'lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.layout_visibility as enum ('private', 'event', 'venue', 'public');
exception when duplicate_object then null; end $$;

-- ---------- CORE ACCOUNT TABLES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  avatar_path text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  support_email text,
  phone text,
  website_url text,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'planner',
  status public.membership_status not null default 'active',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- ---------- VENUES / EVENTS ----------
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text not null default 'reception',
  description text,
  capacity integer not null default 0 check (capacity >= 0),
  width numeric not null default 0 check (width >= 0),
  height numeric not null default 0 check (height >= 0),
  canvas_width numeric,
  canvas_height numeric,
  shape jsonb not null default '{}'::jsonb,
  style jsonb not null default '{}'::jsonb,
  master_layout jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  slug text not null,
  status public.event_status not null default 'planning',
  start_date date,
  end_date date,
  guest_count integer not null default 0 check (guest_count >= 0),
  primary_contact_user_id uuid references auth.users(id) on delete set null,
  budget_cents integer check (budget_cents is null or budget_cents >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.event_memberships (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'couple',
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- ---------- LAYOUTS / GUESTS / PORTAL ----------
create table if not exists public.layouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete set null,
  name text not null,
  visibility public.layout_visibility not null default 'event',
  revision integer not null default 1 check (revision > 0),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.layout_versions (
  id uuid primary key default gen_random_uuid(),
  layout_id uuid not null references public.layouts(id) on delete cascade,
  revision integer not null,
  payload jsonb not null,
  change_description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (layout_id, revision)
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  party_name text,
  rsvp_status text not null default 'pending',
  dietary_restrictions text,
  accessibility_notes text,
  table_assignment text,
  room_assignment text,
  plus_one_allowed boolean not null default false,
  portal_token_hash text,
  portal_access jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rsvp_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid references public.guests(id) on delete set null,
  attending boolean not null,
  attending_days text[] not null default '{}',
  meal_choice text,
  plus_one_name text,
  plus_one_meal_choice text,
  dietary_notes text,
  special_needs text,
  notes text,
  submitted_at timestamptz not null default now(),
  submitted_ip inet,
  user_agent text
);

create table if not exists public.guest_portal_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade unique,
  enabled boolean not null default false,
  password_hash text,
  password_salt text,
  access_starts_at timestamptz,
  access_ends_at timestamptz,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- INTELLIGENCE / OPERATIONS ----------
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  name text not null,
  category text not null default 'other',
  contact_name text,
  email text,
  phone text,
  website_url text,
  contract_amount_cents integer check (contract_amount_cents is null or contract_amount_cents >= 0),
  is_preferred boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  category text not null default 'other',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  notes text,
  completed boolean not null default false,
  assigned_to uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  title text not null,
  description text,
  area text,
  due_at timestamptz,
  completed_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  question text not null,
  group_name text not null default 'Other',
  answer_type text not null default 'text',
  options jsonb not null default '[]'::jsonb,
  workflow jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_answers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  question_id uuid not null references public.event_questions(id) on delete cascade,
  answered_by uuid references auth.users(id) on delete set null,
  answer_value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, question_id, answered_by)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

-- ---------- UPDATED_AT TRIGGER ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','organizations','organization_memberships','venues','events','layouts',
    'guests','guest_portal_configs','vendors','timeline_events','staff_tasks',
    'event_questions','event_answers'
  ] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', t, t);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------- SECURITY HELPERS ----------
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
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
    select 1 from public.organization_memberships m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(allowed_roles)
  );
$$;

create or replace function public.is_event_member(evt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = evt_id
      and (
        public.is_org_member(e.organization_id)
        or exists (
          select 1 from public.event_memberships em
          where em.event_id = evt_id
            and em.user_id = auth.uid()
            and em.status = 'active'
        )
      )
  );
$$;

-- ---------- ENABLE RLS ----------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.venues enable row level security;
alter table public.events enable row level security;
alter table public.event_memberships enable row level security;
alter table public.layouts enable row level security;
alter table public.layout_versions enable row level security;
alter table public.guests enable row level security;
alter table public.rsvp_submissions enable row level security;
alter table public.guest_portal_configs enable row level security;
alter table public.vendors enable row level security;
alter table public.timeline_events enable row level security;
alter table public.staff_tasks enable row level security;
alter table public.event_questions enable row level security;
alter table public.event_answers enable row level security;
alter table public.audit_logs enable row level security;

-- ---------- RLS POLICIES ----------
-- Profiles
create policy "profiles_select_own_or_org" on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from public.organization_memberships a
    join public.organization_memberships b on b.organization_id = a.organization_id
    where a.user_id = auth.uid() and a.status = 'active' and b.user_id = profiles.id and b.status = 'active'
  )
);
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert with check (id = auth.uid());

-- Organizations and memberships
create policy "org_select_members" on public.organizations for select using (public.is_org_member(id) or owner_id = auth.uid());
create policy "org_insert_owner" on public.organizations for insert with check (owner_id = auth.uid());
create policy "org_update_admins" on public.organizations for update using (public.has_org_role(id, array['owner','admin']::public.app_role[])) with check (public.has_org_role(id, array['owner','admin']::public.app_role[]));

create policy "membership_select_members" on public.organization_memberships for select using (public.is_org_member(organization_id));
create policy "membership_manage_admins" on public.organization_memberships for all using (public.has_org_role(organization_id, array['owner','admin']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner','admin']::public.app_role[]));

-- Organization-scoped tables
create policy "venues_select_members" on public.venues for select using (public.is_org_member(organization_id));
create policy "venues_manage_admins" on public.venues for all using (public.has_org_role(organization_id, array['owner','admin']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner','admin']::public.app_role[]));

create policy "events_select_members" on public.events for select using (public.is_org_member(organization_id) or public.is_event_member(id));
create policy "events_manage_staff" on public.events for all using (public.has_org_role(organization_id, array['owner','admin','planner']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner','admin','planner']::public.app_role[]));

create policy "event_memberships_select" on public.event_memberships for select using (public.is_event_member(event_id));
create policy "event_memberships_manage_org_admins" on public.event_memberships for all using (
  exists (select 1 from public.events e where e.id = event_id and public.has_org_role(e.organization_id, array['owner','admin','planner']::public.app_role[]))
) with check (
  exists (select 1 from public.events e where e.id = event_id and public.has_org_role(e.organization_id, array['owner','admin','planner']::public.app_role[]))
);

create policy "layouts_select_event_members" on public.layouts for select using (public.is_org_member(organization_id) or (event_id is not null and public.is_event_member(event_id)));
create policy "layouts_manage_event_planners" on public.layouts for all using (public.has_org_role(organization_id, array['owner','admin','planner','staff']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner','admin','planner','staff']::public.app_role[]));

create policy "layout_versions_select_layout_access" on public.layout_versions for select using (
  exists (select 1 from public.layouts l where l.id = layout_id and (public.is_org_member(l.organization_id) or (l.event_id is not null and public.is_event_member(l.event_id))))
);
create policy "layout_versions_insert_layout_managers" on public.layout_versions for insert with check (
  exists (select 1 from public.layouts l where l.id = layout_id and public.has_org_role(l.organization_id, array['owner','admin','planner','staff']::public.app_role[]))
);

create policy "guests_select_event_members" on public.guests for select using (public.is_org_member(organization_id) or public.is_event_member(event_id));
create policy "guests_manage_planners" on public.guests for all using (public.has_org_role(organization_id, array['owner','admin','planner','staff']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner','admin','planner','staff']::public.app_role[]));

create policy "rsvp_select_event_members" on public.rsvp_submissions for select using (public.is_org_member(organization_id) or public.is_event_member(event_id));
create policy "rsvp_insert_event_members" on public.rsvp_submissions for insert with check (public.is_org_member(organization_id) or public.is_event_member(event_id));
create policy "rsvp_update_planners" on public.rsvp_submissions for update using (public.has_org_role(organization_id, array['owner','admin','planner']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner','admin','planner']::public.app_role[]));

create policy "portal_config_select_event_members" on public.guest_portal_configs for select using (public.is_org_member(organization_id) or public.is_event_member(event_id));
create policy "portal_config_manage_admins" on public.guest_portal_configs for all using (public.has_org_role(organization_id, array['owner','admin','planner']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner','admin','planner']::public.app_role[]));

create policy "vendors_select_members" on public.vendors for select using (public.is_org_member(organization_id) or (event_id is not null and public.is_event_member(event_id)));
create policy "vendors_manage_planners" on public.vendors for all using (public.has_org_role(organization_id, array['owner','admin','planner']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner','admin','planner']::public.app_role[]));

create policy "timeline_select_members" on public.timeline_events for select using (public.is_org_member(organization_id) or public.is_event_member(event_id));
create policy "timeline_manage_staff" on public.timeline_events for all using (public.has_org_role(organization_id, array['owner','admin','planner','staff']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner','admin','planner','staff']::public.app_role[]));

create policy "tasks_select_members" on public.staff_tasks for select using (public.is_org_member(organization_id) or (event_id is not null and public.is_event_member(event_id)));
create policy "tasks_manage_staff" on public.staff_tasks for all using (public.has_org_role(organization_id, array['owner','admin','planner','staff']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner','admin','planner','staff']::public.app_role[]));

create policy "questions_select_members" on public.event_questions for select using (public.is_org_member(organization_id));
create policy "questions_manage_admins" on public.event_questions for all using (public.has_org_role(organization_id, array['owner','admin','planner']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner','admin','planner']::public.app_role[]));

create policy "answers_select_event_members" on public.event_answers for select using (public.is_event_member(event_id));
create policy "answers_manage_event_members" on public.event_answers for all using (public.is_event_member(event_id)) with check (public.is_event_member(event_id));

create policy "audit_select_admins" on public.audit_logs for select using (organization_id is null or public.has_org_role(organization_id, array['owner','admin']::public.app_role[]));
create policy "audit_insert_members" on public.audit_logs for insert with check (organization_id is null or public.is_org_member(organization_id));

-- ---------- STORAGE BUCKETS ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('venue-images', 'venue-images', false, 10485760, array['image/png','image/jpeg','image/webp','image/gif']),
  ('event-documents', 'event-documents', false, 26214400, array['application/pdf','image/png','image/jpeg','image/webp','text/csv','application/json']),
  ('user-avatars', 'user-avatars', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy "storage_venue_images_select_members" on storage.objects for select using (
  bucket_id = 'venue-images'
  and exists (
    select 1 from public.organization_memberships m
    where m.organization_id::text = split_part(name, '/', 1)
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);
create policy "storage_venue_images_write_admins" on storage.objects for all using (
  bucket_id = 'venue-images'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['owner','admin','planner']::public.app_role[])
) with check (
  bucket_id = 'venue-images'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['owner','admin','planner']::public.app_role[])
);

create policy "storage_event_docs_select_members" on storage.objects for select using (
  bucket_id = 'event-documents'
  and exists (
    select 1 from public.events e
    where e.id::text = split_part(name, '/', 2)
      and (public.is_org_member(e.organization_id) or public.is_event_member(e.id))
  )
);
create policy "storage_event_docs_write_planners" on storage.objects for all using (
  bucket_id = 'event-documents'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['owner','admin','planner','staff']::public.app_role[])
) with check (
  bucket_id = 'event-documents'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['owner','admin','planner','staff']::public.app_role[])
);

create policy "storage_avatars_select_org_members" on storage.objects for select using (
  bucket_id = 'user-avatars'
  and (auth.uid()::text = split_part(name, '/', 1)
    or exists (
      select 1 from public.organization_memberships a
      join public.organization_memberships b on b.organization_id = a.organization_id
      where a.user_id = auth.uid() and b.user_id::text = split_part(name, '/', 1)
    ))
);
create policy "storage_avatars_write_own" on storage.objects for all using (
  bucket_id = 'user-avatars' and auth.uid()::text = split_part(name, '/', 1)
) with check (
  bucket_id = 'user-avatars' and auth.uid()::text = split_part(name, '/', 1)
);

-- ---------- PROFILE BOOTSTRAP ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- INDEXES ----------
-- Performance: every org-scoped query and the email rate-limiter joins on
-- these columns. Without indexes these degrade quickly as data grows.
create index if not exists idx_org_memberships_org on public.organization_memberships (organization_id);
create index if not exists idx_org_memberships_user on public.organization_memberships (user_id);
create index if not exists idx_orgs_owner on public.organizations (owner_id);
create index if not exists idx_venues_org on public.venues (organization_id);
create index if not exists idx_events_org on public.events (organization_id);
create index if not exists idx_event_memberships_event on public.event_memberships (event_id);
create index if not exists idx_event_memberships_user on public.event_memberships (user_id);
create index if not exists idx_layouts_org on public.layouts (organization_id);
create index if not exists idx_layouts_event on public.layouts (event_id);
create index if not exists idx_layouts_venue on public.layouts (venue_id);
create index if not exists idx_layout_versions_layout on public.layout_versions (layout_id);
create index if not exists idx_guests_org on public.guests (organization_id);
create index if not exists idx_guests_event on public.guests (event_id);
create index if not exists idx_rsvp_org on public.rsvp_submissions (organization_id);
create index if not exists idx_rsvp_event on public.rsvp_submissions (event_id);
create index if not exists idx_rsvp_guest on public.rsvp_submissions (guest_id);
create index if not exists idx_portal_config_event on public.guest_portal_configs (event_id);
create index if not exists idx_vendors_org on public.vendors (organization_id);
create index if not exists idx_vendors_event on public.vendors (event_id);
create index if not exists idx_timeline_org on public.timeline_events (organization_id);
create index if not exists idx_timeline_event on public.timeline_events (event_id);
create index if not exists idx_staff_tasks_org on public.staff_tasks (organization_id);
create index if not exists idx_staff_tasks_event on public.staff_tasks (event_id);
create index if not exists idx_questions_org on public.event_questions (organization_id);
create index if not exists idx_answers_event on public.event_answers (event_id);
create index if not exists idx_answers_question on public.event_answers (question_id);
create index if not exists idx_audit_org on public.audit_logs (organization_id);
create index if not exists idx_audit_actor on public.audit_logs (actor_id);
create index if not exists idx_audit_created on public.audit_logs (created_at);
