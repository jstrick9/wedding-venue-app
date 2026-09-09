-- Quarantine historical Venue Map points whose finite coordinates fall outside
-- their valid map frame, and withhold every dependent route as a whole.
--
-- Existing canonical and snapshot rows remain unchanged for admin recovery.
-- Portal reads filter coordinates only after migration 0042's identity-first
-- structural pass, so a malformed duplicate can never make its twin unique.
-- Future canonical writes are rejected at the table edge.

create or replace function public.venue_map_has_invalid_point_coordinates(
  p_map jsonb
) returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_width numeric := 100;
  v_height numeric := 80;
begin
  if p_map is null
     or jsonb_typeof(p_map) <> 'object'
     or public.venue_map_has_invalid_frame(p_map)
     or jsonb_typeof(p_map->'points') is distinct from 'array' then
    return false;
  end if;

  if p_map ? 'width' then
    v_width := (p_map->>'width')::numeric;
  end if;
  if p_map ? 'height' then
    v_height := (p_map->>'height')::numeric;
  end if;

  return exists (
    select 1
    from jsonb_array_elements(p_map->'points') as point(value)
    where case
      when jsonb_typeof(point.value) <> 'object'
        or jsonb_typeof(point.value->'x') is distinct from 'number'
        or jsonb_typeof(point.value->'y') is distinct from 'number'
        then true
      else not (
        (point.value->>'x')::numeric between 0 and v_width
        and (point.value->>'y')::numeric between 0 and v_height
      )
    end
  );
end;
$$;

revoke all on function public.venue_map_has_invalid_point_coordinates(jsonb)
  from public, anon, authenticated;

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
  v_routes jsonb := '[]'::jsonb;
  v_safe_map jsonb;
begin
  if p_map is null or jsonb_typeof(p_map) <> 'object' then
    return p_map;
  end if;
  if public.venue_map_has_invalid_frame(p_map) then
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
      where (
        select count(*)
        from jsonb_array_elements(v_points) as point(value)
        where point.value->>'id' = trim(route_point.value #>> '{}')
      ) <> 1
    );

  return jsonb_set(v_safe_map, '{routes}', v_routes, true);
end;
$$;

revoke all on function public.sanitize_venue_map_point_coordinates(jsonb)
  from public, anon, authenticated;

-- Preserve migration 0043's whole-frame gate and every later catalog,
-- rain-collision, drawing, and route-priority layer. Coordinate safety runs
-- immediately after the identity-first structural sanitizer.
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

create or replace function public.enforce_valid_venue_map_point_coordinates()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.domain <> 'venueMapConfigs' then
    return new;
  end if;

  if public.venue_map_has_invalid_point_coordinates(new.payload) then
    raise exception using
      errcode = '23514',
      message = 'venue_map_point_coordinate_invalid',
      detail = 'Every Venue Map point coordinate must be finite and fall inside the current map frame.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_valid_venue_map_point_coordinates()
  from public, anon, authenticated;

drop trigger if exists enforce_valid_venue_map_point_coordinates
  on public.org_data;
create trigger enforce_valid_venue_map_point_coordinates
  before insert or update of payload, domain, organization_id
  on public.org_data
  for each row
  execute function public.enforce_valid_venue_map_point_coordinates();
