-- Prevent an explicitly malformed route priority from failing open as Standard.
--
-- A missing priority remains Standard-compatible for routes created before
-- priority metadata existed. Existing canonical rows remain untouched so the
-- admin client can quarantine and repair them explicitly. Portal projections
-- omit affected whole routes, and future writes reject them at the table edge.

create or replace function public.venue_map_route_priority_is_invalid(
  p_route jsonb
) returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_typeof(p_route) = 'object'
    and p_route ? 'priority'
    and (
      jsonb_typeof(p_route->'priority') is distinct from 'string'
      or p_route->>'priority' not in (
        'preferred', 'standard', 'secondary', 'emergency-only'
      )
    );
$$;

revoke all on function public.venue_map_route_priority_is_invalid(jsonb)
  from public, anon, authenticated;

create or replace function public.venue_map_has_invalid_route_priorities(
  p_map jsonb
) returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when jsonb_typeof(p_map->'routes') = 'array' then exists (
      select 1
      from jsonb_array_elements(p_map->'routes') as route(value)
      where public.venue_map_route_priority_is_invalid(route.value)
    )
    else false
  end;
$$;

revoke all on function public.venue_map_has_invalid_route_priorities(jsonb)
  from public, anon, authenticated;

-- Portal-only fail-closed sanitation. Preserve route order and every unrelated
-- map field, but remove each whole route with an explicitly invalid priority.
-- If that route shares an identity, remove the whole identity group before
-- filtering so a malformed twin cannot make another occurrence appear unique.
create or replace function public.sanitize_venue_map_route_priorities(
  p_map jsonb
) returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_routes jsonb := '[]'::jsonb;
begin
  if p_map is null
     or jsonb_typeof(p_map) <> 'object'
     or not (p_map ? 'routes')
     or jsonb_typeof(p_map->'routes') <> 'array' then
    return p_map;
  end if;

  with route_candidates as (
    select
      route.value,
      route.ordinality,
      case
        when jsonb_typeof(route.value) = 'object'
         and jsonb_typeof(route.value->'id') = 'string'
         and length(trim(route.value->>'id')) between 1 and 200
          then trim(route.value->>'id')
        else null
      end as id,
      public.venue_map_route_priority_is_invalid(route.value) as priority_invalid
    from jsonb_array_elements(p_map->'routes')
      with ordinality as route(value, ordinality)
  ), invalid_priority_ids as (
    select distinct route.id
    from route_candidates as route
    where route.id is not null and route.priority_invalid
  )
  select coalesce(jsonb_agg(route.value order by route.ordinality), '[]'::jsonb)
    into v_routes
  from route_candidates as route
  where not route.priority_invalid
    and not exists (
      select 1
      from invalid_priority_ids as invalid
      where invalid.id = route.id
    );

  return jsonb_set(p_map, '{routes}', v_routes, true);
end;
$$;

revoke all on function public.sanitize_venue_map_route_priorities(jsonb)
  from public, anon, authenticated;

-- Both current Guest and Couple read paths already pass their canonical-or-
-- snapshot source through this portal-only sanitizer before audience projection.
-- Preserve migrations 0037–0039's current catalog, collision, space-link, and
-- drawing checks while composing route-priority sanitation at the same boundary.
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
  return public.sanitize_venue_map_route_priorities(
    public.sanitize_venue_map_drawings(v_space_safe_map)
  );
end;
$$;

revoke all on function public.sanitize_venue_map_rain_contingencies(jsonb, jsonb)
  from public, anon, authenticated;

create or replace function public.enforce_valid_venue_map_route_priorities()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.domain <> 'venueMapConfigs' then
    return new;
  end if;

  if public.venue_map_has_invalid_route_priorities(new.payload) then
    raise exception using
      errcode = '23514',
      message = 'venue_map_route_priority_invalid',
      detail = 'Explicit route priorities must be Preferred, Standard, Secondary, or Emergency-only.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_valid_venue_map_route_priorities()
  from public, anon, authenticated;

drop trigger if exists enforce_valid_venue_map_route_priorities
  on public.org_data;
create trigger enforce_valid_venue_map_route_priorities
  before insert or update of payload, domain, organization_id
  on public.org_data
  for each row
  execute function public.enforce_valid_venue_map_route_priorities();
