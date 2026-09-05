-- Venue Map privacy boundary and guest-readable base-map assets.
--
-- The browser snapshot stores a couple-safe venueMapConfigs value and may cache
-- a guestVenueMap projection. Guest RPC implementations created before this
-- migration returned venueMapConfigs directly. The response wrapper below never
-- trusts either client-supplied projection: it rebuilds the guest-safe,
-- event-space-scoped map from allowlisted venue-authored objects at the database
-- boundary. The authoritative org_data map wins; the protected snapshot copy is
-- used only when a legacy organization has no map-domain row. A canonical JSON
-- null remains null rather than resurrecting a stale snapshot map.
-- Deployment order: apply this migration before releasing clients that publish
-- couple-only layers; pre-0023 guest RPCs return the broader couple map.

-- Treat legacy audience-less objects as public, but fail closed for any
-- explicitly malformed audience/event-scope metadata.
create or replace function public.guest_venue_map_object_visible(
  p_object jsonb,
  p_relevant_space_ids text[]
) returns boolean
language sql
immutable
set search_path = public
as $$
  select
    jsonb_typeof(p_object) = 'object'
    and case
      when p_object ? 'audience' then p_object->>'audience' = 'public'
      else true
    end
    and case
      when not (p_object ? 'eventSpaceIds') then true
      when jsonb_typeof(p_object->'eventSpaceIds') <> 'array' then false
      when jsonb_array_length(p_object->'eventSpaceIds') = 0 then true
      when exists (
        select 1
        from jsonb_array_elements(p_object->'eventSpaceIds') as invalid_scope(value)
        where jsonb_typeof(invalid_scope.value) <> 'string'
           or length(trim(invalid_scope.value #>> '{}')) = 0
      ) then false
      else exists (
        select 1
        from jsonb_array_elements_text(p_object->'eventSpaceIds') as scope(value)
        where scope.value = any(p_relevant_space_ids)
      )
    end;
$$;

revoke all on function public.guest_venue_map_object_visible(jsonb, text[])
  from public, anon, authenticated;

-- Rebuild a guest map only from the venue-authored couple-map objects already
-- stored on the server. A couple save may choose event spaces, but it cannot
-- inject or modify map geometry, labels, URLs, notes, or private layers.
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
  v_points jsonb := '[]'::jsonb;
  v_routes jsonb := '[]'::jsonb;
  v_drawings jsonb := '[]'::jsonb;
  v_contingencies jsonb := '[]'::jsonb;
  v_background_url text;
begin
  if p_couple_map is null or jsonb_typeof(p_couple_map) <> 'object' then
    return null;
  end if;

  if jsonb_typeof(p_selected_space_ids) = 'array' then
    select coalesce(array_agg(selected.id), array[]::text[])
      into v_selected_ids
    from (
      select distinct trim(item.value #>> '{}') as id
      from jsonb_array_elements(p_selected_space_ids) as item(value)
      where jsonb_typeof(item.value) = 'string'
        and length(trim(item.value #>> '{}')) between 1 and 200
      limit 100
    ) as selected;
  end if;

  select coalesce(array_agg(distinct relevant.id), array[]::text[])
    into v_relevant_ids
  from (
    select unnest(v_selected_ids) as id
    union all
    select contingency.value->>'indoorVenueId' as id
    from jsonb_array_elements(
      case
        when jsonb_typeof(p_couple_map->'rainContingencies') = 'array'
          then p_couple_map->'rainContingencies'
        else '[]'::jsonb
      end
    ) as contingency(value)
    where contingency.value->>'outdoorVenueId' = any(v_selected_ids)
  ) as relevant
  where length(coalesce(relevant.id, '')) between 1 and 200;

  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'id', point.value->'id',
        'label', point.value->'label',
        'description', point.value->'description',
        'x', point.value->'x',
        'y', point.value->'y',
        'kind', point.value->'kind',
        'audience', point.value->'audience',
        'eventSpaceIds', point.value->'eventSpaceIds',
        'venueId', point.value->'venueId',
        'lat', point.value->'lat',
        'lng', point.value->'lng'
      )) order by point.ordinality
    ),
    '[]'::jsonb
  ) into v_points
  from jsonb_array_elements(
    case
      when jsonb_typeof(p_couple_map->'points') = 'array' then p_couple_map->'points'
      else '[]'::jsonb
    end
  ) with ordinality as point(value, ordinality)
  where public.guest_venue_map_object_visible(point.value, v_relevant_ids)
    and jsonb_typeof(point.value->'id') = 'string'
    and length(point.value->>'id') between 1 and 200
    and jsonb_typeof(point.value->'label') = 'string'
    and jsonb_typeof(point.value->'x') = 'number'
    and jsonb_typeof(point.value->'y') = 'number'
    and point.value->>'kind' in ('space', 'parking', 'entry', 'amenity', 'path')
    and case
      when point.value->>'kind' = 'space'
        then point.value->>'venueId' = any(v_relevant_ids)
      else true
    end;

  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'id', route.value->'id',
        'name', route.value->'name',
        'audience', route.value->'audience',
        'eventSpaceIds', route.value->'eventSpaceIds',
        'accessibility', route.value->'accessibility',
        'notes', route.value->'notes',
        'pointIds', route.value->'pointIds'
      )) order by route.ordinality
    ),
    '[]'::jsonb
  ) into v_routes
  from jsonb_array_elements(
    case
      when jsonb_typeof(p_couple_map->'routes') = 'array' then p_couple_map->'routes'
      else '[]'::jsonb
    end
  ) with ordinality as route(value, ordinality)
  where public.guest_venue_map_object_visible(route.value, v_relevant_ids)
    and jsonb_typeof(route.value->'id') = 'string'
    and length(route.value->>'id') between 1 and 200
    and jsonb_typeof(route.value->'name') = 'string'
    and jsonb_typeof(route.value->'pointIds') = 'array'
    and jsonb_array_length(route.value->'pointIds') >= 2
    and not exists (
      select 1
      from jsonb_array_elements(route.value->'pointIds') as invalid_point_id(value)
      where jsonb_typeof(invalid_point_id.value) <> 'string'
    )
    and not exists (
      select 1
      from jsonb_array_elements_text(route.value->'pointIds') as route_point(id)
      where not exists (
        select 1
        from jsonb_array_elements(v_points) as allowed_point(value)
        where allowed_point.value->>'id' = route_point.id
      )
    );

  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'id', drawing.value->'id',
        'type', drawing.value->'type',
        'x', drawing.value->'x',
        'y', drawing.value->'y',
        'width', drawing.value->'width',
        'height', drawing.value->'height',
        'points', drawing.value->'points',
        'rotation', drawing.value->'rotation',
        'fillColor', drawing.value->'fillColor',
        'strokeColor', drawing.value->'strokeColor',
        'strokeWidth', drawing.value->'strokeWidth',
        'opacity', drawing.value->'opacity',
        'fontSize', drawing.value->'fontSize',
        'text', drawing.value->'text',
        'radius', drawing.value->'radius',
        'audience', drawing.value->'audience',
        'eventSpaceIds', drawing.value->'eventSpaceIds'
      )) order by drawing.ordinality
    ),
    '[]'::jsonb
  ) into v_drawings
  from jsonb_array_elements(
    case
      when jsonb_typeof(p_couple_map->'drawings') = 'array' then p_couple_map->'drawings'
      else '[]'::jsonb
    end
  ) with ordinality as drawing(value, ordinality)
  where public.guest_venue_map_object_visible(drawing.value, v_relevant_ids)
    and jsonb_typeof(drawing.value->'id') = 'string'
    and length(drawing.value->>'id') between 1 and 200
    and jsonb_typeof(drawing.value->'type') = 'string'
    and jsonb_typeof(drawing.value->'x') = 'number'
    and jsonb_typeof(drawing.value->'y') = 'number';

  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'id', contingency.value->'id',
        'outdoorVenueId', contingency.value->'outdoorVenueId',
        'indoorVenueId', contingency.value->'indoorVenueId',
        'note', contingency.value->'note'
      )) order by contingency.ordinality
    ),
    '[]'::jsonb
  ) into v_contingencies
  from jsonb_array_elements(
    case
      when jsonb_typeof(p_couple_map->'rainContingencies') = 'array'
        then p_couple_map->'rainContingencies'
      else '[]'::jsonb
    end
  ) with ordinality as contingency(value, ordinality)
  where contingency.value->>'outdoorVenueId' = any(v_selected_ids)
    and length(coalesce(contingency.value->>'id', '')) between 1 and 200
    and length(coalesce(contingency.value->>'indoorVenueId', '')) between 1 and 200;

  v_background_url := p_couple_map->>'backgroundImageUrl';
  if v_background_url is not null and not (
    v_background_url ~* '^https://'
    or v_background_url ~* '^data:image/(png|jpeg|webp|gif);base64,'
    or v_background_url ~* '^sp://(venue-map-images|venue-images)/[a-z0-9-]+/'
  ) then
    v_background_url := null;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'width', p_couple_map->'width',
    'height', p_couple_map->'height',
    'points', v_points,
    'routes', v_routes,
    'drawings', v_drawings,
    'rainContingencies', v_contingencies,
    'backgroundImageUrl', v_background_url,
    'backgroundOpacity', case when v_background_url is not null then p_couple_map->'backgroundOpacity' else null end,
    'updatedAt', p_couple_map->'updatedAt'
  ));
