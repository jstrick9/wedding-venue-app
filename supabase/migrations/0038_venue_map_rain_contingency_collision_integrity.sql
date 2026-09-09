-- Reject ambiguous rain-plan identities and competing backup mappings.
--
-- Existing canonical rows remain untouched for admin recovery. On portal reads,
-- every occurrence in a duplicate plan-id or duplicate outdoor-source set is
-- omitted before a backup can expand Guest scope. Future publications must
-- resolve every collision explicitly.

create or replace function public.venue_map_has_rain_contingency_collisions(
  p_map jsonb
) returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  with candidates as (
    select
      trim(contingency.value->>'id') as id,
      trim(contingency.value->>'outdoorVenueId') as outdoor_venue_id
    from jsonb_array_elements(
      case
        when jsonb_typeof(p_map->'rainContingencies') = 'array'
          then p_map->'rainContingencies'
        else '[]'::jsonb
      end
    ) as contingency(value)
    where jsonb_typeof(contingency.value) = 'object'
      and jsonb_typeof(contingency.value->'id') = 'string'
      and length(trim(contingency.value->>'id')) between 1 and 200
      and jsonb_typeof(contingency.value->'outdoorVenueId') = 'string'
      and length(trim(contingency.value->>'outdoorVenueId')) between 1 and 200
      and jsonb_typeof(contingency.value->'indoorVenueId') = 'string'
      and length(trim(contingency.value->>'indoorVenueId')) between 1 and 200
  )
  select exists (
    select 1 from candidates group by id having count(*) > 1
  ) or exists (
    select 1 from candidates group by outdoor_venue_id having count(*) > 1
  );
$$;

revoke all on function public.venue_map_has_rain_contingency_collisions(jsonb)
  from public, anon, authenticated;

-- Migration 0032's authoritative Couple and Guest wrappers both call this
-- internal boundary. Count collisions before current-catalog filtering so an
-- invalid twin cannot make another occurrence appear canonical.
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
  return public.sanitize_venue_map_space_point_links(v_rain_safe_map, p_venues);
end;
$$;

revoke all on function public.sanitize_venue_map_rain_contingencies(jsonb, jsonb)
  from public, anon, authenticated;

create or replace function public.enforce_valid_venue_map_rain_contingency_collisions()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.domain <> 'venueMapConfigs' or jsonb_typeof(new.payload) <> 'object' then
    return new;
  end if;

  if public.venue_map_has_rain_contingency_collisions(new.payload) then
    raise exception using
      errcode = '23514',
      message = 'venue_map_rain_contingency_collision',
      detail = 'Rain-plan IDs and outdoor source mappings must each be unique.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_valid_venue_map_rain_contingency_collisions()
  from public, anon, authenticated;

drop trigger if exists enforce_valid_venue_map_rain_contingency_collisions
  on public.org_data;
create trigger enforce_valid_venue_map_rain_contingency_collisions
  before insert or update of payload, domain, organization_id
  on public.org_data
  for each row
  execute function public.enforce_valid_venue_map_rain_contingency_collisions();
