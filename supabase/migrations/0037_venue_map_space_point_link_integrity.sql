-- Require every `space` point to reference exactly one current venue
-- record (event space or lodging).
--
-- Existing canonical rows remain untouched for admin recovery. Portal-only
-- sanitation omits invalid space points and routes that depend on them. Future
-- map publications fail until each pin is linked, reclassified, or removed.

create or replace function public.venue_map_space_point_link_valid(
  p_point jsonb,
  p_venues jsonb
) returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select
    jsonb_typeof(p_point) = 'object'
    and p_point->>'kind' = 'space'
    and jsonb_typeof(p_point->'venueId') = 'string'
    and length(trim(p_point->>'venueId')) between 1 and 200
    and (
      select count(*)
      from jsonb_array_elements(
        case when jsonb_typeof(p_venues) = 'array' then p_venues else '[]'::jsonb end
      ) as venue(value)
      where jsonb_typeof(venue.value) = 'object'
        and jsonb_typeof(venue.value->'id') = 'string'
        and length(trim(venue.value->>'id')) between 1 and 200
        and trim(venue.value->>'id') = trim(p_point->>'venueId')
    ) = 1;
$$;

revoke all on function public.venue_map_space_point_link_valid(jsonb, jsonb)
  from public, anon, authenticated;

create or replace function public.venue_map_has_invalid_space_point_links(
  p_map jsonb,
  p_venues jsonb
) returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from jsonb_array_elements(
      case when jsonb_typeof(p_map->'points') = 'array' then p_map->'points' else '[]'::jsonb end
    ) as point(value)
    where jsonb_typeof(point.value) = 'object'
      and point.value->>'kind' = 'space'
      and not public.venue_map_space_point_link_valid(point.value, p_venues)
  );
$$;

revoke all on function public.venue_map_has_invalid_space_point_links(jsonb, jsonb)
  from public, anon, authenticated;

create or replace function public.sanitize_venue_map_space_point_links(
  p_map jsonb,
  p_venues jsonb
) returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_points jsonb := '[]'::jsonb;
  v_routes jsonb := '[]'::jsonb;
begin
  if p_map is null or jsonb_typeof(p_map) <> 'object' then
    return p_map;
  end if;

  with point_candidates as (
    select
      point.value,
      point.ordinality,
      left(trim(point.value->>'id'), 200) as id,
      count(*) over (partition by left(trim(point.value->>'id'), 200)) as id_occurrences
    from jsonb_array_elements(
      case when jsonb_typeof(p_map->'points') = 'array' then p_map->'points' else '[]'::jsonb end
    ) with ordinality as point(value, ordinality)
    where jsonb_typeof(point.value) = 'object'
      and jsonb_typeof(point.value->'id') = 'string'
      and length(trim(point.value->>'id')) between 1 and 200
      and point.value->>'kind' in ('space', 'parking', 'entry', 'amenity', 'path')
  )
  select coalesce(jsonb_agg(point.value order by point.ordinality), '[]'::jsonb)
    into v_points
  from point_candidates as point
  where point.id_occurrences > 1
     or point.value->>'kind' <> 'space'
     or public.venue_map_space_point_link_valid(point.value, p_venues);

  -- Retain routes through duplicated point identities so the downstream
  -- projector still sees the ambiguity and rejects every duplicate. Only a
  -- unique invalid space link is removed here with its dependent routes.
  with point_candidates as (
    select
      point.value,
      left(trim(point.value->>'id'), 200) as id,
      count(*) over (partition by left(trim(point.value->>'id'), 200)) as id_occurrences
    from jsonb_array_elements(
      case when jsonb_typeof(p_map->'points') = 'array' then p_map->'points' else '[]'::jsonb end
    ) as point(value)
    where jsonb_typeof(point.value) = 'object'
      and jsonb_typeof(point.value->'id') = 'string'
      and length(trim(point.value->>'id')) between 1 and 200
      and point.value->>'kind' in ('space', 'parking', 'entry', 'amenity', 'path')
  ), invalid_space_ids as (
    select point.id
    from point_candidates as point
    where point.id_occurrences = 1
      and point.value->>'kind' = 'space'
      and not public.venue_map_space_point_link_valid(point.value, p_venues)
  )
  select coalesce(jsonb_agg(route.value order by route.ordinality), '[]'::jsonb)
    into v_routes
  from jsonb_array_elements(
    case when jsonb_typeof(p_map->'routes') = 'array' then p_map->'routes' else '[]'::jsonb end
  ) with ordinality as route(value, ordinality)
  where not exists (
    select 1
    from jsonb_array_elements(
      case when jsonb_typeof(route.value->'pointIds') = 'array' then route.value->'pointIds' else '[]'::jsonb end
    ) as route_point(value)
    join invalid_space_ids as invalid
      on jsonb_typeof(route_point.value) = 'string'
     and invalid.id = trim(route_point.value #>> '{}')
  );

  return jsonb_set(
    jsonb_set(p_map, '{points}', v_points, true),
    '{routes}',
    v_routes,
    true
  );
end;
$$;

revoke all on function public.sanitize_venue_map_space_point_links(jsonb, jsonb)
  from public, anon, authenticated;

-- The projection wrappers introduced in migration 0032 already call this
-- internal sanitizer before both Couple and Guest projection. Extend that one
-- catalog boundary so both portals receive rain-safe and space-link-safe maps.
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
begin
  if p_map is null or jsonb_typeof(p_map) <> 'object' then
    return p_map;
  end if;

  select coalesce(jsonb_agg(contingency.value order by contingency.ordinality), '[]'::jsonb)
    into v_contingencies
  from jsonb_array_elements(
    case
      when jsonb_typeof(p_map->'rainContingencies') = 'array'
        then p_map->'rainContingencies'
      else '[]'::jsonb
    end
  ) with ordinality as contingency(value, ordinality)
  where public.venue_map_rain_contingency_valid(contingency.value, p_venues);

  v_rain_safe_map := jsonb_set(p_map, '{rainContingencies}', v_contingencies, true);
  return public.sanitize_venue_map_space_point_links(v_rain_safe_map, p_venues);
end;
$$;

revoke all on function public.sanitize_venue_map_rain_contingencies(jsonb, jsonb)
  from public, anon, authenticated;

create or replace function public.enforce_valid_venue_map_space_point_links()
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

  if public.venue_map_has_invalid_space_point_links(new.payload, v_venues) then
    raise exception using
      errcode = '23514',
      message = 'venue_map_space_point_link_invalid',
      detail = 'Link, reclassify, or remove space pins whose venue record is missing or ambiguous.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_valid_venue_map_space_point_links()
  from public, anon, authenticated;

drop trigger if exists enforce_valid_venue_map_space_point_links
  on public.org_data;
create trigger enforce_valid_venue_map_space_point_links
  before insert or update of payload, domain, organization_id
  on public.org_data
  for each row
  execute function public.enforce_valid_venue_map_space_point_links();
