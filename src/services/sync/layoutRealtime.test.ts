import { beforeEach, describe, expect, it, vi } from 'vitest';

// Force platform to supabase.
vi.mock('../platform', () => ({
  getPlatformProvider: () => 'supabase',
}));

// Provide a fake supabase client with a channel builder.
const removeChannel = vi.fn();
const channelOn = vi.fn();
const channelSubscribe = vi.fn();
const channel = {
  on: channelOn.mockReturnThis(),
  subscribe: channelSubscribe.mockReturnThis(),
};

vi.mock('../backend/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({
    channel: () => channel,
    removeChannel,
  }),
}));

// Mock pullLayouts to record calls.
const pullMock = vi.fn();
vi.mock('./layoutSync', () => ({
  pullLayouts: (ctx: unknown) => pullMock(ctx),
}));

import { subscribeToLayoutChanges } from './layoutRealtime';

const ctx = { organizationId: 'org1', userId: 'u1' };

describe('subscribeToLayoutChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes to org-scoped layouts table changes', () => {
    const unsub = subscribeToLayoutChanges(ctx);
    expect(channelOn).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'layouts',
        filter: `organization_id=eq.${ctx.organizationId}`,
      },
      expect.any(Function),
    );
    expect(channelSubscribe).toHaveBeenCalled();
    expect(unsub).toEqual(expect.any(Function));
  });

  it('unsubscribe removes the channel', () => {
    const unsub = subscribeToLayoutChanges(ctx);
    unsub();
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});
