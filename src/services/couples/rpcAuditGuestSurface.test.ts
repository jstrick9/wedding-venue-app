import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #258 (Phase 2 batch 1 — guest/couple public RPC cluster): pins the
 * migration that fixes the four findings from the RPC audit.
 *
 * F-258-1 (P1): the 0008 rename left four *_unchecked RPCs executable by
 * anon/authenticated (RENAME preserves grants; live-proven during the audit —
 * they answered the anon probe while the revoked claim RPCs hid with PGRST202).
 * submit_guest_couple_rsvp_unchecked still carried the PRE-#245 body (no row
 * lock, no RSVP-deadline check).
 *
 * F-258-2 (P2): the couple-side whole-payload save had no compare-and-swap, so
 * a guest submission between the couple's pull and push was silently lost.
 *
 * F-258-3 (P3): submit_guest_rsvp did delete+insert with no lock and no
 * unique(guest_id) backstop — concurrent double-submits duplicated rows.
 *
 * F-258-4 (P3): unbounded guest input (free-text fields and the whole jsonb
 * submission payload) on anon-exposed RPCs.
 */
describe('Review #258 migration pins (guest/couple RPC cluster)', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/0018_review_258_rpc_audit_guest_couple_surface.sql'),
    'utf8',
  );

  it('revokes the orphaned *_unchecked functions (F-258-1)', () => {
    expect(migration).toMatch(
      /revoke execute on function public\.get_couple_portal_snapshot_unchecked\(text\)\s*\n\s*from public, anon, authenticated;/,
    );
    expect(migration).toMatch(
      /revoke execute on function public\.get_guest_couple_portal_snapshot_unchecked\(text, text\)\s*\n\s*from public, anon, authenticated;/,
    );
    // the pre-#245 orphan is dropped outright, not just revoked
    expect(migration).toMatch(
      /drop function if exists public\.submit_guest_couple_rsvp_unchecked\(text, text, jsonb\);/,
    );
    // the new CAS internal is service-only too
    expect(migration).toMatch(
      /revoke execute on function public\.save_couple_portal_snapshot_unchecked\(text, jsonb, timestamptz\)\s*\n\s*from public, anon, authenticated;/,
    );
  });

  it('the save path is compare-and-swap guarded (F-258-2)', () => {
    // optional base version parameter on all three save entry points
    expect(migration).toMatch(
      /create or replace function public\.save_couple_portal_snapshot\(\s*p_token text,\s*p_payload jsonb,\s*p_base_updated_at timestamptz default null/,
    );
    expect(migration).toMatch(
      /create or replace function public\.save_couple_portal_snapshot_for_venue\(\s*p_venue_slug text,\s*p_token text,\s*p_payload jsonb,\s*p_base_updated_at timestamptz default null/,
    );
    // the conflict refusal itself
    expect(migration).toMatch(/'conflict'/);
    expect(migration).toMatch(/v_row_updated_at <> p_base_updated_at/);
    // the version check reads under the same lock as the write
    expect(migration).toMatch(/limit 1\s*\n\s*for update;/);
    // old signatures are replaced (grants follow the new signatures)
    expect(migration).toMatch(/drop function if exists public\.save_couple_portal_snapshot\(text, jsonb\);/);
    expect(migration).toMatch(/drop function if exists public\.save_couple_portal_snapshot_for_venue\(text, text, jsonb\);/);
  });

  it('submit_guest_rsvp locks the guest row and caps all text fields (F-258-3/F-258-4)', () => {
    expect(migration).toMatch(
      /from public\.guests\s*\n\s*where g\.portal_token_hash = v_hash\s*\n\s*for update;/,
    );
    for (const field of [
      'invalid_plus_one_name',
      'invalid_plus_one_meal_choice',
      'invalid_dietary_notes',
      'invalid_special_needs',
      'invalid_notes',
      'invalid_attending_days',
    ]) {
      expect(migration).toContain(`'error', '${field}'`);
    }
  });

  it('submit_guest_couple_rsvp caps the submission payload size (F-258-4)', () => {
    expect(migration).toMatch(/octet_length\(p_submission::text\) > 20000/);
    // and keeps the #245 row lock
    expect(migration.match(/for update;/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
