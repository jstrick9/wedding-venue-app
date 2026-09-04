import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #268 (Phase 4 batch 6 — unhandled-rejections sweep): pins the portal
 * cloud-sync rejection handling (F-268-1).
 *
 * The portal pollers ran their async bodies in try/FINALLY without a catch,
 * and the Supabase client's fetch deadline REJECTS on stall/failure — so a
 * venue with a flaky network produced an unhandled promise rejection every
 * 5 seconds (poll), on every debounced save, and — after the #264 fix — from
 * the unmount flush as well. The pull paths now swallow quietly (the poll
 * retries on its own), the couple-portal save path emits the typed
 * `spm_cloud_sync_error` event (App-level toast, Review #245 P2-F channel),
 * and the public branding RPC resolves null on failure instead of rejecting
 * into its `void … .then(…)` callers. Review #276 F-276-4 further requires
 * pollers to distinguish authoritative access denials (which re-gate the
 * portal) from those transient failures (which remain quiet and retryable).
 */
describe('portal cloud-sync paths handle rejections (F-268-1)', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

  it('CouplesPortal pull catches network failures (poll retries quietly)', () => {
    const src = read('src/components/CouplesPortal.tsx');
    const hydrate = /const hydrateRemote = async \(\) => \{[\s\S]*?\n\s{4}\};/.exec(src)?.[0] ?? '';
    expect(hydrate).not.toBe('');
    expect(hydrate).toMatch(/catch \(err\) \{\s*if \(isPortalAccessError\(err\) && !cancelled\) \{[\s\S]*?setPortalAccountAccess\('pending'\);/);
    expect(hydrate).toMatch(/else if \(!cancelled\) \{\s*\/\/ F-268-1[\s\S]*?console\.debug\('Couple portal cloud pull failed; retrying on the next poll\.', err\);/);
  });

  it('CouplesPortal save catch emits the typed cloud-sync-error event', () => {
    const src = read('src/components/CouplesPortal.tsx');
    const push = /const pushLocalSnapshot = async \(\) => \{[\s\S]*?\n\s{4}\};/.exec(src)?.[0] ?? '';
    expect(push).not.toBe('');
    expect(push).toMatch(/catch \(err\) \{[\s\S]*?emit\('spm_cloud_sync_error', \{\s*domain: 'couple portal',/);
  });

  it('GuestPortal re-gates access denials but catches transient network failures', () => {
    const src = read('src/components/GuestPortal.tsx');
    const hydrate = /const hydrateGuest = async \(\) => \{[\s\S]*?\n\s{4}\};/.exec(src)?.[0] ?? '';
    expect(hydrate).not.toBe('');
    expect(hydrate).toMatch(/if \(isPortalAccessError\(err\) && !cancelled\) \{[\s\S]*?setPortalAccountAccess\('pending'\);/);
    expect(hydrate).toMatch(/else if \(!cancelled\) \{[\s\S]*?console\.debug\('Guest portal cloud pull failed; retrying on the next poll\.', err\);/);
  });

  it('public branding RPC resolves null on failure instead of rejecting', () => {
    const src = read('src/services/platform/publicVenueService.ts');
    const fn = /export async function getPublicVenueBranding[\s\S]*?\n\}/.exec(src)?.[0] ?? '';
    expect(fn).not.toBe('');
    expect(fn).toMatch(/try \{[\s\S]*?\} catch \{[\s\S]*?return null;\s*\}/);
  });
});