end;
$$;

revoke all on function public.build_guest_venue_map_projection(jsonb, jsonb)
  from public, anon, authenticated;

-- Couple/collaborator saves replace a whole denormalized snapshot. Preserve the
-- venue-controlled map under the row lock and regenerate the guest projection
-- from that canonical server copy plus the couple's selected spaces. This keeps
-- both public save wrappers from becoming a map-publication bypass.
create or replace function public.save_couple_portal_snapshot_token_impl(
  p_token text,
  p_payload jsonb,
  p_base_updated_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_couple_id text;
  v_expires_at timestamptz;
  v_row_updated_at timestamptz;
  v_existing_payload jsonb;
  v_next_payload jsonb;
  v_couple_map jsonb;
  v_guest_map jsonb;
  v_selected_space_ids jsonb := '[]'::jsonb;
begin
  if p_token is null or length(p_token) < 16 or length(p_token) > 512 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload');
  end if;

  v_hash := encode(sha256(p_token::bytea), 'hex');
  select s.couple_id, s.updated_at,
         public.snapshot_token_expires_at(s.payload, p_token), s.payload
    into v_couple_id, v_row_updated_at, v_expires_at, v_existing_payload
  from public.couple_portal_snapshots s
  where s.couple_token_hash = v_hash
     or s.collaborator_token_hashes @> jsonb_build_array(v_hash)
  limit 1
  for update;

  if v_couple_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_expires_at is not null and v_expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;
  if p_base_updated_at is not null and v_row_updated_at <> p_base_updated_at then
    return jsonb_build_object('ok', false, 'error', 'conflict', 'updated_at', v_row_updated_at);
  end if;

  if jsonb_typeof(p_payload->'coupleEvents') = 'array'
     and jsonb_array_length(p_payload->'coupleEvents') > 0
     and jsonb_typeof(p_payload->'coupleEvents'->0->'selectedSpaces') = 'array' then
    v_selected_space_ids := p_payload->'coupleEvents'->0->'selectedSpaces';
  end if;

  v_couple_map := v_existing_payload->'venueMapConfigs';
  v_guest_map := public.build_guest_venue_map_projection(
    v_couple_map,
    v_selected_space_ids
  );
  v_next_payload := jsonb_set(
    p_payload - 'venueMapConfigs' - 'guestVenueMap',
    '{venueMapConfigs}',
    coalesce(v_couple_map, 'null'::jsonb),
    true
  );
  v_next_payload := jsonb_set(
    v_next_payload,
    '{guestVenueMap}',
    coalesce(v_guest_map, 'null'::jsonb),
    true
  );

  update public.couple_portal_snapshots
  set payload = v_next_payload, updated_at = now()
  where couple_id = v_couple_id;

  return jsonb_build_object('ok', true, 'couple_id', v_couple_id);
end;
$$;

revoke all on function public.save_couple_portal_snapshot_token_impl(text, jsonb, timestamptz)
  from public, anon, authenticated;

create or replace function public.apply_guest_venue_map_projection(
  p_result jsonb,
  p_couple_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_map jsonb;
  v_portal_config jsonb;
  v_result jsonb;
begin
  if coalesce((p_result->>'ok')::boolean, false) is not true then
    return p_result;
  end if;

  -- org_data is the venue-admin canonical source. The snapshot copy is only a
  -- compatibility fallback for legacy organizations that do not yet have a
  -- venueMapConfigs domain row. Because org_data.payload is NOT NULL, a present
  -- JSON null wins over the fallback and cannot resurrect a deleted stale map.
  select public.build_guest_venue_map_projection(
      coalesce(canonical_map.payload, s.payload->'venueMapConfigs'),
      case
        when jsonb_typeof(s.payload->'coupleEvents') = 'array'
          and jsonb_array_length(s.payload->'coupleEvents') > 0
          and jsonb_typeof(s.payload->'coupleEvents'->0->'selectedSpaces') = 'array'
          then s.payload->'coupleEvents'->0->'selectedSpaces'
        else '[]'::jsonb
      end
    )
    into v_guest_map
  from public.couple_portal_snapshots s
  left join public.org_data canonical_map
    on canonical_map.organization_id = s.organization_id
   and canonical_map.domain = 'venueMapConfigs'
  where s.couple_id = p_couple_id
  limit 1;

  v_result := jsonb_set(
    p_result,
    '{venue_map}',
    coalesce(v_guest_map, 'null'::jsonb),
    true
  );

  -- Legacy wayfindingPoints remain stored for backwards compatibility, but the
  -- canonical Venue Map is now the only guest destination source. Do not keep
  -- shipping an unused second map-like dataset to guest clients.
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

create or replace function public.get_guest_couple_portal_snapshot(
  p_couple_id text,
  p_guest_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context jsonb;
  v_result jsonb;
begin
  v_context := public.get_portal_invite_context('guest', p_guest_token, p_couple_id, null);
  if coalesce((v_context->>'ok')::boolean, false) is not true then return v_context; end if;
  if coalesce((v_context->>'account_required')::boolean, false)
     and not coalesce((v_context->>'authenticated')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;

  v_result := public.get_guest_couple_portal_snapshot_token_impl(
    p_couple_id,
    p_guest_token
  );
  return public.apply_guest_venue_map_projection(v_result, p_couple_id);
end;
$$;

revoke all on function public.get_guest_couple_portal_snapshot(text, text)
  from public;
grant execute on function public.get_guest_couple_portal_snapshot(text, text)
  to anon, authenticated;

create or replace function public.get_guest_couple_portal_snapshot_for_venue(
  p_venue_slug text,
  p_couple_id text,
  p_guest_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context jsonb;
  v_result jsonb;
begin
  v_context := public.get_portal_invite_context('guest', p_guest_token, p_couple_id, p_venue_slug);
  if coalesce((v_context->>'ok')::boolean, false) is not true then return v_context; end if;
  if coalesce((v_context->>'account_required')::boolean, false)
     and not coalesce((v_context->>'authenticated')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;

  v_result := public.get_guest_couple_portal_snapshot_token_impl(
    p_couple_id,
    p_guest_token
  );
  return public.apply_guest_venue_map_projection(v_result, p_couple_id);
end;
$$;

revoke all on function public.get_guest_couple_portal_snapshot_for_venue(text, text, text)
  from public;
grant execute on function public.get_guest_couple_portal_snapshot_for_venue(text, text, text)
  to anon, authenticated;

-- Base images are shared presentation assets, not staff-only annotations. They
-- live in their own private bucket: venue admins can write them, while an active
-- personal portal account for an event at that venue can obtain a signed URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'venue-map-images',
  'venue-map-images',
  false,
  3145728,
  array['image/png','image/jpeg','image/webp','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storage_venue_map_images_select_authorized" on storage.objects;
create policy "storage_venue_map_images_select_authorized"
  on storage.objects for select
  using (
    bucket_id = 'venue-map-images'
    and exists (
      select 1
      from public.organizations o
      where o.id::text = split_part(name, '/', 1)
        and coalesce(o.status, 'active') = 'active'
    )
    and (
      public.is_org_member(
        case
          when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then split_part(name, '/', 1)::uuid
          else null
        end
      )
      or exists (
        select 1
        from public.portal_accounts a
        where a.organization_id::text = split_part(name, '/', 1)
          and a.user_id = auth.uid()
          and a.status = 'active'
      )
    )
  );

drop policy if exists "storage_venue_map_images_write_admins" on storage.objects;
create policy "storage_venue_map_images_write_admins"
  on storage.objects for all
  using (
    bucket_id = 'venue-map-images'
    and exists (
      select 1
      from public.organizations o
      where o.id::text = split_part(name, '/', 1)
        and coalesce(o.status, 'active') = 'active'
    )
    and public.has_org_role(
      case
        when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then split_part(name, '/', 1)::uuid
        else null
      end,
      array['owner','admin','planner']::public.app_role[]
    )
  )
  with check (
    bucket_id = 'venue-map-images'
    and exists (
      select 1
      from public.organizations o
      where o.id::text = split_part(name, '/', 1)
        and coalesce(o.status, 'active') = 'active'
    )
    and public.has_org_role(
      case
        when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then split_part(name, '/', 1)::uuid
        else null
      end,
      array['owner','admin','planner']::public.app_role[]
    )
  );
