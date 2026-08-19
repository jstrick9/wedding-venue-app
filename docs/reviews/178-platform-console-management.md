# Review #178 — Platform Console Management, Immutable Slugs, and Tenant Lifecycle

**Date:** 2026-08-19
**Status:** Implemented in code and migration; live Supabase validation pending

## User-approved decisions

- Keep one Supabase project with tenant isolation.
- Use a single initial platform owner with extensible platform roles.
- Platform creates venues and sends managed-admin setup links.
- Venue slug is generated from the venue name and immutable after creation.
- Venue access removal suspends the tenant and retains data.
- Invite reissue rotates and revokes the old token.
- Initial executive metrics are operational, not billing metrics.

## Fixes

### Managed-admin setup bug

Previously, if the platform owner opened a managed-admin setup link in the same browser, the onboarding screen saw the existing platform session and offered to claim the venue as the platform email.

The onboarding flow now:

- loads the pending invite context server-side;
- displays the invited email;
- prevents a signed-in account with a different email from claiming the invite;
- provides “Sign out and continue as invited admin” while preserving the invite route;
- locks the new account email to the invitation email;
- activates the venue and routes the new admin to the venue-specific staff login.

### Immutable venue slugs

- The platform console no longer asks the platform operator to type a slug.
- The database generates a URL-safe slug from the venue name.
- Name collisions receive a deterministic numeric suffix.
- A database trigger rejects later slug changes.
- The slug is the stable staff-login URL identifier.

### Platform console lifecycle controls

Migration `0008_platform_console_management.sql` adds:

- `organizations.status`: `provisioning`, `active`, `suspended`, `archived`;
- suspension metadata and reason;
- pending invite context lookup;
- invite reissue that revokes earlier pending tokens;
- invite revocation;
- tenant suspension/reactivation;
- platform audit entries for lifecycle actions;
- global and per-venue operational metrics;
- tenant-aware RLS helpers that stop suspended venue members from using the workspace;
- public couple/guest wrappers that stop new venue-bound links from resolving for suspended tenants.

The console now shows:

- total, active, provisioning, and suspended venues;
- active managed administrators;
- couples, guests, and RSVPs;
- pending onboarding invites;
- per-venue counts and status;
- immutable venue login URLs;
- reissue/revoke invite actions;
- suspend/reactivate actions.

## Research-informed design decisions

The console follows the admin-plane/tenant-plane separation pattern, database-enforced tenant isolation, explicit tenant context, audited privileged actions, break-glass support as a future time-bounded workflow, and layered operator/executive metrics. See:

- `docs/platform/PLATFORM_CONSOLE_OPERATING_MODEL.md`;
- [OWASP Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html);
- [Supabase Row Level Security documentation](https://supabase.com/docs/guides/database/postgres/row-level-security);
- [Supabase RLS performance guidance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv);
- [AWS SaaS Lens tenant health guidance](https://wa.aws.amazon.com/saas.question.REL_2.en.html).

## Live setup required

After migrations `0001`–`0007`, apply `0008_platform_console_management.sql`. Then:

1. Confirm the first platform owner membership still exists.
2. Confirm the existing Seven Paths Manor tenant has the intended immutable slug before using the platform console broadly.
3. Create a disposable test venue.
4. Reissue and revoke its pending admin invite.
5. Claim the invite with a different temporary email in another browser/profile.
6. Suspend the venue and verify venue login, couple links, and guest links are blocked.
7. Reactivate it and verify access returns.
8. Confirm per-venue metrics match seeded test records.

## Validation checkpoints

Code-level validation must include:

- `npm run typecheck`;
- `npm run lint:events`;
- strict unused-locals scan with existing unrelated warnings recorded;
- `npm run test`;
- `npm run test:coverage -- --reporter=dot`;
- `npm run build`;
- `npm run build:split`.

Live validation still requires the user's Supabase project and temporary test accounts. Do not call tenant suspension, metrics, or invite lifecycle live-certified until those RPC/RLS checks pass through the public Supabase client.
