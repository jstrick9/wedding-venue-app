-- Make historical malformed Venue Map rows fail closed at the authoritative
-- Couple/Guest read boundary without rewriting their admin-recoverable source.
--
-- Future writes are already guarded by migrations 0035, 0036, 0039, 0040, and
-- 0041. This migration closes the legacy-read gap by counting family identities
-- before structural filtering, removing every ambiguous group, withholding each
-- malformed whole object, and withholding routes that depend on rejected points.

create or replace function public.sanitize_venue_map_structural_integrity(
  p_map jsonb
) returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_points jsonb := '[]'::jsonb;
  v_routes jsonb := '[]'::jsonb;
  v_drawings jsonb := '[]'::jsonb;
  v_contingencies jsonb := '[]'::jsonb;
  v_safe_map jsonb;
begin
  if p_map is null or jsonb_typeof(p_map) <> 'object' then
    return p_map;
  end if;

  -- Count every interpretable point identity before checking kind/coordinates.
  -- A malformed twin therefore cannot make another occurrence appear unique.
  with point_occurrences as (
    select
      point.value,
      point.ordinality,
      trim(point.value->>'id') as id,
      count(*) over (partition by trim(point.value->>'id')) as id_occurrences
    from jsonb_array_elements(
      case when jsonb_typeof(p_map->'points') = 'array' then p_map->'points' else '[]'::jsonb end
    ) with ordinality as point(value, ordinality)
    where jsonb_typeof(point.value) = 'object'
      and jsonb_typeof(point.value->'id') = 'string'
      and length(trim(point.value->>'id')) between 1 and 200
  )
  select coalesce(jsonb_agg(point.value order by point.ordinality), '[]'::jsonb)
    into v_points
  from point_occurrences as point
  where point.id_occurrences = 1
    and jsonb_typeof(point.value->'kind') = 'string'
    and point.value->>'kind' in ('space', 'parking', 'entry', 'amenity', 'path')
    and jsonb_typeof(point.value->'x') = 'number'
    and jsonb_typeof(point.value->'y') = 'number';

  -- Preserve ordered route sequences only when every item is a distinct,
  -- uniquely resolvable safe point. Never prune a bad stop into a shortcut.
  with route_occurrences as (
    select
      route.value,
      route.ordinality,
      trim(route.value->>'id') as id,
      count(*) over (partition by trim(route.value->>'id')) as id_occurrences
    from jsonb_array_elements(
      case when jsonb_typeof(p_map->'routes') = 'array' then p_map->'routes' else '[]'::jsonb end
    ) with ordinality as route(value, ordinality)
    where jsonb_typeof(route.value) = 'object'
      and jsonb_typeof(route.value->'id') = 'string'
      and length(trim(route.value->>'id')) between 1 and 200
  )
  select coalesce(jsonb_agg(route.value order by route.ordinality), '[]'::jsonb)
    into v_routes
  from route_occurrences as route
  where route.id_occurrences = 1
    and jsonb_typeof(route.value->'pointIds') = 'array'
    and jsonb_array_length(
      case
        when jsonb_typeof(route.value->'pointIds') = 'array' then route.value->'pointIds'
        else '[]'::jsonb
      end
    ) >= 2
    and not exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(route.value->'pointIds') = 'array' then route.value->'pointIds'
          else '[]'::jsonb
        end
      ) as route_point(value)
      where jsonb_typeof(route_point.value) <> 'string'
        or length(trim(route_point.value #>> '{}')) not between 1 and 200
        or trim(route_point.value #>> '{}') = '__invalid_map_point_reference__'
    )
    and jsonb_array_length(
      case
        when jsonb_typeof(route.value->'pointIds') = 'array' then route.value->'pointIds'
        else '[]'::jsonb
      end
    ) = (
      select count(distinct trim(route_point.value #>> '{}'))
      from jsonb_array_elements(
        case
          when jsonb_typeof(route.value->'pointIds') = 'array' then route.value->'pointIds'
          else '[]'::jsonb
        end
      ) as route_point(value)
      where jsonb_typeof(route_point.value) = 'string'
        and length(trim(route_point.value #>> '{}')) between 1 and 200
    )
    and not exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(route.value->'pointIds') = 'array' then route.value->'pointIds'
          else '[]'::jsonb
        end
      ) as route_point(value)
      where (
        select count(*)
        from jsonb_array_elements(v_points) as point(value)
        where trim(point.value->>'id') = trim(route_point.value #>> '{}')
      ) <> 1
    )
    and (
      not (route.value ? 'priority')
      or (
        jsonb_typeof(route.value->'priority') = 'string'
        and route.value->>'priority' in (
          'preferred', 'standard', 'secondary', 'emergency-only'
        )
      )
    );

  -- Count IDs before geometry validation so a malformed drawing twin cannot be
  -- discarded first and resurrect another occurrence as a canonical shape.
  with drawing_occurrences as (
    select
      drawing.value,
      drawing.ordinality,
      trim(drawing.value->>'id') as id,
      count(*) over (partition by trim(drawing.value->>'id')) as id_occurrences
    from jsonb_array_elements(
      case when jsonb_typeof(p_map->'drawings') = 'array' then p_map->'drawings' else '[]'::jsonb end
    ) with ordinality as drawing(value, ordinality)
    where jsonb_typeof(drawing.value) = 'object'
      and jsonb_typeof(drawing.value->'id') = 'string'
      and length(trim(drawing.value->>'id')) between 1 and 200
  )
  select coalesce(jsonb_agg(drawing.value order by drawing.ordinality), '[]'::jsonb)
    into v_drawings
  from drawing_occurrences as drawing
  where drawing.id_occurrences = 1
    and public.venue_map_drawing_geometry_valid(drawing.value);

  -- Rain plans have both an object identity and a unique outdoor-source role.
  -- Count each before completeness filtering so malformed twins cannot launder
  -- either collision class.
  with contingency_occurrences as (
    select
      contingency.value,
      contingency.ordinality,
      case
        when jsonb_typeof(contingency.value->'id') = 'string'
         and length(trim(contingency.value->>'id')) between 1 and 200
          then trim(contingency.value->>'id')
        else null
      end as id,
      case
        when jsonb_typeof(contingency.value->'outdoorVenueId') = 'string'
         and length(trim(contingency.value->>'outdoorVenueId')) between 1 and 200
          then trim(contingency.value->>'outdoorVenueId')
        else null
      end as outdoor_venue_id
    from jsonb_array_elements(
      case
        when jsonb_typeof(p_map->'rainContingencies') = 'array'
          then p_map->'rainContingencies'
        else '[]'::jsonb
      end
    ) with ordinality as contingency(value, ordinality)
    where jsonb_typeof(contingency.value) = 'object'
  ), counted_contingencies as (
    select
      contingency.*,
      count(*) over (partition by contingency.id) as id_occurrences,
      count(*) over (
        partition by contingency.outdoor_venue_id
      ) as outdoor_occurrences
    from contingency_occurrences as contingency
  )
  select coalesce(jsonb_agg(contingency.value order by contingency.ordinality), '[]'::jsonb)
    into v_contingencies
  from counted_contingencies as contingency
  where contingency.id is not null
    and contingency.outdoor_venue_id is not null
    and contingency.id_occurrences = 1
    and contingency.outdoor_occurrences = 1
    and jsonb_typeof(contingency.value->'indoorVenueId') = 'string'
    and length(trim(contingency.value->>'indoorVenueId')) between 1 and 200
    and contingency.outdoor_venue_id <> trim(contingency.value->>'indoorVenueId');

  v_safe_map := jsonb_set(p_map, '{points}', v_points, true);
  v_safe_map := jsonb_set(v_safe_map, '{routes}', v_routes, true);
  v_safe_map := jsonb_set(v_safe_map, '{drawings}', v_drawings, true);
  return jsonb_set(v_safe_map, '{rainContingencies}', v_contingencies, true);
end;
$$;

revoke all on function public.sanitize_venue_map_structural_integrity(jsonb)
  from public, anon, authenticated;

-- Recompose the latest portal source boundary. Structural and identity safety
-- runs first against the untouched source; later catalog/visibility sanitation
-- therefore cannot erase evidence of a duplicate before it is counted.
create or replace function public.sanitize_venue_map_rain_contingencies(
  p_map jsonb,
  p_venues jsonb
) returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_structural_safe_map jsonb := public.sanitize_venue_map_structural_integrity(p_map);
  v_contingencies jsonb := '[]'::jsonb;
  v_rain_safe_map jsonb;
  v_space_safe_map jsonb;
begin
  if v_structural_safe_map is null
     or jsonb_typeof(v_structural_safe_map) <> 'object' then
    return v_structural_safe_map;
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
    from jsonb_array_elements(v_structural_safe_map->'rainContingencies')
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
    v_structural_safe_map,
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
