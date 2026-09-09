-- Keep point, route, and drawing event-space scopes repairable and valid against
-- the current venue catalog.
--
-- Existing canonical rows remain untouched for admin recovery. Guest reads
-- already fail closed when a scope is malformed or cannot intersect the selected
-- wedding spaces. This migration prevents a future Venue Map publication from
-- perpetuating invisible objects with malformed, stale, or ambiguous scope ids.

create or replace function public.venue_map_event_scope_valid(
  p_object jsonb,
  p_venues jsonb
) returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if jsonb_typeof(p_object) <> 'object' then
    return false;
  end if;

  if not (p_object ? 'eventSpaceIds') then
    return true;
  end if;

  if jsonb_typeof(p_object->'eventSpaceIds') <> 'array' then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_object->'eventSpaceIds') as scope(value)
    where jsonb_typeof(scope.value) <> 'string'
      or length(trim(scope.value #>> '{}')) not between 1 and 200
      or trim(scope.value #>> '{}') = '__invalid_event_scope__'
      or (
        select count(*)
        from jsonb_array_elements(
          case when jsonb_typeof(p_venues) = 'array' then p_venues else '[]'::jsonb end
        ) as venue(value)
        where jsonb_typeof(venue.value) = 'object'
          and jsonb_typeof(venue.value->'id') = 'string'
          and length(trim(venue.value->>'id')) between 1 and 200
          and trim(venue.value->>'id') = trim(scope.value #>> '{}')
      ) <> 1
  ) then
    return false;
  end if;

  -- Canonical browser normalization de-duplicates scope ids. Reject a wider
  -- direct server write rather than silently choosing one occurrence.
  if exists (
    select 1
    from jsonb_array_elements_text(p_object->'eventSpaceIds') as scope(id)
    group by trim(scope.id)
    having count(*) > 1
  ) then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.venue_map_event_scope_valid(jsonb, jsonb)
  from public, anon, authenticated;

create or replace function public.venue_map_has_invalid_event_scopes(
  p_map jsonb,
  p_venues jsonb
) returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_map is null or jsonb_typeof(p_map) <> 'object' then
    return false;
  end if;

  return exists (
    select 1
    from (
      select point.value as object
      from jsonb_array_elements(
        case when jsonb_typeof(p_map->'points') = 'array' then p_map->'points' else '[]'::jsonb end
      ) as point(value)
      union all
      select route.value
      from jsonb_array_elements(
        case when jsonb_typeof(p_map->'routes') = 'array' then p_map->'routes' else '[]'::jsonb end
      ) as route(value)
      union all
      select drawing.value
      from jsonb_array_elements(
        case when jsonb_typeof(p_map->'drawings') = 'array' then p_map->'drawings' else '[]'::jsonb end
      ) as drawing(value)
    ) as map_object
    where jsonb_typeof(map_object.object) = 'object'
      and map_object.object ? 'eventSpaceIds'
      and not public.venue_map_event_scope_valid(map_object.object, p_venues)
  );
end;
$$;

revoke all on function public.venue_map_has_invalid_event_scopes(jsonb, jsonb)
  from public, anon, authenticated;

create or replace function public.enforce_valid_venue_map_event_scopes()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_venues jsonb;
begin
  if new.domain <> 'venueMapConfigs' or jsonb_typeof(new.payload) <> 'object' then
    return new;
  end if;

  select data.payload
    into v_venues
  from public.org_data as data
  where data.organization_id = new.organization_id
    and data.domain = 'venues'
  limit 1;

  if public.venue_map_has_invalid_event_scopes(new.payload, v_venues) then
    raise exception using
      errcode = '23514',
      message = 'venue_map_event_scope_invalid',
      detail = 'Remove malformed or unavailable event-space scopes before publishing the Venue Map.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_valid_venue_map_event_scopes()
  from public, anon, authenticated;

drop trigger if exists enforce_valid_venue_map_event_scopes
  on public.org_data;
create trigger enforce_valid_venue_map_event_scopes
  before insert or update of payload, domain, organization_id
  on public.org_data
  for each row
  execute function public.enforce_valid_venue_map_event_scopes();
