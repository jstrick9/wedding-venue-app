-- Make a published Venue Map base image an exact, existing storage dependency.
--
-- Managed-looking path text alone does not prove that an object exists. A stale
-- or manually deleted object left portals drawing spatial vectors over a blank
-- plane. Existing canonical references are not rewritten: portal reads expose
-- only an availability marker, while the admin keeps the original reference for
-- recovery. Future publication requires the exact object, and that currently
-- published object cannot be deleted or renamed until the map is changed first.

create or replace function public.venue_map_image_object_exists(
  p_ref text,
  p_organization_id uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_prefix text;
  v_object_name text;
begin
  if p_ref is null or p_organization_id is null then
    return false;
  end if;

  v_prefix := 'sp://venue-map-images/' || p_organization_id::text || '/';
  if left(p_ref, length(v_prefix)) <> v_prefix then
    return false;
  end if;

  v_object_name := substring(p_ref from length('sp://venue-map-images/') + 1);
  if length(p_ref) > 1100
     or length(v_object_name) not between 1 and 1024
     or v_object_name !~ ('^' || p_organization_id::text || '/[^/?#[:cntrl:]]+$') then
    return false;
  end if;

  return exists (
    select 1
    from storage.objects as object
    where object.bucket_id = 'venue-map-images'
      and object.name = v_object_name
  );
end;
$$;

revoke all on function public.venue_map_image_object_exists(text, uuid)
  from public, anon, authenticated;

-- Replaces migration 0029's format-only sanitizer. Never return an unavailable
-- or unmanaged reference to a portal. The boolean lets the white-labelled UI
-- distinguish a deliberately image-free schematic from a broken published base.
create or replace function public.sanitize_portal_venue_map_base_image(
  p_map jsonb,
  p_organization_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_ref text;
begin
  if jsonb_typeof(p_map) <> 'object' then
    return p_map;
  end if;

  v_ref := p_map->>'backgroundImageUrl';
  if v_ref is null then
    return p_map - 'backgroundImageUnavailable';
  end if;

  if public.venue_map_image_object_exists(v_ref, p_organization_id) then
    return p_map - 'backgroundImageUnavailable';
  end if;

  return jsonb_set(
    p_map - 'backgroundImageUrl' - 'backgroundOpacity' - 'backgroundImageUnavailable',
    '{backgroundImageUnavailable}',
    'true'::jsonb,
    true
  );
end;
$$;

revoke all on function public.sanitize_portal_venue_map_base_image(jsonb, uuid)
  from public, anon, authenticated;

-- Defense in depth for the CAS RPC and any future direct canonical writer.
-- Existing rows are evaluated only when a new INSERT/UPDATE is attempted.
create or replace function public.enforce_managed_venue_map_base_image()
returns trigger
language plpgsql
set search_path = public, storage, pg_temp
as $$
declare
  v_ref text;
begin
  if new.domain <> 'venueMapConfigs' or jsonb_typeof(new.payload) <> 'object' then
    return new;
  end if;

  v_ref := new.payload->>'backgroundImageUrl';
  if v_ref is not null
     and not public.venue_map_image_object_exists(v_ref, new.organization_id) then
    raise exception using
      errcode = '23503',
      message = 'venue_map_base_image_must_reference_existing_managed_object',
      detail = 'Upload the base map to this organization''s venue-map-images folder or remove it.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_managed_venue_map_base_image()
  from public, anon, authenticated;

drop trigger if exists enforce_managed_venue_map_base_image
  on public.org_data;
create trigger enforce_managed_venue_map_base_image
  before insert or update of payload, domain, organization_id
  on public.org_data
  for each row
  execute function public.enforce_managed_venue_map_base_image();

-- Owners/admins keep organization-folder management, including old draft files,
-- but an exact object used by any canonical map must first be unpublished or
-- replaced. This prevents a storage cleanup from silently breaking live maps.
create or replace function public.protect_published_venue_map_image()
returns trigger
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_ref text;
begin
  if old.bucket_id <> 'venue-map-images' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.bucket_id = old.bucket_id
     and new.name = old.name then
    return new;
  end if;

  v_ref := 'sp://venue-map-images/' || old.name;
  if exists (
    select 1
    from public.org_data as data
    where data.domain = 'venueMapConfigs'
      and jsonb_typeof(data.payload) = 'object'
      and data.payload->>'backgroundImageUrl' = v_ref
  ) then
    raise exception using
      errcode = '23503',
      message = 'published_venue_map_image_cannot_be_removed',
      detail = 'Remove or replace this base image in Venue Map Designer before deleting or renaming the object.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_published_venue_map_image()
  from public, anon, authenticated;

drop trigger if exists protect_published_venue_map_image
  on storage.objects;
create trigger protect_published_venue_map_image
  before delete or update of bucket_id, name
  on storage.objects
  for each row
  execute function public.protect_published_venue_map_image();
