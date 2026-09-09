-- Quarantine historical Venue Maps whose saved coordinate frame was explicitly
-- malformed, while preserving the genuinely omitted legacy 100x80 frame.
--
-- Existing canonical and projected-snapshot rows remain untouched so an admin
-- can recover them. Portal reads receive no map until an admin publishes a
-- valid frame, and the table-edge trigger rejects future malformed frames.

create or replace function public.venue_map_dimension_is_invalid(
  p_map jsonb,
  p_key text
) returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_dimension numeric;
begin
  if p_map is null
     or jsonb_typeof(p_map) <> 'object'
     or not (p_map ? p_key) then
    return false;
  end if;

  if jsonb_typeof(p_map->p_key) is distinct from 'number' then
    return true;
  end if;

  begin
    v_dimension := (p_map->>p_key)::numeric;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      return true;
  end;

  return not (v_dimension between 20 and 500);
end;
$$;

revoke all on function public.venue_map_dimension_is_invalid(jsonb, text)
  from public, anon, authenticated;

create or replace function public.venue_map_has_invalid_frame(
  p_map jsonb
) returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select public.venue_map_dimension_is_invalid(p_map, 'width')
      or public.venue_map_dimension_is_invalid(p_map, 'height');
$$;

revoke all on function public.venue_map_has_invalid_frame(jsonb)
  from public, anon, authenticated;

-- Recompose migration 0042's current identity-first portal boundary and add a
-- whole-document frame gate before every audience/catalog/geometry projector.
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
  v_contingencies jsonb := '[]'::jsonb;
  v_rain_safe_map jsonb;
  v_space_safe_map jsonb;
begin
  if public.venue_map_has_invalid_frame(p_map) then
    return null;
  end if;

  v_structural_safe_map := public.sanitize_venue_map_structural_integrity(p_map);
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

create or replace function public.enforce_valid_venue_map_frame()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.domain <> 'venueMapConfigs' then
    return new;
  end if;

  if public.venue_map_has_invalid_frame(new.payload) then
    raise exception using
      errcode = '23514',
      message = 'venue_map_frame_invalid',
      detail = 'Explicit Venue Map width and height must each be finite numbers from 20 through 500.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_valid_venue_map_frame()
  from public, anon, authenticated;

drop trigger if exists enforce_valid_venue_map_frame
  on public.org_data;
create trigger enforce_valid_venue_map_frame
  before insert or update of payload, domain, organization_id
  on public.org_data
  for each row
  execute function public.enforce_valid_venue_map_frame();
