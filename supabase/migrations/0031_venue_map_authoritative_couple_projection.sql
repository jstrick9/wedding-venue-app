-- Make the canonical Venue Map authoritative at every Couple Portal read.
--
-- Guest reads already rebuild an event-scoped public projection from the current
-- org_data row. Couple reads previously returned the denormalized snapshot map
-- and only sanitized its base-image reference. A failed snapshot refresh could
-- therefore leave couples on stale wayfinding/rain-contingency data, and a
-- legacy or defective authorized snapshot writer could retain staff-only map
-- objects in the couple response.
--
-- This migration does not rewrite customer rows or delete assets. It rebuilds a
-- public+couple (never staff) allowlisted projection at read time. A present
-- canonical row, including canonical JSON null, wins; the stored snapshot is a
-- compatibility fallback only when no canonical row exists. The guest map in a
-- couple response is also regenerated from that same source and current event
-- selection so both projection keys share one publication boundary.

create or replace function public.couple_venue_map_object_visible(
  p_object jsonb
) returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select
    jsonb_typeof(p_object) = 'object'
    and case
      -- Missing audience is the established legacy-public case. Explicit null,
      -- blank, malformed, or staff values fail closed for a couple response.
      when not (p_object ? 'audience') then true
      else coalesce(p_object->>'audience' in ('public', 'couple'), false)
    end;
$$;

revoke all on function public.couple_venue_map_object_visible(jsonb)
  from public, anon, authenticated;

