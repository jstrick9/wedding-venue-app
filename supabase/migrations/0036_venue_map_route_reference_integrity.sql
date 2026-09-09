-- Prevent a missing or malformed intermediate route point from being silently
-- pruned into a false direct walkway segment.
--
-- Existing canonical rows remain untouched for admin recovery. The browser
-- preserves each ordered reference and quarantines the entire route; the server
-- already omits dependent routes from portal projections. This guard rejects
-- future publications until every structural route has at least two distinct,
-- uniquely resolvable structural point references.

create or replace function public.venue_map_has_invalid_route_references(
  p_map jsonb
) returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  with point_candidates as (
    select left(trim(point.value->>'id'), 200) as id
    from jsonb_array_elements(
      case when jsonb_typeof(p_map->'points') = 'array' then p_map->'points' else '[]'::jsonb end
    ) as point(value)
    where jsonb_typeof(point.value) = 'object'
      and jsonb_typeof(point.value->'id') = 'string'
      and length(trim(point.value->>'id')) between 1 and 200
      and point.value->>'kind' in ('space', 'parking', 'entry', 'amenity', 'path')
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
        case
          when jsonb_typeof(route.value->'pointIds') = 'array'
            then route.value->'pointIds'
          else '[]'::jsonb
        end
      ) < 2
      or exists (
        select 1
        from jsonb_array_elements(
          case
            when jsonb_typeof(route.value->'pointIds') = 'array'
              then route.value->'pointIds'
            else '[]'::jsonb
          end
        ) as route_point(value)
        where jsonb_typeof(route_point.value) <> 'string'
          or length(trim(route_point.value #>> '{}')) not between 1 and 200
          or trim(route_point.value #>> '{}') = '__invalid_map_point_reference__'
      )
      or (
        select count(distinct trim(route_point.value #>> '{}'))
        from jsonb_array_elements(
          case
            when jsonb_typeof(route.value->'pointIds') = 'array'
              then route.value->'pointIds'
            else '[]'::jsonb
          end
        ) as route_point(value)
        where jsonb_typeof(route_point.value) = 'string'
          and length(trim(route_point.value #>> '{}')) between 1 and 200
      ) < 2
      or exists (
        select 1
        from jsonb_array_elements(
          case
            when jsonb_typeof(route.value->'pointIds') = 'array'
              then route.value->'pointIds'
            else '[]'::jsonb
          end
        ) as route_point(value)
        where jsonb_typeof(route_point.value) = 'string'
          and length(trim(route_point.value #>> '{}')) between 1 and 200
          and (
            select count(*)
            from point_candidates as point
            where point.id = trim(route_point.value #>> '{}')
          ) <> 1
      )
      or jsonb_array_length(
        case
          when jsonb_typeof(route.value->'pointIds') = 'array'
            then route.value->'pointIds'
          else '[]'::jsonb
        end
      ) <> (
        select count(distinct trim(route_point.value #>> '{}'))
        from jsonb_array_elements(
          case
            when jsonb_typeof(route.value->'pointIds') = 'array'
              then route.value->'pointIds'
            else '[]'::jsonb
          end
        ) as route_point(value)
        where jsonb_typeof(route_point.value) = 'string'
          and length(trim(route_point.value #>> '{}')) between 1 and 200
      )
  );
$$;

revoke all on function public.venue_map_has_invalid_route_references(jsonb)
  from public, anon, authenticated;

create or replace function public.enforce_valid_venue_map_route_references()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.domain <> 'venueMapConfigs' or jsonb_typeof(new.payload) <> 'object' then
    return new;
  end if;

  if public.venue_map_has_invalid_route_references(new.payload) then
    raise exception using
      errcode = '23514',
      message = 'venue_map_route_reference_invalid',
      detail = 'Repair or remove walkways with missing, malformed, repeated, or ambiguous point references.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_valid_venue_map_route_references()
  from public, anon, authenticated;

drop trigger if exists enforce_valid_venue_map_route_references
  on public.org_data;
create trigger enforce_valid_venue_map_route_references
  before insert or update of payload, domain, organization_id
  on public.org_data
  for each row
  execute function public.enforce_valid_venue_map_route_references();
