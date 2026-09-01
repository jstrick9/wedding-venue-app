import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../platform', () => ({
  getPlatformProvider: vi.fn(() => 'supabase'),
}));
vi.mock('../backend/supabaseClient', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  getSupabaseClient: vi.fn(),
}));

import { getSupabaseClient } from '../backend/supabaseClient';
import { pullCouplePortalSnapshot, saveCouplePortalSnapshot } from './coupleCloudSync';

/**
 * Review #258 (F-258-2): the couple-side snapshot save is compare-and-swap.
 * The pull reports the row version (updated_at); the save forwards it as
 * p_base_updated_at and surfaces the server's 'conflict' refusal so the UI
 * can re-pull and merge instead of silently dropping a concurrent guest
 * submission.
 */
describe('couple snapshot compare-and-swap seam (Review #258)', () => {
  const rpc = vi.fn();
  const payload = { coupleEvents: [{ id: 'e1' }], coupleSubmissions: [] };

  beforeEach(() => {
    rpc.mockReset();
    vi.mocked(getSupabaseClient).mockReturnValue({ rpc } as never);
  });

  it('pull returns the payload together with the row version', async () => {
    rpc.mockResolvedValue({ data: { ok: true, payload, updated_at: '2026-08-31T00:00:00Z' }, error: null });
    const pulled = await pullCouplePortalSnapshot('token-0123456789abcdef');
    expect(pulled?.updatedAt).toBe('2026-08-31T00:00:00Z');
    expect(pulled?.payload).toEqual(payload);
    expect(rpc).toHaveBeenCalledWith('get_couple_portal_snapshot', { p_token: 'token-0123456789abcdef' });
  });

  it('save forwards the base version and maps the conflict refusal', async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: 'conflict', updated_at: '2026-08-31T01:00:00Z' }, error: null });
    const result = await saveCouplePortalSnapshot('token-0123456789abcdef', payload, undefined, '2026-08-31T00:00:00Z');
    expect(result).toBe('conflict');
    expect(rpc).toHaveBeenCalledWith('save_couple_portal_snapshot', {
      p_token: 'token-0123456789abcdef',
      p_payload: payload,
      p_base_updated_at: '2026-08-31T00:00:00Z',
    });
  });

  it('save omits the base version when the caller has none (legacy behavior)', async () => {
    rpc.mockResolvedValue({ data: { ok: true, couple_id: 'e1' }, error: null });
    const result = await saveCouplePortalSnapshot('token-0123456789abcdef', payload);
    expect(result).toBe('saved');
    expect(rpc).toHaveBeenCalledWith('save_couple_portal_snapshot', {
      p_token: 'token-0123456789abcdef',
      p_payload: payload,
    });
  });

  it('save reports errors instead of pretending success', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('network') });
    const result = await saveCouplePortalSnapshot('token-0123456789abcdef', payload);
    expect(result).toBe('error');
  });

  it('the venue-slug variant routes to the _for_venue RPC with the base version', async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });
    await saveCouplePortalSnapshot('token-0123456789abcdef', payload, 'seven-paths', '2026-08-31T00:00:00Z');
    expect(rpc).toHaveBeenCalledWith('save_couple_portal_snapshot_for_venue', {
      p_venue_slug: 'seven-paths',
      p_token: 'token-0123456789abcdef',
      p_payload: payload,
      p_base_updated_at: '2026-08-31T00:00:00Z',
    });
  });
});
