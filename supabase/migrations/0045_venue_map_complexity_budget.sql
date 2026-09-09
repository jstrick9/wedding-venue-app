-- Bound Venue Map rendering, backup, and projection work to a generous
-- wedding-venue operational budget.
--
-- Existing canonical rows remain unchanged for admin recovery. Over-budget
-- historical maps fail closed before any identity/geometry expansion in portal
-- paths. The alphabetically first table trigger rejects future writes before
-- the more detailed JSON validators run.

create or replace function public.venue_map_exceeds_complexity_budget(
  p_map jsonb
) returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_map is null then
    return false;
  end if;
  if jsonb_typeof(p_map) <> 'object' then
    return octet_length(p_map::text) > 2097152;
  end if;

  if (case when jsonb_typeof(p_map->'points') = 'array'
        then jsonb_array_length(p_map->'points') > 500 else false end)
     or (case when jsonb_typeof(p_map->'routes') = 'array'
        then jsonb_array_length(p_map->'routes') > 500 else false end)
     or (case when jsonb_typeof(p_map->'drawings') = 'array'
        then jsonb_array_length(p_map->'drawings') > 500 else false end)
     or (case when jsonb_typeof(p_map->'rainContingencies') = 'array'
        then jsonb_array_length(p_map->'rainContingencies') > 250 else false end) then
    return true;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      case when jsonb_typeof(p_map->'routes') = 'array' then p_map->'routes' else '[]'::jsonb end
    ) as route(value)
    where case
      when jsonb_typeof(route.value) = 'object'
        and jsonb_typeof(route.value->'pointIds') = 'array'
        then jsonb_array_length(route.value->'pointIds') > 100
      else false
    end
  ) then
    return true;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      case when jsonb_typeof(p_map->'drawings') = 'array' then p_map->'drawings' else '[]'::jsonb end
    ) as drawing(value)
    where case
      when jsonb_typeof(drawing.value) = 'object'
        and drawing.value->>'type' = 'line'
        and jsonb_typeof(drawing.value->'points') = 'array'
        then jsonb_array_length(drawing.value->'points') > 500
      else false
    end
  ) then
    return true;
  end if;

  return octet_length(p_map::text) > 2097152;
end;
$$;

revoke all on function public.venue_map_exceeds_complexity_budget(jsonb)
  from public, anon, authenticated;

-- Replace migration 0044's route dependency scan with a bounded text-array
-- lookup. Identity-first structural sanitation guarantees that these ids are
-- unique before coordinate filtering runs.
create or replace function public.sanitize_venue_map_point_coordinates(
  p_map jsonb
) returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_width numeric := 100;
  v_height numeric := 80;
  v_points jsonb := '[]'::jsonb;
  v_point_ids text[] := array[]::text[];
  v_routes jsonb := '[]'::jsonb;
  v_safe_map jsonb;
