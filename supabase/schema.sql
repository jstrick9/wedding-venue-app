-- Enable Row Level Security
alter database postgres set "app.jwt_secret" to 'your-jwt-secret-here';

-- ==================== USERS ====================
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  role text not null check (role in ('super_admin', 'venue_owner', 'planner', 'staff', 'guest')),
  business_id uuid references businesses(id),
  created_at timestamp with time zone default now()
);

-- ==================== BUSINESSES (Multi-Tenant) ====================
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  primary_color text default '#1e40af',
  custom_domain text unique,
  created_at timestamp with time zone default now()
);

-- ==================== VENUES ====================
create table if not exists venues (
  id text primary key,
  business_id uuid references businesses(id),
  name text not null,
  width numeric not null,
  height numeric not null,
  capacity integer not null,
  category text not null,
  shape text not null,
  fire_code_capacity integer,
  created_at timestamp with time zone default now()
);

-- ==================== LAYOUTS ====================
create table if not exists layouts (
  id text primary key,
  venue_id text references venues(id),
  name text not null,
  tables jsonb not null default '[]',
  fixtures jsonb not null default '[]',
  decor jsonb not null default '[]',
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- ==================== GUESTS ====================
create table if not exists guests (
  id text primary key,
  layout_id text references layouts(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  group_name text,
  table_id text,
  room_id text,
  rsvp_status text check (rsvp_status in ('pending', 'confirmed', 'declined')),
  dietary_restrictions text,
  plus_one boolean default false,
  created_at timestamp with time zone default now()
);

-- ==================== LAYOUT VERSIONS (History) ====================
create table if not exists layout_versions (
  id text primary key,
  layout_id text references layouts(id) on delete cascade,
  snapshot jsonb not null,
  created_by uuid references users(id),
  created_at timestamp with time zone default now(),
  description text
);

-- ==================== ROW LEVEL SECURITY ====================
alter table layouts enable row level security;
alter table guests enable row level security;
alter table venues enable row level security;

-- Users can only see layouts from their business
create policy "Users can view own business layouts"
  on layouts for select
  using (
    venue_id in (
      select id from venues where business_id = (
        select business_id from users where id = auth.uid()
      )
    )
  );

-- Super admins can see everything
create policy "Super admins can view all"
  on layouts for all
  using (
    exists (
      select 1 from users where id = auth.uid() and role = 'super_admin'
    )
  );

-- ==================== REALTIME ====================
alter publication supabase_realtime add table layouts;
alter publication supabase_realtime add table guests;

-- ==================== INDEXES ====================
create index idx_layouts_venue on layouts(venue_id);
create index idx_guests_layout on guests(layout_id);
create index idx_guests_table on guests(table_id);
create index idx_versions_layout on layout_versions(layout_id);