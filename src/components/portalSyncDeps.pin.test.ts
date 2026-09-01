import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #263 (Phase 4 batch 1 — cross-cutting correctness sweep): pins the
 * stale-venueSlug fix.
 *
 * F-263-1 (P4 stale closure): the CouplesPortal cloud-sync effect and the
 * GuestPortal hydration effect both closed over the `venueSlug` prop without
 * listing it in their dependency arrays. Both portals take the slug from the
 * URL hash at render time, so following a different venue's link swaps the
 * prop *without remounting* the component — and the 5-second pollers kept
 * hydrating (and, for the couple portal, saving snapshots) against the
 * previous venue until a remount happened. Both effects now list `venueSlug`
 * so they re-subscribe when the venue changes.
 */
describe('portal sync effects re-subscribe on venue changes (F-263-1)', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

  it('CouplesPortal cloud-sync effect includes venueSlug in its deps', () => {
    const src = read('src/components/CouplesPortal.tsx');
    expect(src).toMatch(/\[cloudToken, event\?\.id, session\?\.eventId, venueSlug\]/);
  });

  it('GuestPortal hydration effect includes venueSlug in its deps', () => {
    const src = read('src/components/GuestPortal.tsx');
    expect(src).toMatch(/\[coupleEventId, guestToken, isCouplePortal, venueSlug\]/);
  });
});
