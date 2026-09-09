-- Fail closed for unsupported or malformed Venue Map vector shapes.
--
-- Existing canonical rows remain unchanged for explicit admin recovery. Portal
-- projections omit invalid shapes before rendering, and future publications
-- must use a supported shape with complete renderable geometry.

create or replace function public.venue_map_drawing_geometry_valid(
  p_drawing jsonb
) returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(case
    when jsonb_typeof(p_drawing) is distinct from 'object' then false
    when jsonb_typeof(p_drawing->'type') is distinct from 'string' then false
    when trim(p_drawing->>'type') in ('zone', 'rectangle') then
      jsonb_typeof(p_drawing->'x') = 'number'
      and jsonb_typeof(p_drawing->'y') = 'number'
      and case when jsonb_typeof(p_drawing->'width') = 'number'
        then (p_drawing->>'width')::numeric > 0 else false end
      and case when jsonb_typeof(p_drawing->'height') = 'number'
        then (p_drawing->>'height')::numeric > 0 else false end
    when trim(p_drawing->>'type') = 'circle' then
      jsonb_typeof(p_drawing->'x') = 'number'
      and jsonb_typeof(p_drawing->'y') = 'number'
      and case when jsonb_typeof(p_drawing->'radius') = 'number'
        then (p_drawing->>'radius')::numeric > 0 else false end
    when trim(p_drawing->>'type') = 'line' then
      jsonb_typeof(p_drawing->'points') = 'array'
      and jsonb_array_length(
        case
          when jsonb_typeof(p_drawing->'points') = 'array' then p_drawing->'points'
          else '[]'::jsonb
        end
      ) >= 2
      and not exists (
        select 1
        from jsonb_array_elements(
          case
            when jsonb_typeof(p_drawing->'points') = 'array' then p_drawing->'points'
            else '[]'::jsonb
          end
        ) as vertex(value)
        where jsonb_typeof(vertex.value) is distinct from 'object'
          or jsonb_typeof(vertex.value->'x') is distinct from 'number'
          or jsonb_typeof(vertex.value->'y') is distinct from 'number'
      )
      and (
        select count(*)
        from (
          select
            (vertex.value->>'x')::numeric as x,
            (vertex.value->>'y')::numeric as y
          from jsonb_array_elements(
            case
              when jsonb_typeof(p_drawing->'points') = 'array' then p_drawing->'points'
              else '[]'::jsonb
            end
          ) as vertex(value)
          where jsonb_typeof(vertex.value) = 'object'
            and jsonb_typeof(vertex.value->'x') = 'number'
            and jsonb_typeof(vertex.value->'y') = 'number'
          group by
            (vertex.value->>'x')::numeric,
            (vertex.value->>'y')::numeric
        ) as distinct_vertices
      ) >= 2
    else false
  end, false);
$$;

revoke all on function public.venue_map_drawing_geometry_valid(jsonb)
  from public, anon, authenticated;

create or replace function public.venue_map_has_invalid_drawing_geometry(
  p_map jsonb
) returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_map is null or jsonb_typeof(p_map) <> 'object' then false
    when p_map ? 'drawings' and jsonb_typeof(p_map->'drawings') <> 'array' then true
    else exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(p_map->'drawings') = 'array' then p_map->'drawings'
          else '[]'::jsonb
        end
      ) as drawing(value)
      where not public.venue_map_drawing_geometry_valid(drawing.value)
    )
  end;
$$;

revoke all on function public.venue_map_has_invalid_drawing_geometry(jsonb)
  from public, anon, authenticated;

create or replace function public.sanitize_venue_map_drawings(
  p_map jsonb
) returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_drawings jsonb := '[]'::jsonb;
begin
  if p_map is null or jsonb_typeof(p_map) <> 'object' then
    return p_map;
  end if;

  select coalesce(jsonb_agg(drawing.value order by drawing.ordinality), '[]'::jsonb)
    into v_drawings
  from jsonb_array_elements(
    case
      when jsonb_typeof(p_map->'drawings') = 'array' then p_map->'drawings'
      else '[]'::jsonb
    end
  ) with ordinality as drawing(value, ordinality)
  where public.venue_map_drawing_geometry_valid(drawing.value);

  return jsonb_set(p_map, '{drawings}', v_drawings, true);
end;
$$;

revoke all on function public.sanitize_venue_map_drawings(jsonb)
  from public, anon, authenticated;

-- Compose drawing integrity with migrations 0037–0038's catalog, space-pin,
-- rain validity, and collision sanitation. Both authoritative Couple and Guest
-- projection paths already call this boundary.
create or replace function public.sanitize_venue_map_rain_contingencies(
  p_map jsonb,
  p_venues jsonb
) returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_contingencies jsonb := '[]'::jsonb;
  v_rain_safe_map jsonb;
  v_space_safe_map jsonb;
begin
  if p_map is null or jsonb_typeof(p_map) <> 'object' then
    return p_map;
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
    from jsonb_array_elements(
      case
        when jsonb_typeof(p_map->'rainContingencies') = 'array'
          then p_map->'rainContingencies'
        else '[]'::jsonb
      end
    ) with ordinality as contingency(value, ordinality)
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

  v_rain_safe_map := jsonb_set(p_map, '{rainContingencies}', v_contingencies, true);
  v_space_safe_map := public.sanitize_venue_map_space_point_links(v_rain_safe_map, p_venues);
  return public.sanitize_venue_map_drawings(v_space_safe_map);
end;
$$;

revoke all on function public.sanitize_venue_map_rain_contingencies(jsonb, jsonb)
  from public, anon, authenticated;

create or replace function public.enforce_valid_venue_map_drawing_geometry()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.domain <> 'venueMapConfigs' or jsonb_typeof(new.payload) <> 'object' then
    return new;
  end if;

  if public.venue_map_has_invalid_drawing_geometry(new.payload) then
    raise exception using
      errcode = '23514',
      message = 'venue_map_drawing_geometry_invalid',
      detail = 'Map drawings must use a supported type with complete renderable geometry.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_valid_venue_map_drawing_geometry()
  from public, anon, authenticated;

drop trigger if exists enforce_valid_venue_map_drawing_geometry
  on public.org_data;
create trigger enforce_valid_venue_map_drawing_geometry
  before insert or update of payload, domain, organization_id
  on public.org_data
  for each row
  execute function public.enforce_valid_venue_map_drawing_geometry();