-- Preserve a valid event scope for downstream clients. Malformed explicit
-- scopes retain the same reserved fail-closed marker used by browser
-- normalization instead of becoming an absent/global scope.
create or replace function public.normalize_portal_venue_map_event_scope(
  p_object jsonb
) returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_scope jsonb;
begin
  if jsonb_typeof(p_object) <> 'object'
     or not (p_object ? 'eventSpaceIds') then
    return null;
  end if;

  if jsonb_typeof(p_object->'eventSpaceIds') <> 'array' then
    return jsonb_build_array('__invalid_event_scope__');
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_object->'eventSpaceIds') as item(value)
    where jsonb_typeof(item.value) <> 'string'
       or length(trim(item.value #>> '{}')) not between 1 and 200
       or trim(item.value #>> '{}') = '__invalid_event_scope__'
  ) then
    return jsonb_build_array('__invalid_event_scope__');
  end if;

  select jsonb_agg(to_jsonb(scope.id) order by scope.ordinality)
    into v_scope
  from (
    select trim(item.value #>> '{}') as id, min(item.ordinality) as ordinality
    from jsonb_array_elements(p_object->'eventSpaceIds')
      with ordinality as item(value, ordinality)
    group by trim(item.value #>> '{}')
    order by min(item.ordinality)
    limit 100
  ) as scope;

  -- Browser normalization treats an explicit empty array as global/absent.
  return v_scope;
end;
$$;

revoke all on function public.normalize_portal_venue_map_event_scope(jsonb)
  from public, anon, authenticated;

create or replace function public.build_couple_venue_map_projection(
  p_couple_map jsonb
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
  v_drawings jsonb := '[]'::jsonb;
  v_contingencies jsonb := '[]'::jsonb;
  v_contingency jsonb;
  v_contingency_id text;
  v_outdoor_id text;
  v_indoor_id text;
  v_note text;
  v_seen_contingency_ids text[] := array[]::text[];
  v_seen_outdoor_ids text[] := array[]::text[];
  v_background_url text;
  v_background_opacity numeric;
begin
  if p_couple_map is null or jsonb_typeof(p_couple_map) <> 'object' then
    return null;
  end if;

  if jsonb_typeof(p_couple_map->'width') = 'number' then
    v_width := greatest(20::numeric, least(500::numeric, (p_couple_map->>'width')::numeric));
  end if;
  if jsonb_typeof(p_couple_map->'height') = 'number' then
    v_height := greatest(20::numeric, least(500::numeric, (p_couple_map->>'height')::numeric));
  end if;

  -- Rebuild public/couple points from declared fields. Identity counts are taken
  -- before audience filtering so a hidden object cannot cause a later duplicate
  -- to be resurrected under the same id.
  with candidates as (
    select
      point.value,
      point.ordinality,
      left(trim(point.value->>'id'), 200) as id,
      count(*) over (
        partition by left(trim(point.value->>'id'), 200)
      ) as id_occurrences
    from jsonb_array_elements(
      case
        when jsonb_typeof(p_couple_map->'points') = 'array'
          then p_couple_map->'points'
        else '[]'::jsonb
      end
    ) with ordinality as point(value, ordinality)
    where jsonb_typeof(point.value->'id') = 'string'
      and length(trim(point.value->>'id')) between 1 and 200
      and point.value->>'kind' in ('space', 'parking', 'entry', 'amenity', 'path')
  ), unambiguous as (
    select value, ordinality, id
    from candidates
    where id_occurrences = 1
      and public.couple_venue_map_object_visible(value)
  )
  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'id', point.id,
        'label', case
          when jsonb_typeof(point.value->'label') = 'string'
            then coalesce(nullif(left(trim(point.value->>'label'), 200), ''), 'Map point')
          else 'Map point'
        end,
        'description', case
          when jsonb_typeof(point.value->'description') = 'string'
            then nullif(left(trim(point.value->>'description'), 1000), '')
          else null
        end,
        'x', greatest(0::numeric, least(v_width, case
          when jsonb_typeof(point.value->'x') = 'number'
            then (point.value->>'x')::numeric
          else 0::numeric
        end)),
        'y', greatest(0::numeric, least(v_height, case
          when jsonb_typeof(point.value->'y') = 'number'
            then (point.value->>'y')::numeric
          else 0::numeric
        end)),
        'kind', point.value->>'kind',
        'audience', case
          when point.value ? 'audience' then point.value->>'audience'
          else 'public'
        end,
        'eventSpaceIds', public.normalize_portal_venue_map_event_scope(point.value),
        'venueId', case
          when jsonb_typeof(point.value->'venueId') = 'string'
            then nullif(left(trim(point.value->>'venueId'), 200), '')
          else null
        end,
        'lat', case
          when jsonb_typeof(point.value->'lat') = 'number'
           and jsonb_typeof(point.value->'lng') = 'number'
           and (point.value->>'lat')::numeric between -90 and 90
           and (point.value->>'lng')::numeric between -180 and 180
            then point.value->'lat'
          else null
        end,
        'lng', case
          when jsonb_typeof(point.value->'lat') = 'number'
           and jsonb_typeof(point.value->'lng') = 'number'
           and (point.value->>'lat')::numeric between -90 and 90
           and (point.value->>'lng')::numeric between -180 and 180
            then point.value->'lng'
          else null
        end
      )) order by point.ordinality
    ),
    '[]'::jsonb
  ) into v_points
  from unambiguous as point;

  -- A route is publishable to couples only when its own audience is visible and
  -- every ordered point survived the couple projection. Invalid/duplicate point
  -- references cannot reconnect a route across a hidden staff location.
  with route_candidates as (
    select
      route.value,
      route.ordinality,
      left(trim(route.value->>'id'), 200) as id,
      count(*) over (
        partition by left(trim(route.value->>'id'), 200)
      ) as id_occurrences,
      (
        select coalesce(jsonb_agg(to_jsonb(ids.id) order by ids.ordinality), '[]'::jsonb)
        from (
          select trim(item.value #>> '{}') as id, min(item.ordinality) as ordinality
          from jsonb_array_elements(route.value->'pointIds')
            with ordinality as item(value, ordinality)
          where jsonb_typeof(item.value) = 'string'
            and length(trim(item.value #>> '{}')) between 1 and 200
          group by trim(item.value #>> '{}')
        ) as ids
      ) as point_ids
    from jsonb_array_elements(
      case
        when jsonb_typeof(p_couple_map->'routes') = 'array'
          then p_couple_map->'routes'
        else '[]'::jsonb
      end
    ) with ordinality as route(value, ordinality)
    where jsonb_typeof(route.value->'id') = 'string'
      and length(trim(route.value->>'id')) between 1 and 200
      and jsonb_typeof(route.value->'pointIds') = 'array'
  ), valid as (
    select *
    from route_candidates as route
    where route.id_occurrences = 1
      and public.couple_venue_map_object_visible(route.value)
      and jsonb_array_length(route.point_ids) >= 2
      and not exists (
        select 1
        from jsonb_array_elements_text(route.point_ids) as route_point(id)
        where not exists (
          select 1
          from jsonb_array_elements(v_points) as allowed_point(value)
          where allowed_point.value->>'id' = route_point.id
        )
      )
  ), first_seen as (
    select distinct on (id) *
    from valid
    order by id, ordinality
  )
  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'id', route.id,
        'name', case
          when jsonb_typeof(route.value->'name') = 'string'
            then coalesce(nullif(left(trim(route.value->>'name'), 200), ''), 'Path')
          else 'Path'
        end,
        'audience', case
          when route.value ? 'audience' then route.value->>'audience'
          else 'public'
        end,
        'eventSpaceIds', public.normalize_portal_venue_map_event_scope(route.value),
        'accessibility', case
          when route.value->>'accessibility' in ('unknown', 'step-free', 'not-step-free')
            then route.value->>'accessibility'
          else 'unknown'
        end,
        'priority', case
          when route.value->>'priority' in (
            'preferred', 'standard', 'secondary', 'emergency-only'
          ) then route.value->>'priority'
          else 'standard'
        end,
        'notes', case
          when jsonb_typeof(route.value->'notes') = 'string'
            then nullif(left(trim(route.value->>'notes'), 1000), '')
          else null
        end,
        'pointIds', route.point_ids
      )) order by route.ordinality
    ),
    '[]'::jsonb
  ) into v_routes
  from first_seen as route;

  -- Rebuild drawing geometry and constrain supported shapes wholly within the
  -- authored map, matching browser normalization rather than trusting wider JSON.
  with candidates as (
    select
      drawing.value,
      drawing.ordinality,
      left(trim(drawing.value->>'id'), 200) as id,
      count(*) over (
        partition by left(trim(drawing.value->>'id'), 200)
      ) as id_occurrences
    from jsonb_array_elements(
      case
        when jsonb_typeof(p_couple_map->'drawings') = 'array'
          then p_couple_map->'drawings'
        else '[]'::jsonb
      end
    ) with ordinality as drawing(value, ordinality)
    where jsonb_typeof(drawing.value->'id') = 'string'
      and length(trim(drawing.value->>'id')) between 1 and 200
      and jsonb_typeof(drawing.value->'type') = 'string'
      and length(trim(drawing.value->>'type')) between 1 and 50
  ), unambiguous as (
    select value, ordinality, id
    from candidates
    where id_occurrences = 1
      and public.couple_venue_map_object_visible(value)
  ), dimensions as (
    select
      drawing.*,
      left(trim(drawing.value->>'type'), 50) as drawing_type,
      case when jsonb_typeof(drawing.value->'width') = 'number'
        then greatest(1::numeric, least(v_width, (drawing.value->>'width')::numeric))
        else null end as drawing_width,
      case when jsonb_typeof(drawing.value->'height') = 'number'
        then greatest(1::numeric, least(v_height, (drawing.value->>'height')::numeric))
        else null end as drawing_height,
      case when jsonb_typeof(drawing.value->'radius') = 'number'
        then greatest(1::numeric, least(least(v_width, v_height) / 2, (drawing.value->>'radius')::numeric))
        else null end as drawing_radius,
      case when jsonb_typeof(drawing.value->'x') = 'number'
        then (drawing.value->>'x')::numeric else 0::numeric end as raw_x,
      case when jsonb_typeof(drawing.value->'y') = 'number'
        then (drawing.value->>'y')::numeric else 0::numeric end as raw_y
    from unambiguous as drawing
  ), positioned as (
    select
      drawing.*,
      case
        when drawing_type = 'circle' and drawing_radius is not null
          then greatest(drawing_radius, least(v_width - drawing_radius, raw_x))
        when drawing_type in ('zone', 'rectangle') and drawing_width is not null
          then greatest(0::numeric, least(v_width - drawing_width, raw_x))
        else greatest(0::numeric, least(v_width, raw_x))
      end as drawing_x,
      case
        when drawing_type = 'circle' and drawing_radius is not null
          then greatest(drawing_radius, least(v_height - drawing_radius, raw_y))
        when drawing_type in ('zone', 'rectangle') and drawing_height is not null
          then greatest(0::numeric, least(v_height - drawing_height, raw_y))
        else greatest(0::numeric, least(v_height, raw_y))
      end as drawing_y
    from dimensions as drawing
  )
  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'id', drawing.id,
        'type', drawing.drawing_type,
        'x', drawing.drawing_x,
        'y', drawing.drawing_y,
        'width', drawing.drawing_width,
        'height', drawing.drawing_height,
        'points', case when jsonb_typeof(drawing.value->'points') = 'array' then (
          select jsonb_agg(
            jsonb_build_object(
              'x', greatest(0::numeric, least(v_width, case
                when jsonb_typeof(vertex.value->'x') = 'number'
                  then (vertex.value->>'x')::numeric
                else 0::numeric
              end)),
              'y', greatest(0::numeric, least(v_height, case
                when jsonb_typeof(vertex.value->'y') = 'number'
                  then (vertex.value->>'y')::numeric
                else 0::numeric
              end))
            ) order by vertex.ordinality
          )
          from jsonb_array_elements(drawing.value->'points')
            with ordinality as vertex(value, ordinality)
          where jsonb_typeof(vertex.value) = 'object'
        ) else null end,
        'rotation', case when jsonb_typeof(drawing.value->'rotation') = 'number'
          then greatest(-360::numeric, least(360::numeric, (drawing.value->>'rotation')::numeric))
          else null end,
        'fillColor', case when jsonb_typeof(drawing.value->'fillColor') = 'string'
          and (trim(drawing.value->>'fillColor') = 'transparent'
            or trim(drawing.value->>'fillColor') ~* '^#[0-9a-f]{3,8}$')
          then trim(drawing.value->>'fillColor') else null end,
        'strokeColor', case when jsonb_typeof(drawing.value->'strokeColor') = 'string'
          and (trim(drawing.value->>'strokeColor') = 'transparent'
            or trim(drawing.value->>'strokeColor') ~* '^#[0-9a-f]{3,8}$')
          then trim(drawing.value->>'strokeColor') else null end,
        'strokeWidth', case when jsonb_typeof(drawing.value->'strokeWidth') = 'number'
          then greatest(0.1::numeric, least(20::numeric, (drawing.value->>'strokeWidth')::numeric))
          else null end,
        'opacity', case when jsonb_typeof(drawing.value->'opacity') = 'number'
          then greatest(0::numeric, least(1::numeric, (drawing.value->>'opacity')::numeric))
          else null end,
        'fontSize', case when jsonb_typeof(drawing.value->'fontSize') = 'number'
          then greatest(1::numeric, least(100::numeric, (drawing.value->>'fontSize')::numeric))
          else null end,
        'text', case when jsonb_typeof(drawing.value->'text') = 'string'
          then nullif(left(trim(drawing.value->>'text'), 300), '')
          else null end,
        'radius', drawing.drawing_radius,
        'audience', case
          when drawing.value ? 'audience' then drawing.value->>'audience'
          else 'public'
        end,
        'eventSpaceIds', public.normalize_portal_venue_map_event_scope(drawing.value)
      )) order by drawing.ordinality
    ),
    '[]'::jsonb
  ) into v_drawings
  from positioned as drawing;

  -- Rain contingencies have no audience field. Retain only first-seen valid,
  -- non-self ids and at most one backup mapping per outdoor source.
  for v_contingency in
    select contingency.value
    from jsonb_array_elements(
      case
        when jsonb_typeof(p_couple_map->'rainContingencies') = 'array'
          then p_couple_map->'rainContingencies'
        else '[]'::jsonb
      end
    ) with ordinality as contingency(value, ordinality)
    order by contingency.ordinality
  loop
    if jsonb_typeof(v_contingency) <> 'object'
       or jsonb_typeof(v_contingency->'id') <> 'string'
       or jsonb_typeof(v_contingency->'outdoorVenueId') <> 'string'
       or jsonb_typeof(v_contingency->'indoorVenueId') <> 'string' then
      continue;
    end if;

    v_contingency_id := left(trim(v_contingency->>'id'), 200);
    v_outdoor_id := left(trim(v_contingency->>'outdoorVenueId'), 200);
    v_indoor_id := left(trim(v_contingency->>'indoorVenueId'), 200);
    if length(v_contingency_id) = 0
       or length(v_outdoor_id) = 0
       or length(v_indoor_id) = 0
       or v_outdoor_id = v_indoor_id
       or v_contingency_id = any(v_seen_contingency_ids)
       or v_outdoor_id = any(v_seen_outdoor_ids) then
      continue;
    end if;

    v_seen_contingency_ids := array_append(v_seen_contingency_ids, v_contingency_id);
    v_seen_outdoor_ids := array_append(v_seen_outdoor_ids, v_outdoor_id);
    v_note := case
      when jsonb_typeof(v_contingency->'note') = 'string'
        then nullif(left(trim(v_contingency->>'note'), 1000), '')
      else null
    end;
    v_contingencies := v_contingencies || jsonb_build_array(
      jsonb_strip_nulls(jsonb_build_object(
        'id', v_contingency_id,
        'outdoorVenueId', v_outdoor_id,
        'indoorVenueId', v_indoor_id,
        'note', v_note
      ))
    );
  end loop;

  v_background_url := case
    when jsonb_typeof(p_couple_map->'backgroundImageUrl') = 'string'
      and length(p_couple_map->>'backgroundImageUrl') between 1 and 1100
      then p_couple_map->>'backgroundImageUrl'
    else null
  end;
  if v_background_url is not null
     and jsonb_typeof(p_couple_map->'backgroundOpacity') = 'number' then
    v_background_opacity := greatest(
      0.1::numeric,
      least(1::numeric, (p_couple_map->>'backgroundOpacity')::numeric)
    );
  elsif v_background_url is not null then
    v_background_opacity := 0.85;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'width', v_width,
    'height', v_height,
    'points', v_points,
    'routes', v_routes,
    'drawings', v_drawings,
    'rainContingencies', v_contingencies,
    'backgroundImageUrl', v_background_url,
    'backgroundOpacity', v_background_opacity,
    'updatedAt', case
      when jsonb_typeof(p_couple_map->'updatedAt') = 'string'
        then coalesce(
          nullif(left(trim(p_couple_map->>'updatedAt'), 100), ''),
          '1970-01-01T00:00:00.000Z'
        )
      else '1970-01-01T00:00:00.000Z'
    end
  ));
