-- Preserve venue-authored route priority through the authoritative guest
-- projection. Legacy/malformed values default to Standard. Routine client
-- directions exclude Emergency-only routes; this migration does not create an
-- emergency-navigation mode or alter any existing route row.

create or replace function public.build_guest_venue_map_projection_with_priority(
  p_couple_map jsonb,
  p_selected_space_ids jsonb
) returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_projection jsonb;
  v_routes jsonb;
begin
  v_projection := public.build_guest_venue_map_projection(
    p_couple_map,
    p_selected_space_ids
  );
  if jsonb_typeof(v_projection) <> 'object'
     or jsonb_typeof(v_projection->'routes') <> 'array' then
    return v_projection;
  end if;

  select coalesce(
      jsonb_agg(
        projected.value || jsonb_build_object(
          'priority',
          coalesce(
            (
              select case
                -- Canonical normalization requires unique route ids. Historical
                -- duplicates fail closed to Standard rather than borrowing
                -- metadata from a route the base projector may have rejected.
                when count(*) = 1 then max(
                  case
                    when source.value->>'priority' in (
                      'preferred',
                      'standard',
                      'secondary',
                      'emergency-only'
                    ) then source.value->>'priority'
                    else 'standard'
                  end
                )
                else 'standard'
              end
              from jsonb_array_elements(
                case
                  when jsonb_typeof(p_couple_map->'routes') = 'array'
                    then p_couple_map->'routes'
                  else '[]'::jsonb
                end
              ) as source(value)
              where jsonb_typeof(source.value) = 'object'
                and source.value->>'id' = projected.value->>'id'
            ),
            'standard'
          )
        )
        order by projected.ordinality
      ),
      '[]'::jsonb
    )
    into v_routes
  from jsonb_array_elements(v_projection->'routes')
    with ordinality as projected(value, ordinality);

  return jsonb_set(v_projection, '{routes}', v_routes, true);
end;
$$;

revoke all on function public.build_guest_venue_map_projection_with_priority(jsonb, jsonb)
  from public, anon, authenticated;

-- Retain migration 0029's managed-image sanitation while switching the guest
-- route projector to the priority-preserving wrapper above.
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
        coalesce(canonical_map.payload, snapshot.payload->'venueMapConfigs'),
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
