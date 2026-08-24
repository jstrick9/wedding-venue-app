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
    requirePlatformClient: () => Promise.resolve(supabase),
    isSupabaseConfigured: () => true,
    getCurrentAccessToken: () => Promise.resolve('tok'),
  };
});

import {
  createVenueOrganization,
  getPlatformConsoleMetrics,
  listPlatformAuditLogs,
  listPlatformOrganizations,
  lookupVenueAdminInvite,
  reissueVenueAdminInvite,
  updateVenueOrganization,
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
      primaryContactPhone: '704-555-0100',
      primaryContactEmail: 'owner@hilltop.com',
      latitude: 35.6,
      longitude: -82.55,
    });

    expect(result.organizationId).toBe('org9');
    expect(result.organizationSlug).toBe('hilltop-barn');
    expect(result.inviteUrl).toContain('/i/');
    expect(result.inviteUrl).not.toContain('?va=');
    expect(result.inviteUrl).not.toContain('#/venue-onboarding');
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
      primaryContactPhone: '704-555-0100',
      primaryContactEmail: 'owner@hilltop.com',
      latitude: 1,
      longitude: 2,
    })).rejects.toThrow();
  });

  it('updates a venue through update_venue_organization and sanitizes the website', async () => {
    rpcResults['update_venue_organization'] = {
      data: { ok: true, organization_id: 'org1', organization_name: 'Seven Paths Manor', organization_slug: 'seven-paths', status: 'active' },
      error: null,
    };

    const result = await updateVenueOrganization({
      organizationId: 'org1',
      name: 'Seven Paths Manor',
      status: 'active',
      addressLine1: '100 Manor Rd',
      city: 'Charlotte',
      stateRegion: 'NC',
      postalCode: '28202',
      country: 'US',
      primaryContactName: 'Ada',
      primaryContactPhone: '704-555-0100',
      primaryContactEmail: 'ada@sevenpaths.com',
      websiteUrl: 'sevenpathsmanor.com',
      latitude: 35.2,
      longitude: -80.8,
    });

    expect(result.organizationSlug).toBe('seven-paths');
    expect(result.status).toBe('active');
    expect(rpcCalls[0].fn).toBe('update_venue_organization');
    expect(rpcCalls[0].args.p_organization_id).toBe('org1');
    expect(rpcCalls[0].args.p_website_url).toMatch(/^https:\/\/sevenpathsmanor\.com\/?$/);
    expect(rpcCalls[0].args).not.toHaveProperty('p_slug');
  });

  it('rejects a javascript: website before calling the update RPC', async () => {
    await expect(updateVenueOrganization({
      organizationId: 'org1',
      name: 'Seven Paths Manor',
      status: 'active',
      addressLine1: '100 Manor Rd',
      city: 'Charlotte',
      stateRegion: 'NC',
      postalCode: '28202',
      country: 'US',
      primaryContactName: 'Ada',
      primaryContactPhone: '704-555-0100',
      primaryContactEmail: 'ada@sevenpaths.com',
      websiteUrl: 'javascript:alert(1)',
    })).rejects.toThrow(/website/i);
    expect(rpcCalls).toHaveLength(0);
  });

  it('rejects an invalid US phone before calling the update RPC', async () => {
    await expect(updateVenueOrganization({
      organizationId: 'org1',
      name: 'Seven Paths Manor',
      status: 'active',
      addressLine1: '100 Manor Rd',
      city: 'Charlotte',
      stateRegion: 'NC',
      postalCode: '28202',
      country: 'US',
      primaryContactName: 'Ada',
      primaryContactPhone: '555-0100',
      primaryContactEmail: 'ada@sevenpaths.com',
    })).rejects.toThrow(/10-digit us phone/i);
  });

  it('propagates an RPC-level failure from venue update', async () => {
    rpcResults['update_venue_organization'] = { data: { ok: false, error: 'forbidden' }, error: null };
    await expect(updateVenueOrganization({
      organizationId: 'org1',
      name: 'Seven Paths Manor',
      status: 'active',
      addressLine1: '100 Manor Rd',
      city: 'Charlotte',
      stateRegion: 'NC',
      postalCode: '28202',
      country: 'US',
      primaryContactName: 'Ada',
      primaryContactPhone: '704-555-0100',
      primaryContactEmail: 'ada@sevenpaths.com',
    })).rejects.toThrow(/platform administrator login/i);
  });

  it('maps platform audit log rows into camelCase entries', async () => {
    tableResults['platform_audit_logs'] = {
      data: [{
        id: 'log-1',
        platform_user_id: 'u1',
        organization_id: 'org1',
        action: 'venue_updated',
        target_type: 'organization',
        target_id: 'org1',
        reason: null,
        metadata: { status: 'active' },
        created_at: '2026-08-19T12:00:00.000Z',
      }],
      error: null,
    };

    const logs = await listPlatformAuditLogs(20);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      id: 'log-1',
      platformUserId: 'u1',
      organizationId: 'org1',
      action: 'venue_updated',
      targetType: 'organization',
    });
  });

  it('looks up a venue-admin invite and reports specific RPC errors', async () => {
    rpcResults['get_venue_admin_invite_context'] = {
      data: {
        ok: true,
        organization_id: 'org9',
        organization_name: 'Hilltop Barn',
        organization_slug: 'hilltop-barn',
        email: 'owner@hilltop.com',
        role: 'owner',
        expires_at: '2026-09-01T00:00:00.000Z',
      },
      error: null,
    };
    const found = await lookupVenueAdminInvite('va-abc');
    expect(found.context?.organizationSlug).toBe('hilltop-barn');
    expect(found.context?.email).toBe('owner@hilltop.com');

    rpcResults['get_venue_admin_invite_context'] = { data: { ok: false, error: 'expired' }, error: null };
    const expired = await lookupVenueAdminInvite('va-old');
    expect(expired.context).toBeNull();
    expect(expired.error).toBe('expired');
  });

  it('reissues a venue-admin invite with a new token URL and expiry', async () => {
    rpcResults['reissue_venue_admin_invite'] = {
      data: { ok: true, expires_at: '2026-08-29T00:00:00.000Z' },
      error: null,
    };
    const next = await reissueVenueAdminInvite('org9', 'owner@hilltop.com', '2026-08-29T00:00:00.000Z');
    expect(next.inviteUrl).toContain('/i/');
    expect(next.inviteUrl).not.toContain('#/');
    expect(next.expiresAt).toBe('2026-08-29T00:00:00.000Z');
    expect(rpcCalls[0].fn).toBe('reissue_venue_admin_invite');
    expect(rpcCalls[0].args.p_organization_id).toBe('org9');
    expect(rpcCalls[0].args.p_expires_at).toBe('2026-08-29T00:00:00.000Z');
  });
});
