-- Harden the authoritative Venue Map guest projection.
--
-- Migration 0023 established the server-side audience/event boundary. This
-- additive replacement brings the SQL projector into parity with the canonical
-- browser projector for malformed historical JSON:
--   * reject the reserved malformed-scope sentinel at the input boundary;
--   * reject every structurally valid duplicated point/route/drawing id instead
--     of resurrecting a later public object after a hidden duplicate is filtered;
--   * accept at most one distinct, non-self rain backup per outdoor space;
--   * deeply rebuild drawing vertices and keep supported shapes wholly bounded;
--   * retain only route components that connect publishable destinations (and,
--     when an event has selected spaces, reach one of those spaces);
--   * rebuild optional values only when their JSON types are valid.
-- Existing snapshot writers and guest RPC wrappers resolve this function by its
-- unchanged signature, so replacing it hardens both cached publication and the
-- authoritative read-time projection without rewriting customer rows.

create or replace function public.build_guest_venue_map_projection(
  p_couple_map jsonb,
  p_selected_space_ids jsonb
) returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_selected_ids text[] := array[]::text[];
  v_relevant_ids text[] := array[]::text[];
  v_seen_contingency_ids text[] := array[]::text[];
  v_seen_outdoor_ids text[] := array[]::text[];
  v_points jsonb := '[]'::jsonb;
  v_routes jsonb := '[]'::jsonb;
  v_drawings jsonb := '[]'::jsonb;
  v_contingencies jsonb := '[]'::jsonb;
  v_contingency jsonb;
  v_contingency_id text;
  v_outdoor_id text;
  v_indoor_id text;
  v_note text;
  v_width numeric := 100;
  v_height numeric := 80;
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

  -- Keep first-seen selected ids deterministically. The reserved normalization
  -- sentinel is never a venue id, even when an untrusted snapshot submits it.
  if jsonb_typeof(p_selected_space_ids) = 'array' then
    with candidates as (
      select trim(item.value #>> '{}') as id, item.ordinality
      from jsonb_array_elements(p_selected_space_ids)
        with ordinality as item(value, ordinality)
      where jsonb_typeof(item.value) = 'string'
        and length(trim(item.value #>> '{}')) between 1 and 200
        and trim(item.value #>> '{}') <> '__invalid_event_scope__'
    ), first_seen as (
      select id, min(ordinality) as ordinality
      from candidates
      group by id
      order by min(ordinality)
      limit 100
    )
    select coalesce(array_agg(id order by ordinality), array[]::text[])
      into v_selected_ids
    from first_seen;
  end if;

  -- Canonical normalization is intentionally order-sensitive: a rejected
  -- duplicate source does not consume its unrelated id. A short PL/pgSQL loop
  -- mirrors that behavior exactly and keeps the first valid source mapping.
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
       or not (v_outdoor_id = any(v_selected_ids))
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

  select coalesce(array_agg(distinct relevant.id), array[]::text[])
    into v_relevant_ids
  from (
    select unnest(v_selected_ids) as id
    union all
    select contingency.value->>'indoorVenueId' as id
    from jsonb_array_elements(v_contingencies) as contingency(value)
  ) as relevant
  where length(coalesce(relevant.id, '')) between 1 and 200;

  -- Rebuild points from declared fields. Count structurally valid identities
  -- before applying audience/event scope so a hidden first occurrence cannot
  -- cause a later duplicate to be resurrected as a different portal object.
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
        when jsonb_typeof(p_couple_map->'points') = 'array' then p_couple_map->'points'
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
      and public.guest_venue_map_object_visible(value, v_relevant_ids)
      and case
        when value->>'kind' = 'space'
          then jsonb_typeof(value->'venueId') = 'string'
            and trim(value->>'venueId') = any(v_relevant_ids)
        else true
      end
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
          when jsonb_typeof(point.value->'x') = 'number' then (point.value->>'x')::numeric
          else 0::numeric
        end)),
        'y', greatest(0::numeric, least(v_height, case
          when jsonb_typeof(point.value->'y') = 'number' then (point.value->>'y')::numeric
          else 0::numeric
        end)),
        'kind', point.value->>'kind',
        'audience', case when point.value ? 'audience' then 'public' else null end,
        'eventSpaceIds', case
          when point.value ? 'eventSpaceIds' then (
            select coalesce(jsonb_agg(to_jsonb(scope.id) order by scope.ordinality), '[]'::jsonb)
            from (
              select trim(item.value #>> '{}') as id, min(item.ordinality) as ordinality
              from jsonb_array_elements(point.value->'eventSpaceIds')
                with ordinality as item(value, ordinality)
              group by trim(item.value #>> '{}')
            ) as scope
          )
          else null
        end,
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

  -- Rebuild each route's point ids as first-seen strings, reject duplicated
  -- route identities, and require the complete polyline in the public projection.
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
        when jsonb_typeof(p_couple_map->'routes') = 'array' then p_couple_map->'routes'
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
      and public.guest_venue_map_object_visible(route.value, v_relevant_ids)
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
        'audience', case when route.value ? 'audience' then 'public' else null end,
        'eventSpaceIds', case
          when route.value ? 'eventSpaceIds' then (
            select coalesce(jsonb_agg(to_jsonb(scope.id) order by scope.ordinality), '[]'::jsonb)
            from (
              select trim(item.value #>> '{}') as id, min(item.ordinality) as ordinality
              from jsonb_array_elements(route.value->'eventSpaceIds')
                with ordinality as item(value, ordinality)
              group by trim(item.value #>> '{}')
            ) as scope
          )
          else null
        end,
        'accessibility', case
          when route.value->>'accessibility' in ('unknown', 'step-free', 'not-step-free')
            then route.value->>'accessibility'
          else 'unknown'
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

  -- Mirror the client projector's graph pruning. Public path nodes exist only to
  -- support authored routes, so remove components that do not connect at least
  -- two public destinations or, for scoped weddings, never reach a selected or
  -- validated backup space.
  with recursive
  route_points as (
    select
      route.value->>'id' as route_id,
      point.id,
      point.ordinality
    from jsonb_array_elements(v_routes) as route(value)
    cross join lateral jsonb_array_elements_text(route.value->'pointIds')
      with ordinality as point(id, ordinality)
  ), base_edges as (
    select route_id, lag(id) over (partition by route_id order by ordinality) as from_id, id as to_id
    from route_points
  ), edges as (
    select from_id, to_id from base_edges where from_id is not null
    union
    select to_id, from_id from base_edges where from_id is not null
  ), nodes as (
    select distinct id from route_points
  ), walk(root_id, node_id) as (
    select id, id from nodes
    union
    select walk.root_id, edges.to_id
    from walk
    join edges on edges.from_id = walk.node_id
  ), point_meta as (
    select point.value->>'id' as id, point.value->>'kind' as kind
    from jsonb_array_elements(v_points) as point(value)
  ), eligible_roots as (
    select walk.root_id
    from walk
    join point_meta on point_meta.id = walk.node_id
    group by walk.root_id
    having count(distinct walk.node_id) filter (where point_meta.kind <> 'path') >= 2
       and (
         cardinality(v_relevant_ids) = 0
         or bool_or(point_meta.kind = 'space')
       )
  ), eligible_ids as (
    select distinct walk.node_id as id
    from walk
    join eligible_roots on eligible_roots.root_id = walk.root_id
  )
  select coalesce(jsonb_agg(route.value order by route.ordinality), '[]'::jsonb)
    into v_routes
  from jsonb_array_elements(v_routes) with ordinality as route(value, ordinality)
  where not exists (
    select 1
    from jsonb_array_elements_text(route.value->'pointIds') as route_point(id)
    where not exists (select 1 from eligible_ids where eligible_ids.id = route_point.id)
  );

  select coalesce(jsonb_agg(point.value order by point.ordinality), '[]'::jsonb)
    into v_points
  from jsonb_array_elements(v_points) with ordinality as point(value, ordinality)
  where point.value->>'kind' <> 'path'
     or exists (
       select 1
       from jsonb_array_elements(v_routes) as route(value)
       cross join lateral jsonb_array_elements_text(route.value->'pointIds') as route_point(id)
       where route_point.id = point.value->>'id'
     );

  -- Drawing vertices receive their own strict coordinate allowlist. Supported
  -- rectangles/zones and circles are positioned wholly inside the map, matching
  -- browser and Couple projections without rewriting the canonical drawing.
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
        when jsonb_typeof(p_couple_map->'drawings') = 'array' then p_couple_map->'drawings'
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
      and public.guest_venue_map_object_visible(value, v_relevant_ids)
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
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'x', greatest(0::numeric, least(v_width, case
                  when jsonb_typeof(vertex.value->'x') = 'number' then (vertex.value->>'x')::numeric
                  else 0::numeric
                end)),
                'y', greatest(0::numeric, least(v_height, case
                  when jsonb_typeof(vertex.value->'y') = 'number' then (vertex.value->>'y')::numeric
                  else 0::numeric
                end))
              ) order by vertex.ordinality
            ),
            '[]'::jsonb
          )
          from jsonb_array_elements(drawing.value->'points')
            with ordinality as vertex(value, ordinality)
          where jsonb_typeof(vertex.value) = 'object'
        ) else null end,
        'rotation', case when jsonb_typeof(drawing.value->'rotation') = 'number'
          then greatest(-360::numeric, least(360::numeric, (drawing.value->>'rotation')::numeric)) else null end,
        'fillColor', case when jsonb_typeof(drawing.value->'fillColor') = 'string'
          and (trim(drawing.value->>'fillColor') = 'transparent'
            or trim(drawing.value->>'fillColor') ~* '^#[0-9a-f]{3,8}$')
          then trim(drawing.value->>'fillColor') else null end,
        'strokeColor', case when jsonb_typeof(drawing.value->'strokeColor') = 'string'
          and (trim(drawing.value->>'strokeColor') = 'transparent'
            or trim(drawing.value->>'strokeColor') ~* '^#[0-9a-f]{3,8}$')
          then trim(drawing.value->>'strokeColor') else null end,
        'strokeWidth', case when jsonb_typeof(drawing.value->'strokeWidth') = 'number'
          then greatest(0.1::numeric, least(20::numeric, (drawing.value->>'strokeWidth')::numeric)) else null end,
        'opacity', case when jsonb_typeof(drawing.value->'opacity') = 'number'
          then greatest(0::numeric, least(1::numeric, (drawing.value->>'opacity')::numeric)) else null end,
        'fontSize', case when jsonb_typeof(drawing.value->'fontSize') = 'number'
          then greatest(1::numeric, least(100::numeric, (drawing.value->>'fontSize')::numeric)) else null end,
        'text', case when jsonb_typeof(drawing.value->'text') = 'string'
          then nullif(left(trim(drawing.value->>'text'), 300), '') else null end,
        'radius', drawing.drawing_radius,
        'audience', case when drawing.value ? 'audience' then 'public' else null end,
        'eventSpaceIds', case
          when drawing.value ? 'eventSpaceIds' then (
            select coalesce(jsonb_agg(to_jsonb(scope.id) order by scope.ordinality), '[]'::jsonb)
            from (
              select trim(item.value #>> '{}') as id, min(item.ordinality) as ordinality
              from jsonb_array_elements(drawing.value->'eventSpaceIds')
                with ordinality as item(value, ordinality)
              group by trim(item.value #>> '{}')
            ) as scope
          )
          else null
        end
      )) order by drawing.ordinality
    ),
    '[]'::jsonb
  ) into v_drawings
  from positioned as drawing;

  v_background_url := case
    when jsonb_typeof(p_couple_map->'backgroundImageUrl') = 'string'
      then p_couple_map->>'backgroundImageUrl'
    else null
  end;
  if v_background_url is not null and (
    length(v_background_url) = 0
    or length(v_background_url) > 5 * 1024 * 1024
    or not (
      v_background_url ~* '^https://'
      or v_background_url ~* '^data:image/(png|jpeg|webp|gif);base64,'
      or v_background_url ~* '^sp://(venue-map-images|venue-images)/[a-z0-9-]+/'
    )
  ) then
    v_background_url := null;
  end if;

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
        then nullif(left(trim(p_couple_map->>'updatedAt'), 100), '')
      else null
    end
  ));
end;
$$;

revoke all on function public.build_guest_venue_map_projection(jsonb, jsonb)
  from public, anon, authenticated;
