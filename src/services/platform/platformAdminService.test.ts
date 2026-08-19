import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * N-1/N-7: the #176–#179 platform console shipped with zero automated test
 * coverage. These tests cover the service layer (organization listing, console
 * metrics, venue creation) against a mocked Supabase client so the logic —
 * field mapping, error propagation, and the security-definer RPC contract — is
 * exercised without a live project.
 */

const rpcResults: Record<string, any> = {};
const tableResults: Record<string, any> = {};
let rpcCalls: { fn: string; args: any }[] = [];

function buildChain(table: string) {
  const c: any = {};
  const methods = ['from', 'select', 'eq', 'in', 'order', 'limit', 'maybeSingle', 'single', 'insert', 'upsert', 'update', 'delete', 'rpc'];
  for (const m of methods) c[m] = () => c;
  // Awaiting the chain (PostgrestBuilder is a thenable) resolves to the table result.
  c.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(tableResults[table] ?? { data: [], error: null }).then(onFulfilled, onRejected);
  c.catch = (onRejected: any) =>
    Promise.resolve(tableResults[table] ?? { data: [], error: null }).catch(onRejected);
  return c;
}

vi.mock('../backend/supabaseClient', () => {
  const supabase = {
    rpc: (fn: string, args?: any) => {
      rpcCalls.push({ fn, args: args || {} });
      return Promise.resolve(rpcResults[fn] ?? { data: { ok: false, error: 'unconfigured' }, error: null });
    },
    from: (table: string) => buildChain(table),
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null }) },
  };
  return {
    getSupabaseClient: () => supabase,
    isSupabaseConfigured: () => true,
    getCurrentAccessToken: () => Promise.resolve('tok'),
  };
});

import {
  createVenueOrganization,
  getPlatformConsoleMetrics,
  listPlatformOrganizations,
} from './platformAdminService';

describe('platformAdminService', () => {
  beforeEach(() => {
    Object.keys(rpcResults).forEach((k) => delete rpcResults[k]);
    Object.keys(tableResults).forEach((k) => delete tableResults[k]);
    rpcCalls = [];
  });

  it('maps organizations, memberships, profiles and invites into a summary list', async () => {
    tableResults['organizations'] = {
      data: [
        { id: 'org1', name: 'Seven Paths Manor', slug: 'seven-paths', status: 'active', owner_id: 'u1', created_at: '2026-01-01' },
      ],
      error: null,
    };
    tableResults['organization_memberships'] = {
      data: [{ organization_id: 'org1', user_id: 'u1', role: 'owner', status: 'active' }],
      error: null,
    };
    tableResults['profiles'] = { data: [{ id: 'u1', email: 'admin@sevenpaths.com', full_name: 'Ada' }], error: null };
    tableResults['venue_admin_invites'] = {
      data: [{ id: 'inv1', organization_id: 'org1', email: 'x@y.com', expires_at: '2026-02-01', status: 'pending' }],
      error: null,
    };

    const list = await listPlatformOrganizations();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Seven Paths Manor');
    expect(list[0].status).toBe('active');
    expect(list[0].admins).toEqual([{ userId: 'u1', email: 'admin@sevenpaths.com', fullName: 'Ada', role: 'owner', status: 'active' }]);
    expect(list[0].pendingInvite?.email).toBe('x@y.com');
  });

  it('throws when a metrics RPC errors', async () => {
    rpcResults['get_platform_console_metrics'] = { data: null, error: { message: 'forbidden' } };
    await expect(getPlatformConsoleMetrics()).rejects.toThrow();
  });

  it('maps console metrics including venue-level aggregates', async () => {
    rpcResults['get_platform_console_metrics'] = {
      data: {
        ok: true,
        global: { total_venues: 2, active_venues: 1, suspended_venues: 1, provisioning_venues: 0, pending_invites: 1, active_admins: 3, total_couples: 5, total_guests: 120, total_rsvps: 40 },
        venues: [
          { id: 'org1', name: 'A', slug: 'a', status: 'active', created_at: '2026-01-01', admin_count: 2, couple_count: 3, guest_count: 60, rsvp_count: 20, pending_invite_count: 1 },
        ],
      },
      error: null,
    };
    const metrics = await getPlatformConsoleMetrics();
    expect(metrics.totalVenues).toBe(2);
    expect(metrics.activeVenues).toBe(1);
    expect(metrics.venues[0].guestCount).toBe(60);
  });

  it('creates a venue via create_venue_organization_v2 and returns an invite URL', async () => {
    rpcResults['create_venue_organization_v2'] = {
      data: { ok: true, organization_id: 'org9', organization_name: 'Hilltop Barn', organization_slug: 'hilltop-barn', expires_at: '2026-03-01' },
      error: null,
    };
    const result = await createVenueOrganization({
      name: 'Hilltop Barn',
      adminEmail: 'owner@hilltop.com',
      addressLine1: '1 Ridge Rd',
      city: 'Asheville',
      stateRegion: 'NC',
      postalCode: '28801',
      country: 'US',
      primaryContactName: 'Owner',
      primaryContactPhone: '555-0100',
      primaryContactEmail: 'owner@hilltop.com',
      latitude: 35.6,
      longitude: -82.55,
    });

    expect(result.organizationId).toBe('org9');
    expect(result.organizationSlug).toBe('hilltop-barn');
    expect(result.inviteUrl).toContain('#/venue-onboarding?token=');
    expect(rpcCalls[0].fn).toBe('create_venue_organization_v2');
    expect(rpcCalls[0].args.p_city).toBe('Asheville');
  });

  it('propagates an RPC-level failure from venue creation', async () => {
    rpcResults['create_venue_organization_v2'] = { data: null, error: { message: 'db error' } };
    await expect(createVenueOrganization({
      name: 'Hilltop Barn',
      adminEmail: 'owner@hilltop.com',
      addressLine1: '1 Ridge Rd',
      city: 'Asheville',
      stateRegion: 'NC',
      postalCode: '28801',
      country: 'US',
      primaryContactName: 'Owner',
      primaryContactPhone: '555-0100',
      primaryContactEmail: 'owner@hilltop.com',
      latitude: 1,
      longitude: 2,
    })).rejects.toThrow();
  });
});
