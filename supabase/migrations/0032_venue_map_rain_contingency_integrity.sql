-- Keep published rain-contingency plans referentially valid against the current
-- venue catalog.
--
-- Venue records can be removed or have their indoor/outdoor capability changed
-- independently of the canonical map. Existing map JSON remains untouched for
-- admin recovery, but invalid pairs must not be presented to couples/guests or
-- expand a guest's event-space scope. Future map publications fail closed until
-- every pair is repaired or removed.

create or replace function public.venue_map_rain_role_eligible(
  p_venue jsonb,
  p_role text
) returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select
    jsonb_typeof(p_venue) = 'object'
    and jsonb_typeof(p_venue->'id') = 'string'
    and length(trim(p_venue->>'id')) between 1 and 200
    and case
      -- Explicit environment metadata wins. Missing/null/blank metadata uses
      -- the same category fallback as the browser editor for legacy venues.
      when not (p_venue ? 'environment')
        or jsonb_typeof(p_venue->'environment') = 'null'
        or (
          jsonb_typeof(p_venue->'environment') = 'string'
          and length(trim(p_venue->>'environment')) = 0
        ) then case
          when p_role = 'source'
            then coalesce(trim(p_venue->>'category'), '') in ('outdoor', 'ceremony')
          when p_role = 'backup'
            then coalesce(trim(p_venue->>'category'), '') not in ('outdoor', 'ceremony')
          else false
        end
      when jsonb_typeof(p_venue->'environment') = 'string' then case
        when p_role = 'source'
          then trim(p_venue->>'environment') in ('outdoor', 'both')
        when p_role = 'backup'
          then trim(p_venue->>'environment') in ('indoor', 'both')
        else false
      end
      else false
    end;
$$;

revoke all on function public.venue_map_rain_role_eligible(jsonb, text)
  from public, anon, authenticated;

create or replace function public.venue_map_rain_contingency_valid(
  p_contingency jsonb,
  p_venues jsonb
) returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  with venue_candidates as (
    select venue.value
    from jsonb_array_elements(
      case when jsonb_typeof(p_venues) = 'array' then p_venues else '[]'::jsonb end
    ) as venue(value)
    where jsonb_typeof(venue.value) = 'object'
      and jsonb_typeof(venue.value->'id') = 'string'
      and length(trim(venue.value->>'id')) between 1 and 200
  ), source_matches as (
    select value
    from venue_candidates
    where trim(value->>'id') = trim(p_contingency->>'outdoorVenueId')
  ), backup_matches as (
    select value
    from venue_candidates
    where trim(value->>'id') = trim(p_contingency->>'indoorVenueId')
  )
  select
    jsonb_typeof(p_contingency) = 'object'
    and jsonb_typeof(p_contingency->'id') = 'string'
    and length(trim(p_contingency->>'id')) between 1 and 200
    and jsonb_typeof(p_contingency->'outdoorVenueId') = 'string'
    and length(trim(p_contingency->>'outdoorVenueId')) between 1 and 200
    and jsonb_typeof(p_contingency->'indoorVenueId') = 'string'
    and length(trim(p_contingency->>'indoorVenueId')) between 1 and 200
    and trim(p_contingency->>'outdoorVenueId') <> trim(p_contingency->>'indoorVenueId')
    and (
      select count(*) = 1
        and coalesce(bool_and(public.venue_map_rain_role_eligible(value, 'source')), false)
      from source_matches
    )
    and (
      select count(*) = 1
        and coalesce(bool_and(public.venue_map_rain_role_eligible(value, 'backup')), false)
      from backup_matches
    );
$$;

revoke all on function public.venue_map_rain_contingency_valid(jsonb, jsonb)
  from public, anon, authenticated;

-- Portal-only sanitation: preserve every non-contingency field, but remove stale
-- or ineligible pairs before either audience projector can use them for scope.
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

  return jsonb_set(p_map, '{rainContingencies}', v_contingencies, true);
end;
$$;

revoke all on function public.sanitize_venue_map_rain_contingencies(jsonb, jsonb)
  from public, anon, authenticated;

create or replace function public.venue_map_has_invalid_rain_contingencies(
  p_map jsonb,
  p_venues jsonb
) returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_map is null or jsonb_typeof(p_map) <> 'object'
     or not (p_map ? 'rainContingencies') then
    return false;
  end if;

  if jsonb_typeof(p_map->'rainContingencies') <> 'array' then
    return true;
  end if;

  return exists (
    select 1
    from jsonb_array_elements(p_map->'rainContingencies') as contingency(value)
    where not public.venue_map_rain_contingency_valid(contingency.value, p_venues)
  );
end;
$$;

revoke all on function public.venue_map_has_invalid_rain_contingencies(jsonb, jsonb)
  from public, anon, authenticated;

-- This write guard evaluates only the proposed venue-map row. It never rewrites
-- an existing stale map and does not block venue-catalog maintenance; read-time
-- sanitation remains authoritative if a later catalog edit invalidates a pair.
create or replace function public.enforce_valid_venue_map_rain_contingencies()
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

  if public.venue_map_has_invalid_rain_contingencies(new.payload, v_venues) then
    raise exception using
      errcode = '23514',
      message = 'venue_map_rain_contingency_invalid',
      detail = 'Repair or remove rain backups whose spaces are missing or no longer eligible.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_valid_venue_map_rain_contingencies()
  from public, anon, authenticated;

drop trigger if exists enforce_valid_venue_map_rain_contingencies
  on public.org_data;