begin
  if p_map is null or jsonb_typeof(p_map) <> 'object' then
    return p_map;
  end if;
  if public.venue_map_exceeds_complexity_budget(p_map)
     or public.venue_map_has_invalid_frame(p_map) then
    return null;
  end if;

  if p_map ? 'width' then
    v_width := (p_map->>'width')::numeric;
  end if;
  if p_map ? 'height' then
    v_height := (p_map->>'height')::numeric;
  end if;

  select coalesce(jsonb_agg(point.value order by point.ordinality), '[]'::jsonb)
    into v_points
  from jsonb_array_elements(
    case when jsonb_typeof(p_map->'points') = 'array' then p_map->'points' else '[]'::jsonb end
  ) with ordinality as point(value, ordinality)
  where jsonb_typeof(point.value) = 'object'
    and jsonb_typeof(point.value->'x') = 'number'
    and jsonb_typeof(point.value->'y') = 'number'
    and (point.value->>'x')::numeric between 0 and v_width
    and (point.value->>'y')::numeric between 0 and v_height;

  select coalesce(array_agg(point.value->>'id'), array[]::text[])
    into v_point_ids
  from jsonb_array_elements(v_points) as point(value)
  where jsonb_typeof(point.value->'id') = 'string';

  v_safe_map := jsonb_set(p_map, '{points}', v_points, true);

  select coalesce(jsonb_agg(route.value order by route.ordinality), '[]'::jsonb)
    into v_routes
  from jsonb_array_elements(
    case when jsonb_typeof(p_map->'routes') = 'array' then p_map->'routes' else '[]'::jsonb end
  ) with ordinality as route(value, ordinality)
  where jsonb_typeof(route.value) = 'object'
    and jsonb_typeof(route.value->'pointIds') = 'array'
    and not exists (
      select 1
      from jsonb_array_elements(route.value->'pointIds') as route_point(value)
      where jsonb_typeof(route_point.value) is distinct from 'string'
         or coalesce(not (trim(route_point.value #>> '{}') = any(v_point_ids)), true)
    );

  return jsonb_set(v_safe_map, '{routes}', v_routes, true);
end;
$$;

revoke all on function public.sanitize_venue_map_point_coordinates(jsonb)
  from public, anon, authenticated;

-- Optimize the future-write route validator so each structural point identity
-- is counted once rather than rescanning the complete points JSON for every stop.
create or replace function public.venue_map_has_invalid_route_references(
  p_map jsonb
) returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  with point_counts as (
    select left(trim(point.value->>'id'), 200) as id, count(*) as occurrences
    from jsonb_array_elements(
      case when jsonb_typeof(p_map->'points') = 'array' then p_map->'points' else '[]'::jsonb end
    ) as point(value)
    where jsonb_typeof(point.value) = 'object'
      and jsonb_typeof(point.value->'id') = 'string'
      and length(trim(point.value->>'id')) between 1 and 200
      and point.value->>'kind' in ('space', 'parking', 'entry', 'amenity', 'path')
    group by left(trim(point.value->>'id'), 200)
  ), route_candidates as (
    select route.value
    from jsonb_array_elements(
      case when jsonb_typeof(p_map->'routes') = 'array' then p_map->'routes' else '[]'::jsonb end
    ) as route(value)
    where jsonb_typeof(route.value) = 'object'
      and jsonb_typeof(route.value->'id') = 'string'
      and length(trim(route.value->>'id')) between 1 and 200
  )
  select exists (
    select 1
    from route_candidates as route
    where jsonb_typeof(route.value->'pointIds') is distinct from 'array'
      or jsonb_array_length(
        case when jsonb_typeof(route.value->'pointIds') = 'array'
          then route.value->'pointIds' else '[]'::jsonb end
      ) < 2
      or exists (
        select 1
        from jsonb_array_elements(
          case when jsonb_typeof(route.value->'pointIds') = 'array'
            then route.value->'pointIds' else '[]'::jsonb end
        ) as route_point(value)
        left join point_counts as point
          on point.id = trim(route_point.value #>> '{}')
        where jsonb_typeof(route_point.value) is distinct from 'string'
           or length(trim(route_point.value #>> '{}')) not between 1 and 200
           or trim(route_point.value #>> '{}') = '__invalid_map_point_reference__'
           or coalesce(point.occurrences, 0) <> 1
      )
      or jsonb_array_length(
        case when jsonb_typeof(route.value->'pointIds') = 'array'
          then route.value->'pointIds' else '[]'::jsonb end
      ) <> (
        select count(distinct trim(route_point.value #>> '{}'))
        from jsonb_array_elements(
          case when jsonb_typeof(route.value->'pointIds') = 'array'
            then route.value->'pointIds' else '[]'::jsonb end
        ) as route_point(value)
        where jsonb_typeof(route_point.value) = 'string'
          and length(trim(route_point.value #>> '{}')) between 1 and 200
      )
  );
$$;

revoke all on function public.venue_map_has_invalid_route_references(jsonb)
  from public, anon, authenticated;

-- Preserve the complete migration 0044 portal composition. The budget gate is
-- deliberately first, before frame, identity, catalog, geometry, or route work.
create or replace function public.sanitize_venue_map_rain_contingencies(
  p_map jsonb,
  p_venues jsonb
) returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_structural_safe_map jsonb;
  v_coordinate_safe_map jsonb;
  v_contingencies jsonb := '[]'::jsonb;
  v_rain_safe_map jsonb;
  v_space_safe_map jsonb;
begin
  if public.venue_map_exceeds_complexity_budget(p_map) then
    return null;
  end if;
  if public.venue_map_has_invalid_frame(p_map) then
    return null;
  end if;

  v_structural_safe_map := public.sanitize_venue_map_structural_integrity(p_map);
  v_coordinate_safe_map := public.sanitize_venue_map_point_coordinates(v_structural_safe_map);
  if v_coordinate_safe_map is null
     or jsonb_typeof(v_coordinate_safe_map) <> 'object' then
    return v_coordinate_safe_map;
  end if;

  with candidates as (
    select
      contingency.value,
      contingency.ordinality,
      trim(contingency.value->>'id') as id,
      trim(contingency.value->>'outdoorVenueId') as outdoor_venue_id,
      count(*) over (partition by trim(contingency.value->>'id')) as id_occurrences,
      count(*) over (
        partition by trim(contingency.value->>'outdoorVenueId')
      ) as outdoor_occurrences
    from jsonb_array_elements(v_coordinate_safe_map->'rainContingencies')
      with ordinality as contingency(value, ordinality)
    where jsonb_typeof(contingency.value) = 'object'
      and jsonb_typeof(contingency.value->'id') = 'string'
      and length(trim(contingency.value->>'id')) between 1 and 200
      and jsonb_typeof(contingency.value->'outdoorVenueId') = 'string'
      and length(trim(contingency.value->>'outdoorVenueId')) between 1 and 200
      and jsonb_typeof(contingency.value->'indoorVenueId') = 'string'
      and length(trim(contingency.value->>'indoorVenueId')) between 1 and 200
  )
  select coalesce(jsonb_agg(contingency.value order by contingency.ordinality), '[]'::jsonb)
    into v_contingencies
  from candidates as contingency
  where contingency.id_occurrences = 1
    and contingency.outdoor_occurrences = 1
    and public.venue_map_rain_contingency_valid(contingency.value, p_venues);

  v_rain_safe_map := jsonb_set(
    v_coordinate_safe_map,
    '{rainContingencies}',
    v_contingencies,
    true
  );
  v_space_safe_map := public.sanitize_venue_map_space_point_links(v_rain_safe_map, p_venues);
  return public.sanitize_venue_map_route_priorities(
    public.sanitize_venue_map_drawings(v_space_safe_map)
  );
end;
$$;

revoke all on function public.sanitize_venue_map_rain_contingencies(jsonb, jsonb)
  from public, anon, authenticated;

create or replace function public.enforce_venue_map_complexity_budget()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.domain <> 'venueMapConfigs' then
    return new;
  end if;

  if public.venue_map_exceeds_complexity_budget(new.payload) then
    raise exception using
      errcode = '54000',
      message = 'venue_map_complexity_budget_exceeded',
      detail = 'Venue Maps are limited to 500 points, 500 walkways, 500 shapes, 250 rain plans, 100 points per walkway, 500 vertices per line, and 2 MiB of canonical JSON.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_venue_map_complexity_budget()
  from public, anon, authenticated;

drop trigger if exists enforce_000_venue_map_complexity_budget
  on public.org_data;
create trigger enforce_000_venue_map_complexity_budget
  before insert or update of payload, domain, organization_id
  on public.org_data
  for each row
  execute function public.enforce_venue_map_complexity_budget();
