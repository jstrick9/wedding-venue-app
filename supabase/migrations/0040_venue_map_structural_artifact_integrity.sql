-- Reject structurally uninterpretable Venue Map collection entries on future writes.
--
-- Existing canonical rows remain unchanged. Existing portal projectors already
-- omit these entries, while the admin client retains allowlisted recovery
-- diagnostics outside the publishable map until an explicit reconstruct/remove
-- decision is made.

create or replace function public.venue_map_has_structural_artifacts(
  p_map jsonb
) returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_map is null or jsonb_typeof(p_map) is distinct from 'object' then
    return true;
  end if;

  if (p_map ? 'points' and jsonb_typeof(p_map->'points') <> 'array')
     or (p_map ? 'routes' and jsonb_typeof(p_map->'routes') <> 'array')
     or (p_map ? 'drawings' and jsonb_typeof(p_map->'drawings') <> 'array')
     or (p_map ? 'rainContingencies' and jsonb_typeof(p_map->'rainContingencies') <> 'array') then
    return true;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      case when jsonb_typeof(p_map->'points') = 'array' then p_map->'points' else '[]'::jsonb end
    ) as point(value)
    where jsonb_typeof(point.value) is distinct from 'object'
      or jsonb_typeof(point.value->'id') is distinct from 'string'
      or length(trim(point.value->>'id')) not between 1 and 200
      or jsonb_typeof(point.value->'kind') is distinct from 'string'
      or point.value->>'kind' not in ('space', 'parking', 'entry', 'amenity', 'path')
      or jsonb_typeof(point.value->'x') is distinct from 'number'
      or jsonb_typeof(point.value->'y') is distinct from 'number'
  ) then
    return true;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      case when jsonb_typeof(p_map->'routes') = 'array' then p_map->'routes' else '[]'::jsonb end
    ) as route(value)
    where jsonb_typeof(route.value) is distinct from 'object'
      or jsonb_typeof(route.value->'id') is distinct from 'string'
      or length(trim(route.value->>'id')) not between 1 and 200
  ) then
    return true;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      case when jsonb_typeof(p_map->'drawings') = 'array' then p_map->'drawings' else '[]'::jsonb end
    ) as drawing(value)
    where jsonb_typeof(drawing.value) is distinct from 'object'
      or jsonb_typeof(drawing.value->'id') is distinct from 'string'
      or length(trim(drawing.value->>'id')) not between 1 and 200
      or jsonb_typeof(drawing.value->'type') is distinct from 'string'
      or length(trim(drawing.value->>'type')) not between 1 and 50
  ) then
    return true;
  end if;

  return exists (
    select 1
    from jsonb_array_elements(
      case
        when jsonb_typeof(p_map->'rainContingencies') = 'array'
          then p_map->'rainContingencies'
        else '[]'::jsonb
      end
    ) as contingency(value)
    where jsonb_typeof(contingency.value) is distinct from 'object'
      or jsonb_typeof(contingency.value->'id') is distinct from 'string'
      or length(trim(contingency.value->>'id')) not between 1 and 200
      or jsonb_typeof(contingency.value->'outdoorVenueId') is distinct from 'string'
      or length(trim(contingency.value->>'outdoorVenueId')) not between 1 and 200
      or jsonb_typeof(contingency.value->'indoorVenueId') is distinct from 'string'
      or length(trim(contingency.value->>'indoorVenueId')) not between 1 and 200
  );
end;
$$;

revoke all on function public.venue_map_has_structural_artifacts(jsonb)
  from public, anon, authenticated;

create or replace function public.enforce_valid_venue_map_structure()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.domain <> 'venueMapConfigs' then
    return new;
  end if;

  if public.venue_map_has_structural_artifacts(new.payload) then
    raise exception using
      errcode = '23514',
      message = 'venue_map_structural_artifact_invalid',
      detail = 'Map collections must contain typed objects with valid canonical identities.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_valid_venue_map_structure()
  from public, anon, authenticated;

drop trigger if exists enforce_valid_venue_map_structure on public.org_data;
create trigger enforce_valid_venue_map_structure
  before insert or update of payload, domain, organization_id
  on public.org_data
  for each row
  execute function public.enforce_valid_venue_map_structure();
