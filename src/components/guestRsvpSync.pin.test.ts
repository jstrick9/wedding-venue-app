import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #269 (Phase 4 batch 7 — optimistic-update rollback sweep): pins the
 * guest RSVP cloud-failure honesty fix (F-269-1).
 *
 * The RSVP submit is deliberately optimistic/local-first: local state and
 * localStorage are updated immediately, then the backend submit runs. But the
 * backend resolves `false` on RPC error (and rejects on network failure), and
 * the handler ignored BOTH — the guest saw the success screen while the
 * couple's other devices never received the RSVP. Worse, the 5-second cloud
 * poll then replaced the visible submissions with the stale remote, wiping
 * the locally-saved RSVP from view too.
 *
 * Fixed: both failure paths emit the typed `spm_cloud_sync_error` event
 * (App-level toast: saved on this device, submit again), and the poll keeps
 * the local submission when the remote has none (remote still wins when it
 * HAS an RSVP).
 */
describe('guest RSVP cloud failures are surfaced, local copy preserved (F-269-1)', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/GuestPortal.tsx'), 'utf8');

  it('submit handles the resolved-false RPC failure, not just rejections', () => {
    const block = /\.then\(\(ok\) => \{[\s\S]*?if \(!ok\) warnRsvpSyncFailed\(\);[\s\S]*?\}\);/.exec(src)?.[0] ?? '';
    expect(block).not.toBe('');
    expect(block).toMatch(/setIsSubmittingRSVP\(false\);/);
  });

  it('network rejection also warns instead of silently clearing the flag', () => {
    expect(src).toMatch(/\.catch\(\(\) => \{\s*setIsSubmittingRSVP\(false\);\s*warnRsvpSyncFailed\(\);\s*\}\);/);
  });

  it('failure warning goes through the typed cloud-sync-error channel', () => {
    expect(src).toMatch(/emit\('spm_cloud_sync_error', \{\s*domain: 'guest rsvp',/);
  });

  it('poll keeps the local submission when the remote has no RSVP', () => {
    expect(src).toMatch(/submissions: rsvp \? \[rsvp\] : previous\.submissions,/);
  });
});
