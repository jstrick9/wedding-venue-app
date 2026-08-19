# Platform Console Operating Model

**Status:** Review #178 design and implementation baseline

## Purpose

The Platform Console is the internal administrative plane for the multi-tenant wedding venue platform. It is not a venue workspace and should not become a standing cross-tenant data browser.

The console manages:

- venue tenant lifecycle;
- managed venue-admin onboarding;
- invite reissue/revocation;
- venue suspension/reactivation;
- global operational metrics;
- per-venue operational metrics;
- platform audit history;
- safe, time-bounded support workflows when those are later added.

## Research synthesis

The design follows the recurring guidance from multi-tenant security and SaaS operations research:

1. **Make tenant context explicit and test it at every boundary.** Tenant context must be carried through sign-in, provisioning, authorization, and administrative actions; it cannot be treated as optional metadata. See the tenant-boundary guidance in [NHI Management Group](https://nhimg.org/articles/multi-tenant-saas-authentication-still-breaks-at-tenant-boundaries/) and the [OWASP Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html).
2. **Use database-enforced isolation as the security floor.** Supabase recommends enabling RLS, keeping policy checks close to the data, using security-definer helpers carefully, and testing with real client roles rather than only privileged SQL Editor sessions. See [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Supabase RLS performance guidance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv).
3. **Separate the admin plane from tenant data access.** Multi-tenant SaaS patterns distinguish platform administration, tenant administration, and user-facing operations. A platform operator should not receive permanent unrestricted access merely because they can create tenants. See the [SaaS template operating pillars](https://dev.to/truongpx396/the-saas-template-playbook-4796) and the [SuperTokens tenant-aware architecture guidance](https://supertokens.com/blog/secure-multi-tenant-auth).
4. **Treat privileged support as break-glass.** If support needs data access, require a named reason, time limit, visible support context, step-up authentication, and a complete audit event. The current implementation provides the audit foundation but does not grant routine cross-tenant data access.
5. **Separate operator, executive, and board metric layers.** Operators need daily activation, onboarding, errors, and support workload; executives need tenant status and business activity trends; board/billing metrics should be added only once billing data has authoritative definitions. See [SaaS metrics dashboard layering guidance](https://www.dualentry.com/blog/saas-metrics-dashboard).
6. **Use clear hierarchy and progressive disclosure.** The console should surface the few metrics that require action, then provide tenant tables, filters, and detail views. Audit and advanced controls belong one level deeper. See [SaaS admin-panel design guidance](https://taqwah.agency/blog/saas-admin-panel-design-guide).

## Information architecture

### 1. Executive overview

Global KPI cards:

- total venues;
- active venues;
- provisioning / awaiting-admin venues;
- suspended venues;
- active managed administrators;
- couples;
- guests;
- RSVPs;
- pending onboarding invites.

Global alerts:

- expired or repeatedly reissued onboarding invites;
- venues awaiting first admin claim;
- suspended venues with active pending work;
- abnormal authentication/RLS failures;
- stale tenants with no recent activity.

### 2. Venue directory

Each row/card should show:

- immutable venue slug and staff-login URL;
- lifecycle status;
- created date;
- managed admin count and status;
- couple, guest, and RSVP counts;
- pending invite state;
- last activity / last sync when available;
- suspension reason, if suspended.

Actions:

- create venue;
- copy staff login URL;
- send or reissue initial managed-admin invite;
- revoke pending invite;
- suspend venue access while retaining data;
- reactivate venue;
- open metadata/detail view.

Permanent deletion should not be a primary action. It should require an explicit retention/export review and a separate destructive workflow.

### 3. Venue detail

A per-venue view should have:

- tenant identity and branding;
- administrator and membership inventory;
- lifecycle history;
- couple/event counts;
- guest/RSVP counts;
- invite/link health;
- sync health;
- tenant-scoped audit events;
- export and recovery actions.

### 4. Platform access and audit

Track at minimum:

- platform actor;
- action;
- target organization;
- target resource;
- reason for privileged action;
- timestamp;
- result;
- request/session correlation id when server infrastructure is available.

High-risk actions include tenant suspension, reactivation, invite rotation, role changes, exports, support access, and deletion requests.

## Current implementation boundary

Implemented in the repository:

- platform/venue role separation;
- immutable generated venue slug migration;
- invite context lookup;
- managed-admin invite reissue/revocation RPCs;
- tenant suspension/reactivation RPCs;
- executive global/per-venue operational metrics RPC;
- Platform Console cards, directory metrics, invite controls, and suspend/reactivate controls;
- existing platform audit-log foundation.

Still required before production:

- live RLS/policy verification through anon, venue-admin, platform-admin, and suspended-venue sessions;
- invitation email delivery and retry monitoring;
- MFA/step-up authentication for platform administrators;
- real activity timestamps and structured server-side request logs;
- a formal break-glass support-session workflow;
- retention/export/deletion workflows;
- billing/subscription metrics if monetization is introduced;
- global platform branding and public-branding asset storage;
- one platform↔venue thread per tenant, accessible to platform admins and active venue members;
- venue address/contact validation and geocoded point data;
- point map, density map, region/choropleth-style view, and table alternative.

## Venue geocoding and mapping

The chosen provider is the open-source Nominatim service. The integration deliberately runs through the `geocode-venue` Supabase Edge Function, not from browser autocomplete. Results are cached in `venue_geocode_cache`, and the setup flow makes one request per venue address. Nominatim's public service has an absolute maximum of one request per second, requires a descriptive User-Agent/Referer, discourages heavy/bulk use, and requires OSM attribution. See the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) and [structured search API](https://nominatim.org/release-docs/latest/api/Search/).

For hundreds of venues, the platform should eventually run a controlled/hosted Nominatim instance or move to a commercial geocoder. The current public endpoint is appropriate only for deliberate, cached, low-rate setup operations, not continuous batch geocoding.

## Branding and chat

- Platform branding is stored separately from venue branding and is exposed publicly only through a safe branding RPC.
- Venue branding uses the venue's organization-scoped config; public logo assets are placed in the public branding bucket when uploaded in Supabase mode.
- The platform↔venue chat is organization-scoped, uses RLS, supports platform and venue participants, and is separated from couple/guest chat.
- Chat uses Realtime with polling fallback and is designed around one thread per venue, not a global cross-tenant stream.
