-- Optimistic concurrency for the canonical Venue Map row.
--
-- Geometry cannot be safely auto-merged. Venue Map Designer therefore saves
-- against the org_data.updated_at revision it loaded. A stale editor receives
-- the current server map and revision without changing the row; the UI can keep
-- its draft, reload the latest map, or explicitly force an overwrite.
--
-- Once the CAS RPC exists, direct REST writes to this one domain must stop or an
-- older client/direct upsert could still bypass revision checks. Other domain
-- authorization remains unchanged from migrations 0010/0024.
create or replace function public.org_data_write_allowed(
  p_org_id uuid,
  p_domain text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when lower(p_domain) = 'venuemapconfigs' then false
    when lower(p_domain) in (
      'config',
      'rbacroles',
      'rbacgroups',
      'rbacaudit',
      'securitysettings',
      'orginvites',
      'communicationtemplates',
      'operationssettings'
    ) then public.has_org_role(
      p_org_id,
      array['owner','admin']::public.app_role[]
    )
    else true
  end
$$;

create or replace function public.save_venue_map_config(
  p_organization_id uuid,
  p_payload jsonb,
  p_expected_updated_at timestamptz default null,
  p_expected_missing boolean default false,
  p_force boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_payload jsonb;
  v_current_updated_at timestamptz;
  v_next_payload jsonb := coalesce(p_payload, 'null'::jsonb);
  v_saved_updated_at timestamptz;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_organization_id is null
     or not public.has_org_role(
       p_organization_id,
       array['owner','admin']::public.app_role[]
     ) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if jsonb_typeof(v_next_payload) not in ('object', 'null') then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload');
  end if;
  if pg_column_size(v_next_payload) > 10 * 1024 * 1024 then
    return jsonb_build_object('ok', false, 'error', 'payload_too_large');
  end if;

  -- A row lock cannot protect the first-save case because the row does not yet
  -- exist. Serialize this one org/domain key so two concurrent creators produce
  -- one save plus one structured conflict instead of a unique-key exception.
  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':venueMapConfigs', 0)
  );

  select data.payload, data.updated_at
    into v_current_payload, v_current_updated_at
  from public.org_data as data
  where data.organization_id = p_organization_id
    and data.domain = 'venueMapConfigs'
  for update;

  if found then
    if not p_force and (
      p_expected_missing
      or p_expected_updated_at is null
      or v_current_updated_at <> p_expected_updated_at
    ) then
      return jsonb_build_object(
        'ok', false,
        'error', 'conflict',
        'current_payload', v_current_payload,
        'current_updated_at', v_current_updated_at
      );
    end if;

    update public.org_data
    set payload = v_next_payload
    where organization_id = p_organization_id
      and domain = 'venueMapConfigs'
    returning updated_at into v_saved_updated_at;
  else
    if not p_force and not p_expected_missing then
      return jsonb_build_object(
        'ok', false,
        'error', 'conflict',
        'current_payload', null,
        'current_updated_at', null
      );
    end if;

    insert into public.org_data (organization_id, domain, payload)
    values (p_organization_id, 'venueMapConfigs', v_next_payload)
    returning updated_at into v_saved_updated_at;
  end if;

  return jsonb_build_object(
    'ok', true,
    'updated_at', v_saved_updated_at
  );
end;
$$;

revoke all on function public.save_venue_map_config(
  uuid, jsonb, timestamptz, boolean, boolean
) from public, anon;
grant execute on function public.save_venue_map_config(
  uuid, jsonb, timestamptz, boolean, boolean
) to authenticated;
