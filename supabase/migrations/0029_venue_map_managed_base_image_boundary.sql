-- Enforce the approved lifecycle-scoped base-map image boundary.
--
-- A canonical map could still contain an external HTTPS URL, an embedded data
-- URI, or a reference to the broader legacy venue-images bucket. Although the
-- map JSON is account-gated, those image bytes cannot be constrained by the
-- exact-publication and participant-lifecycle policy in migration 0028.
--
-- This migration intentionally does not rewrite canonical customer data or
-- delete any object. Venue owners/admins keep the legacy reference in org_data
-- so they can recover and re-upload it. Portal reads fail closed by omitting the
-- unmanaged image, and the next canonical map write must either use this
-- venue's private venue-map-images folder or remove the base image.

create or replace function public.sanitize_portal_venue_map_base_image(
  p_map jsonb,
  p_organization_id uuid
) returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_ref text;
  v_prefix text;
  v_object_name text;
begin
  if jsonb_typeof(p_map) <> 'object' then
    return p_map;
  end if;

  v_ref := p_map->>'backgroundImageUrl';
  if v_ref is null then
    return p_map;
  end if;

  if p_organization_id is not null then
    v_prefix := 'sp://venue-map-images/' || p_organization_id::text || '/';
    if left(v_ref, length(v_prefix)) = v_prefix then
      v_object_name := substring(v_ref from length(v_prefix) + 1);
      if length(v_ref) <= 1100
         and length(v_object_name) between 1 and 1024
         and v_object_name !~ '[?#[:cntrl:]]' then
        return p_map;
      end if;
    end if;
  end if;

  return p_map - 'backgroundImageUrl' - 'backgroundOpacity';
end;
$$;

revoke all on function public.sanitize_portal_venue_map_base_image(jsonb, uuid)
  from public, anon, authenticated;

-- Defense in depth for every canonical org_data write, including future server
-- code that might bypass the current CAS RPC. Existing rows are not mutated;
-- this trigger evaluates only the next INSERT/UPDATE.
create or replace function public.enforce_managed_venue_map_base_image()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_ref text;
begin
  if new.domain <> 'venueMapConfigs' or jsonb_typeof(new.payload) <> 'object' then
    return new;
  end if;

  v_ref := new.payload->>'backgroundImageUrl';
  if v_ref is not null
     and public.sanitize_portal_venue_map_base_image(new.payload, new.organization_id)
       is distinct from new.payload then
    raise exception using
      errcode = '22023',
      message = 'venue_map_base_image_must_use_managed_storage',
      detail = 'Upload the base map to this organization''s venue-map-images folder or remove it.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_managed_venue_map_base_image()
  from public, anon, authenticated;

drop trigger if exists enforce_managed_venue_map_base_image
  on public.org_data;
create trigger enforce_managed_venue_map_base_image
  before insert or update of payload, domain, organization_id
  on public.org_data
  for each row
  execute function public.enforce_managed_venue_map_base_image();

-- Guest RPCs already call this helper after authenticating the exact mapped
-- participant. Preserve all vector projection behavior from 0023/0026, but
-- remove any base image that is not protected by migration 0028 for this org.
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

  -- org_data is authoritative, including canonical JSON null. The snapshot is
  -- retained only as the established compatibility fallback when no row exists.
  select public.sanitize_portal_venue_map_base_image(
      public.build_guest_venue_map_projection(
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

  -- Keep the canonical Venue Map as the only guest destination source.
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

-- Couple/collaborator RPCs return a broader, couple-safe snapshot. Sanitize both
-- stored projection keys at read time so existing snapshot rows remain intact
-- for admin recovery while portal callers immediately fail closed.
create or replace function public.sanitize_couple_portal_map_result(
  p_result jsonb,
  p_organization_id uuid
) returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_payload jsonb;
  v_map jsonb;
begin
  if coalesce((p_result->>'ok')::boolean, false) is not true
     or jsonb_typeof(p_result->'payload') <> 'object' then
    return p_result;
  end if;

  v_payload := p_result->'payload';
  if v_payload ? 'venueMapConfigs' then
    v_map := public.sanitize_portal_venue_map_base_image(
      v_payload->'venueMapConfigs',
      p_organization_id
    );
    v_payload := jsonb_set(
      v_payload,
      '{venueMapConfigs}',
      coalesce(v_map, 'null'::jsonb),
      true
    );
  end if;
  if v_payload ? 'guestVenueMap' then
    v_map := public.sanitize_portal_venue_map_base_image(
      v_payload->'guestVenueMap',
      p_organization_id
    );
    v_payload := jsonb_set(
      v_payload,
      '{guestVenueMap}',
      coalesce(v_map, 'null'::jsonb),
      true
    );
  end if;

  return jsonb_set(p_result, '{payload}', v_payload, true);
end;
$$;

revoke all on function public.sanitize_couple_portal_map_result(jsonb, uuid)
  from public, anon, authenticated;

create or replace function public.get_couple_portal_snapshot(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context jsonb;
  v_result jsonb;
  v_organization_id uuid;
begin
  v_context := public.get_portal_invite_context('couple', p_token, null, null);
  if coalesce((v_context->>'ok')::boolean, false) is not true then return v_context; end if;
  if coalesce((v_context->>'account_required')::boolean, false)
     and not coalesce((v_context->>'authenticated')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;

  v_organization_id := (v_context->>'organization_id')::uuid;
  v_result := public.get_couple_portal_snapshot_token_impl(p_token);
  return public.sanitize_couple_portal_map_result(v_result, v_organization_id);
end;
$$;

revoke all on function public.get_couple_portal_snapshot(text)
  from public;
grant execute on function public.get_couple_portal_snapshot(text)
  to anon, authenticated;

create or replace function public.get_couple_portal_snapshot_for_venue(
  p_venue_slug text,
  p_token text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context jsonb;
  v_result jsonb;
  v_organization_id uuid;
begin
  v_context := public.get_portal_invite_context('couple', p_token, null, p_venue_slug);
  if coalesce((v_context->>'ok')::boolean, false) is not true then return v_context; end if;
  if coalesce((v_context->>'account_required')::boolean, false)
     and not coalesce((v_context->>'authenticated')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;

  v_organization_id := (v_context->>'organization_id')::uuid;
  v_result := public.get_couple_portal_snapshot_token_impl(p_token);
  return public.sanitize_couple_portal_map_result(v_result, v_organization_id);
end;
$$;

revoke all on function public.get_couple_portal_snapshot_for_venue(text, text)
  from public;
grant execute on function public.get_couple_portal_snapshot_for_venue(text, text)
  to anon, authenticated;
