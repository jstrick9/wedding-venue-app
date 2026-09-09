-- Preserve the Venue Map malformed-scope fail-closed contract in SQL.
--
-- Client normalization uses `__invalid_event_scope__` as an internal sentinel
-- when an explicit eventSpaceIds value is null or malformed. The JavaScript
-- projector always rejects an object carrying that sentinel, even if an
-- untrusted selected-space array contains the same string. Migration 0023's SQL
-- helper treated every non-empty string as a possible venue id, which allowed a
-- crafted couple snapshot to make the sentinel match and expose the malformed
-- public object to that event's guests.

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
           or trim(invalid_scope.value #>> '{}') = '__invalid_event_scope__'
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
