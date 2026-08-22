import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();
const invokeMock = vi.fn();

vi.mock('../backend/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
  }),
}));

import { exchangeOutlookAuthCode, getOutlookConnectionStatus } from './outlookMailService';

describe('outlookMailService', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    invokeMock.mockReset();
  });

  it('maps outlook status from the RPC', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true, connected: true, email: 'wedding-vip@outlook.com', clientId: 'abc' }, error: null });
    await expect(getOutlookConnectionStatus()).resolves.toEqual({
      connected: true,
      email: 'wedding-vip@outlook.com',
      clientId: 'abc',
    });
  });

  it('explains a missing migration', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Could not find the function public.get_platform_outlook_status' } });
    await expect(getOutlookConnectionStatus()).rejects.toThrow(/0015/);
  });

  it('exchanges an auth code through send-email', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true, email: 'wedding-vip@outlook.com' }, error: null });
    await expect(exchangeOutlookAuthCode({
      clientId: 'abc',
      code: 'code',
      verifier: 'ver',
      redirectUri: 'https://weddingvip.vercel.app/',
    })).resolves.toEqual({ email: 'wedding-vip@outlook.com' });
    expect(invokeMock).toHaveBeenCalledWith('send-email', expect.objectContaining({
      body: expect.objectContaining({ action: 'outlook_exchange' }),
    }));
  });
});
