import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #261 (Phase 2 batch 4): pins the grant-hygiene fix for the geocode
 * rate slot.
 *
 * F-261-1 (P3, live-proven): geocode_try_acquire_slot — the server-side
 * Nominatim rate slot consumed by the geocode-venue Edge Function — was
 * executable by anon/authenticated (no revoke existed), so anyone could burn
 * the 1.1-second slot and starve platform geocoding. The audit's anon probe
 * acquired the slot (returned true). Migration 0019 applies the 0017
 * service-only revoke pattern; the service role keeps its default-privileges
 * grant, so the Edge Function is unaffected.
 */
describe('Review #261 migration pins (service-only geocode rate slot)', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/0019_review_261_revoke_geocode_rate_slot.sql'),
    'utf8',
  );

  it('revokes the geocode rate slot from public/anon/authenticated (F-261-1)', () => {
    expect(migration).toMatch(
      /revoke execute on function public\.geocode_try_acquire_slot\(\)\s*\n\s*from public, anon, authenticated;/,
    );
  });

  it('does not grant the slot to any client role', () => {
    expect(migration).not.toMatch(/grant execute/i);
  });
});
