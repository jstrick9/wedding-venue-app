import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #265 (Phase 4 batch 3 — portal deep-flow audit): pins the
 * poll-churn fixes for the two portal hotspots.
 *
 * Root cause (both portals): the 5-second cloud-sync poll rebuilt its state
 * objects with fresh identities even when the remote content was identical.
 * That identity churn cascaded through memos into draft/prefill effects:
 *
 * - F-265-1 (P3, CouplesPortal): setEvents/setSession churn → `event` →
 *   `portalConfig` memos → the portal-settings draft effect — unsaved portal
 *   personalization edits (welcome message, meal options, schedule) were
 *   silently wiped every 5 seconds while cloud sync was enabled.
 * - F-265-2 (P3, GuestPortal): setPortalData/setConfig/setRemoteCouple churn →
 *   identifiedGuest/guestRSVP memos → the RSVP prefill effect — a guest's
 *   in-progress answers (attending toggle, plus-one, name edits) were reset
 *   every 5 seconds.
 *
 * The polls now keep the previous state reference when the content is
 * unchanged, so the memo chains — and the draft/prefill effects at their end —
 * only re-run when the remote snapshot actually moved.
 */
describe('portal cloud polls do not churn state identities (F-265-1 / F-265-2)', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

  it('CouplesPortal hydrate keeps unchanged events (no draft wipe via portalConfig)', () => {
    const src = read('src/components/CouplesPortal.tsx');
    expect(src).toMatch(
      /setEvents\(\(prev\) => \(JSON\.stringify\(prev\) === JSON\.stringify\(latestEvents\) \? prev : latestEvents\)\)/,
    );
  });

  it('CouplesPortal session compare is semantic (rolling expiresAt must not churn)', () => {
    const src = read('src/components/CouplesPortal.tsx');
    const block = /setSession\(\(prev\) => \([\s\S]*?\? prev\s*: latestSession\s*\)\);/.exec(src)?.[0] ?? '';
    expect(block).not.toBe('');
    expect(block).toMatch(/prev\.eventId === latestSession\.eventId/);
    expect(block).toMatch(/prev\.collaboratorId === latestSession\.collaboratorId/);
    // saveCoupleSession rewrites expiresAt on every poll — it must NOT be part
    // of the comparison or the fix is defeated.
    expect(block).not.toMatch(/expiresAt/);
  });

  it('GuestPortal hydrate keeps unchanged portalData (no RSVP prefill wipe)', () => {
    const src = read('src/components/GuestPortal.tsx');
    expect(src).toMatch(/return sameJson\(previous, next\) \? previous : next;/);
  });

  it('GuestPortal hydrate keeps unchanged config and couple event refs', () => {
    const src = read('src/components/GuestPortal.tsx');
    expect(src).toMatch(/setRemoteCouple\(\(prev\) => \(sameJson\(prev, remoteEvent\) \? prev : remoteEvent\)\)/);
    expect(src).toMatch(/setConfig\(\(prev\) => \(sameJson\(prev, remoteConfig\) \? prev : remoteConfig\)\)/);
  });
});
