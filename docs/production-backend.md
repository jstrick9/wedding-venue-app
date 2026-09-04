# Production Backend

This directory documents the optional production-grade backend.

- `.env.example` — browser environment template and server-secret notes
- `supabase/migrations/` — database schema, tenant policies, and service-only RPCs
- `supabase/functions/send-email/` — authenticated transactional email
- `supabase/functions/request-password-reset/` — public, throttled, membership-aware recovery email
- `src/services/backend/` — authentication and shared backend clients
- `src/services/storage/` — object storage

## Password recovery rollout

1. Apply migrations through `0022_password_recovery_delivery_and_throttle.sql`.
2. Deploy `request-password-reset` with JWT gateway verification disabled; the endpoint performs its own server-side validation and uses service-only RPCs.
3. Configure either `BREVO_API_KEY` or `RESEND_API_KEY` as an Edge Function secret. The Function versions the non-confidential production app origin and verified sender as server-side deployment defaults because the least-privilege deployment token cannot modify project secrets. Other environments can override those defaults once with `PUBLIC_APP_URL` and `PASSWORD_RESET_FROM_EMAIL`; `PASSWORD_RESET_APP_URL` remains a legacy URL fallback. There is one origin and sender for the entire SaaS environment—never per-tenant settings.
4. Set the hosted Auth Site URL to the branded production application origin. Keep `/reset/platform` and `/reset/venue` routed to `index.html`.
5. Verify platform and venue recovery with throwaway accounts and real inboxes. A green deployment alone is not delivery proof.
6. Accepted requests deliberately return before account lookup and delivery so response status/timing cannot reveal account existence. Monitor recent `password_reset_requests.delivery_state` values in operator-only database tooling; never expose that table or its service-only RPCs to browser roles.

Never place a service-role key or email-delivery credential in browser environment variables or source control.
