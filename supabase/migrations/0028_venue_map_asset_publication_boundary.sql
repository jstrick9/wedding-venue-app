-- Bind private Venue Map base images to the same publication and access lifecycle
-- as the canonical map that references them.
--
-- Migration 0023 created a private bucket, but its SELECT policy allowed any
-- active portal account to list and sign every object under its organization's
-- folder. That included abandoned uploads and unpublished replacement maps, and
-- the account row alone did not prove that the mapped wedding participant was
-- still present, unrevoked, and unexpired.
--
-- This additive policy replacement preserves the operational authoring model:
--   * active owners/admins may manage every map asset in their venue folder;
--   * other active venue members may read only the currently published base map;
--   * a personal portal account may read only that exact published object while
--     its current snapshot participant remains active and unexpired;
--   * legacy organizations without a canonical org_data row use only the mapped
--     account's own protected snapshot as a compatibility fallback;
--   * no object is deleted automatically.

create or replace function public.can_read_venue_map_image(
  p_object_name text
) returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_expected_ref text;
  v_canonical_map jsonb;
  v_has_canonical_map boolean := false;
  v_account record;
  v_source_map jsonb;
  v_event jsonb;
  v_participant jsonb;
  v_expiry_text text;
  v_expires_at timestamptz;
begin
  if v_user_id is null
     or p_object_name is null
     or length(p_object_name) = 0
     or length(p_object_name) > 1024
     or split_part(p_object_name, '/', 1)
       !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  begin
    v_organization_id := split_part(p_object_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;

  if not exists (
    select 1
    from public.organizations organization
    where organization.id = v_organization_id
      and coalesce(organization.status, 'active') = 'active'
  ) then
    return false;
  end if;

  -- Only the roles that can publish the canonical Venue Map retain folder-wide
  -- access to drafts and abandoned uploads.
  if public.has_org_role(
    v_organization_id,
    array['owner','admin']::public.app_role[]
  ) then
    return true;
  end if;

  v_expected_ref := 'sp://venue-map-images/' || p_object_name;

  select data.payload
    into v_canonical_map
  from public.org_data as data
  where data.organization_id = v_organization_id
    and data.domain = 'venueMapConfigs'
  limit 1;
  v_has_canonical_map := found;

  -- Staff who can read the venue workspace still need the published base layer,
  -- but not every unpublished object in the folder.
  if v_has_canonical_map
     and public.is_org_member(v_organization_id)
     and jsonb_typeof(v_canonical_map) = 'object'
     and v_canonical_map->>'backgroundImageUrl' = v_expected_ref then
    return true;
  end if;

  -- A user can hold accounts for more than one wedding. Evaluate only current
  -- active mappings for this organization and return on the first entitled one.
  for v_account in
    select
      account.couple_id,
      account.participant_type,
      account.participant_id,
      snapshot.payload
    from public.portal_accounts as account
    join public.couple_portal_snapshots as snapshot
      on snapshot.organization_id = account.organization_id
     and snapshot.couple_id = account.couple_id
    where account.organization_id = v_organization_id
      and account.user_id = v_user_id
      and account.status = 'active'
  loop
    -- A present canonical row, including canonical JSON null, always wins. The
    -- snapshot is only the same legacy fallback used by the guest-map RPC.
    v_source_map := case
      when v_has_canonical_map then v_canonical_map
      else v_account.payload->'venueMapConfigs'
    end;
    if jsonb_typeof(v_source_map) <> 'object'
       or v_source_map->>'backgroundImageUrl' is distinct from v_expected_ref then
      continue;
    end if;

    v_event := case
      when jsonb_typeof(v_account.payload->'coupleEvents') = 'array'
       and jsonb_array_length(v_account.payload->'coupleEvents') > 0
       and jsonb_typeof(v_account.payload->'coupleEvents'->0) = 'object'
        then v_account.payload->'coupleEvents'->0
      else null
    end;
    if v_event is null then
      continue;
    end if;

    v_participant := null;
    v_expiry_text := null;
    v_expires_at := null;

    if v_account.participant_type = 'couple'
       and v_account.participant_id = 'primary-couple' then
      -- The primary account is represented by the event itself. Its durable
      -- account mapping remains current until the event access window expires.
      v_expiry_text := nullif(trim(v_event->>'inviteExpiresAt'), '');
    elsif v_account.participant_type in ('couple', 'collaborator') then
      select collaborator.value
        into v_participant
      from jsonb_array_elements(
        case
          when jsonb_typeof(v_event->'collaborators') = 'array'
            then v_event->'collaborators'
          else '[]'::jsonb
        end
      ) as collaborator(value)
      where jsonb_typeof(collaborator.value) = 'object'
        and collaborator.value->>'id' = v_account.participant_id
        and (
          v_account.participant_type <> 'couple'
          or collaborator.value->>'role' = 'couple'
        )
      limit 1;

      if v_participant is null
         or length(trim(coalesce(v_participant->>'revokedAt', ''))) > 0 then
        continue;
      end if;
      v_expiry_text := nullif(trim(v_participant->>'inviteExpiresAt'), '');
    elsif v_account.participant_type = 'guest' then
      select guest.value
        into v_participant
      from jsonb_array_elements(
        case
          when jsonb_typeof(v_account.payload->'coupleGuests') = 'array'
            then v_account.payload->'coupleGuests'
          else '[]'::jsonb
        end
      ) as guest(value)
      where jsonb_typeof(guest.value) = 'object'
        and guest.value->>'id' = v_account.participant_id
      limit 1;

      if v_participant is null
         or coalesce(v_participant->>'allowPortalAccess', 'true') = 'false'
         or length(trim(coalesce(v_participant->>'tokenRevokedAt', ''))) > 0 then
        continue;
      end if;
      v_expiry_text := nullif(trim(v_participant->>'tokenExpiresAt'), '');
    else
      continue;
    end if;

    if v_expiry_text is not null then
      begin
        v_expires_at := v_expiry_text::timestamptz;
      exception when others then
        -- Explicitly malformed lifecycle metadata must not become perpetual
        -- access merely because it could not be parsed.
        continue;
      end;
    else
      -- Match the existing portal lifecycle fallback: event end date, then event
      -- date, closes access at the start of the second following day.
      v_expires_at := public.snapshot_token_expires_at(v_account.payload, null);
    end if;

    if v_expires_at is not null and v_expires_at <= now() then
      continue;
    end if;

    return true;
  end loop;

  return false;
end;
$$;

revoke all on function public.can_read_venue_map_image(text)
  from public, anon;
grant execute on function public.can_read_venue_map_image(text)
  to authenticated;

-- Replace folder-wide portal-account access with the helper above. The helper
-- also keeps tenant suspension and current publication in the decision.
drop policy if exists "storage_venue_map_images_select_authorized" on storage.objects;
create policy "storage_venue_map_images_select_authorized"
  on storage.objects for select
  using (
    bucket_id = 'venue-map-images'
    and public.can_read_venue_map_image(name)
  );

-- Uploading an image creates an unpublished draft asset, so storage writes must
-- match the owner/admin-only canonical map publication boundary from 0024/0027.
drop policy if exists "storage_venue_map_images_write_admins" on storage.objects;
create policy "storage_venue_map_images_write_admins"
  on storage.objects for all
  using (
    bucket_id = 'venue-map-images'
    and exists (
      select 1
      from public.organizations organization
      where organization.id::text = split_part(name, '/', 1)
        and coalesce(organization.status, 'active') = 'active'
    )
    and public.has_org_role(
      case
        when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then split_part(name, '/', 1)::uuid
        else null
      end,
      array['owner','admin']::public.app_role[]
    )
  )
  with check (
    bucket_id = 'venue-map-images'
    and exists (
      select 1
      from public.organizations organization
      where organization.id::text = split_part(name, '/', 1)
        and coalesce(organization.status, 'active') = 'active'
    )
    and public.has_org_role(
      case
        when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then split_part(name, '/', 1)::uuid
        else null
      end,
      array['owner','admin']::public.app_role[]
    )
  );