end;
$$;

revoke all on function public.build_couple_venue_map_projection(jsonb)
  from public, anon, authenticated;

-- Keep the established wrapper signature used by both Couple Portal RPCs, but
-- make its implementation authoritative rather than snapshot-only.
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
  v_couple_map jsonb;
  v_guest_map jsonb;
  v_selected_space_ids jsonb := '[]'::jsonb;
  v_has_canonical_map boolean := false;
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

  -- A present canonical JSON null intentionally wins. Only a missing domain row
  -- permits the protected snapshot's historical couple projection as fallback.
  if not v_has_canonical_map then
    v_source_map := v_payload->'venueMapConfigs';
  end if;

  if jsonb_typeof(v_payload->'coupleEvents') = 'array'
     and jsonb_array_length(v_payload->'coupleEvents') > 0
     and jsonb_typeof(v_payload->'coupleEvents'->0->'selectedSpaces') = 'array' then
    v_selected_space_ids := v_payload->'coupleEvents'->0->'selectedSpaces';
  end if;

  v_couple_map := public.sanitize_portal_venue_map_base_image(
    public.build_couple_venue_map_projection(v_source_map),
    p_organization_id
  );
  v_guest_map := public.sanitize_portal_venue_map_base_image(
    public.build_guest_venue_map_projection_with_priority(
      v_source_map,
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
