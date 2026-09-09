-- Keep the canonical Venue Map publication boundary aligned with the editor.
--
-- The Venue Map Designer is an administrative surface, and its canonical
-- `org_data` row directly controls the map projected into couple and guest
-- portals. Migration 0010 treated unlisted domains as writable by every active
-- organization member, which allowed a staff member to bypass the UI and
-- replace or delete `venueMapConfigs` through the generic REST table endpoint.
--
-- The existing org_data INSERT/UPDATE/DELETE policies all call this helper, so
-- replacing it atomically protects every write operation without broadening a
-- role or changing unrelated business-domain behavior.

create or replace function public.org_data_write_allowed(
  p_org_id uuid,
  p_domain text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(p_domain) not in (
      'config',
      'rbacroles',
      'rbacgroups',
      'rbacaudit',
      'securitysettings',
      'orginvites',
      'communicationtemplates',
      'operationssettings',
      'venuemapconfigs'
    )
    or public.has_org_role(
      p_org_id,
      array['owner','admin']::public.app_role[]
    )
$$;
