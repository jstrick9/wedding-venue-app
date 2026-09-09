-- Reject future canonical Venue Map writes with ambiguous point, route, or
-- drawing identities. Existing rows are intentionally untouched so admins can
-- recover every occurrence in Venue Map Designer.
--
-- Portal projectors in migrations 0026 and 0031 already count identities before
-- audience/scope filtering and omit every duplicated occurrence plus routes that
-- depend on duplicated points. This trigger closes the canonical write boundary
-- without guessing which occurrence should survive.

create or replace function public.venue_map_has_duplicate_object_ids(
  p_map jsonb
) returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  with object_ids as (
    select 'point'::text as family, left(trim(point.value->>'id'), 200) as id
    from jsonb_array_elements(
      case when jsonb_typeof(p_map->'points') = 'array' then p_map->'points' else '[]'::jsonb end
    ) as point(value)
    where jsonb_typeof(point.value) = 'object'
      and jsonb_typeof(point.value->'id') = 'string'
      and length(trim(point.value->>'id')) between 1 and 200
      and point.value->>'kind' in ('space', 'parking', 'entry', 'amenity', 'path')

    union all

    select 'route'::text, left(trim(route.value->>'id'), 200)
    from jsonb_array_elements(
      case when jsonb_typeof(p_map->'routes') = 'array' then p_map->'routes' else '[]'::jsonb end
    ) as route(value)
    where jsonb_typeof(route.value) = 'object'
      and jsonb_typeof(route.value->'id') = 'string'
      and length(trim(route.value->>'id')) between 1 and 200
      and jsonb_typeof(route.value->'pointIds') = 'array'

    union all

    select 'drawing'::text, left(trim(drawing.value->>'id'), 200)
    from jsonb_array_elements(
      case when jsonb_typeof(p_map->'drawings') = 'array' then p_map->'drawings' else '[]'::jsonb end
    ) as drawing(value)
    where jsonb_typeof(drawing.value) = 'object'
      and jsonb_typeof(drawing.value->'id') = 'string'
      and length(trim(drawing.value->>'id')) between 1 and 200
      and jsonb_typeof(drawing.value->'type') = 'string'
      and length(trim(drawing.value->>'type')) between 1 and 50
  )
  select exists (
    select 1
    from object_ids
    group by family, id
    having count(*) > 1
  );
$$;

revoke all on function public.venue_map_has_duplicate_object_ids(jsonb)
  from public, anon, authenticated;

create or replace function public.enforce_unique_venue_map_object_ids()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.domain <> 'venueMapConfigs' or jsonb_typeof(new.payload) <> 'object' then
    return new;
  end if;

  if public.venue_map_has_duplicate_object_ids(new.payload) then
    raise exception using
      errcode = '23505',
      message = 'venue_map_duplicate_object_id',
      detail = 'Point, walkway, and zone IDs must each be unique before publishing the Venue Map.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_unique_venue_map_object_ids()
  from public, anon, authenticated;

drop trigger if exists enforce_unique_venue_map_object_ids
  on public.org_data;
create trigger enforce_unique_venue_map_object_ids
  before insert or update of payload, domain, organization_id
  on public.org_data
  for each row
  execute function public.enforce_unique_venue_map_object_ids();
