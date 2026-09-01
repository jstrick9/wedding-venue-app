-- Wedding Venue Intelligence Platform — Review #261 remediation (Phase 2 batch 4:
-- branding / metrics / geocode / claim-flow residuals).
--
-- F-261-1 (P3 grant hygiene, live-proven): geocode_try_acquire_slot is the
--   server-side Nominatim rate slot (checked by the geocode-venue Edge Function
--   before any external geocoding call). It was never revoked from
--   public/anon/authenticated, so ANYONE could call it roughly once per 1.1s and
--   acquire the slot, starving the Edge Function's geocoding (address-quality
--   features silently degrade to never-geocoded). Live-proven during the audit:
--   an anon probe returned true and acquired the slot.
--
--   Fix: the 0017 service-only revoke pattern. The service role keeps its
--   Supabase default-privileges EXECUTE grant, so the Edge Function is unaffected.

revoke execute on function public.geocode_try_acquire_slot()
  from public, anon, authenticated;