create trigger enforce_valid_venue_map_rain_contingencies
  before insert or update of payload, domain, organization_id
  on public.org_data
  for each row
  execute function public.enforce_valid_venue_map_rain_contingencies();

-- Guest reads validate against the current canonical venue catalog. A protected
-- snapshot venue list is used only for legacy organizations without that domain.
create or replace function public.apply_guest_venue_map_projection(
  p_result jsonb,
  p_couple_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_guest_map jsonb;
  v_portal_config jsonb;
  v_result jsonb;
begin
  if coalesce((p_result->>'ok')::boolean, false) is not true then
    return p_result;
  end if;

  select public.sanitize_portal_venue_map_base_image(
      public.build_guest_venue_map_projection_with_priority(
        public.sanitize_venue_map_rain_contingencies(
          coalesce(canonical_map.payload, snapshot.payload->'venueMapConfigs'),
          coalesce(canonical_venues.payload, snapshot.payload->'venues')
        ),
        case
          when jsonb_typeof(snapshot.payload->'coupleEvents') = 'array'
            and jsonb_array_length(snapshot.payload->'coupleEvents') > 0
            and jsonb_typeof(snapshot.payload->'coupleEvents'->0->'selectedSpaces') = 'array'
            then snapshot.payload->'coupleEvents'->0->'selectedSpaces'
          else '[]'::jsonb
        end
      ),
      snapshot.organization_id
    )
    into v_guest_map
  from public.couple_portal_snapshots as snapshot
  left join public.org_data as canonical_map
    on canonical_map.organization_id = snapshot.organization_id
   and canonical_map.domain = 'venueMapConfigs'
  left join public.org_data as canonical_venues
    on canonical_venues.organization_id = snapshot.organization_id
   and canonical_venues.domain = 'venues'
  where snapshot.couple_id = p_couple_id
  limit 1;

  v_result := jsonb_set(
    p_result,
    '{venue_map}',
    coalesce(v_guest_map, 'null'::jsonb),
    true
  );

  if jsonb_typeof(v_result->'portal_config') = 'object' then
    select coalesce(
        jsonb_object_agg(
          config.key,
          case
            when jsonb_typeof(config.value) = 'object'
              then config.value - 'wayfindingPoints'
            else '{}'::jsonb
          end
        ),
        '{}'::jsonb
      )
      into v_portal_config
    from jsonb_each(v_result->'portal_config') as config(key, value);
    v_result := jsonb_set(v_result, '{portal_config}', v_portal_config, true);
  end if;

  return v_result;
end;
$$;

revoke all on function public.apply_guest_venue_map_projection(jsonb, text)
  from public, anon, authenticated;

-- Couple reads use one catalog-sanitized source for both the public+couple map
-- and the nested guest map, retaining migration 0031's canonical-row semantics.
create or replace function public.sanitize_couple_portal_map_result(
  p_result jsonb,
  p_organization_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_payload jsonb;
  v_source_map jsonb;
  v_source_venues jsonb;
  v_portal_source_map jsonb;
  v_couple_map jsonb;
  v_guest_map jsonb;
  v_selected_space_ids jsonb := '[]'::jsonb;
  v_has_canonical_map boolean := false;
  v_has_canonical_venues boolean := false;
begin
  if coalesce((p_result->>'ok')::boolean, false) is not true
     or jsonb_typeof(p_result->'payload') <> 'object' then
    return p_result;
  end if;

  v_payload := p_result->'payload';

  select data.payload
    into v_source_map
  from public.org_data as data
  where data.organization_id = p_organization_id
    and data.domain = 'venueMapConfigs'
  limit 1;
  v_has_canonical_map := found;
  if not v_has_canonical_map then
    v_source_map := v_payload->'venueMapConfigs';
  end if;

  select data.payload
    into v_source_venues
  from public.org_data as data
  where data.organization_id = p_organization_id
    and data.domain = 'venues'
  limit 1;
  v_has_canonical_venues := found;
  if not v_has_canonical_venues then
    v_source_venues := v_payload->'venues';
  end if;

  if jsonb_typeof(v_payload->'coupleEvents') = 'array'
     and jsonb_array_length(v_payload->'coupleEvents') > 0
     and jsonb_typeof(v_payload->'coupleEvents'->0->'selectedSpaces') = 'array' then
    v_selected_space_ids := v_payload->'coupleEvents'->0->'selectedSpaces';
  end if;

  v_portal_source_map := public.sanitize_venue_map_rain_contingencies(
    v_source_map,
    v_source_venues
  );
  v_couple_map := public.sanitize_portal_venue_map_base_image(
    public.build_couple_venue_map_projection(v_portal_source_map),
    p_organization_id
  );
  v_guest_map := public.sanitize_portal_venue_map_base_image(
    public.build_guest_venue_map_projection_with_priority(
      v_portal_source_map,
      v_selected_space_ids
    ),
    p_organization_id
  );

  v_payload := jsonb_set(
    v_payload,
    '{venueMapConfigs}',
    coalesce(v_couple_map, 'null'::jsonb),
    true
  );
  v_payload := jsonb_set(
    v_payload,
    '{guestVenueMap}',
    coalesce(v_guest_map, 'null'::jsonb),
    true
  );

  return jsonb_set(p_result, '{payload}', v_payload, true);
end;
$$;

revoke all on function public.sanitize_couple_portal_map_result(jsonb, uuid)
  from public, anon, authenticated;
