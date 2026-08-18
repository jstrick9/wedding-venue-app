-- Wedding Venue Intelligence Platform — generic org-scoped key-value data
-- Provider: Supabase Postgres
--
-- Stores the app's catalog/design/asset entities (venues, table specs, decor,
-- linens, chairs, wall styles, spacing, templates, guidelines, staff, vendors,
-- guest-portal data, etc.) as JSON, keyed by organization + domain. This gives
-- the EntityRepository a single RLS-scoped home for every domain without needing
-- a dedicated table per entity type. Specific relational entities (layouts,
-- events, guests, rsvp_submissions) keep their dedicated tables.

create table if not exists public.org_data (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (organization_id, domain)
);

alter table public.org_data enable row level security;

-- Org members can read/write their own org's data. This is the RLS boundary
-- that keeps one venue from ever seeing another's catalog/settings.
create policy "org_data_select_members" on public.org_data for select
  using (public.is_org_member(organization_id));
create policy "org_data_insert_members" on public.org_data for insert
  with check (public.is_org_member(organization_id));
create policy "org_data_update_members" on public.org_data for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy "org_data_delete_members" on public.org_data for delete
  using (public.is_org_member(organization_id));

-- Keep updated_at fresh.
create or replace function public.set_org_data_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_org_data_updated_at on public.org_data;
create trigger set_org_data_updated_at
  before update on public.org_data
  for each row execute function public.set_org_data_updated_at();

-- Enable cross-device catalog/couple mirror invalidation through Supabase Realtime.
do $$ begin
  alter publication supabase_realtime add table public.org_data;
exception when duplicate_object then null;
end $$;
