import { beforeEach, describe, expect, it } from 'vitest';
import { createCoupleEvent, getCoupleEvents } from './coupleService';
import { addCoupleGuest, getCoupleGuests } from './coupleGuestService';
import {
  getVenueMapConfig,
  saveVenueMapConfig,
} from '../wayfinding/venueWayfindingService';
import {
  buildCouplePortalSnapshot,
  affectsCouplePortalSnapshots,
  hydrateCouplePortalSnapshot,
  isCoupleCloudEnabled,
} from './coupleCloudSync';

describe('couple cloud snapshot seam', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('builds a snapshot scoped to one couple event', async () => {
    const first = createCoupleEvent({ coupleName: 'First Couple', eventDate: '2027-05-01' });
    const second = createCoupleEvent({ coupleName: 'Second Couple', eventDate: '2027-06-01' });
    addCoupleGuest(first.id, { name: 'First Guest' });
    addCoupleGuest(second.id, { name: 'Second Guest' });

    const snapshot = await buildCouplePortalSnapshot(first.id);
    expect(snapshot).toBeTruthy();
    expect((snapshot?.coupleEvents as Array<{ id: string }>)).toHaveLength(1);
    expect((snapshot?.coupleEvents as Array<{ id: string }>)[0].id).toBe(first.id);
    expect((snapshot?.coupleGuests as Array<{ eventName: string }>)).toHaveLength(1);
    expect((snapshot?.coupleGuests as Array<{ eventName: string }>)[0].eventName).toBe(first.id);
    expect(getCoupleEvents()).toHaveLength(2);
    expect(getCoupleGuests(second.id)).toHaveLength(1);
  });

  it('hydrates a remote couple snapshot without deleting another local couple', async () => {
    const first = createCoupleEvent({ coupleName: 'First Couple', eventDate: '2027-05-01' });
    const second = createCoupleEvent({ coupleName: 'Second Couple', eventDate: '2027-06-01' });
    addCoupleGuest(first.id, { name: 'Remote Guest' });
    const snapshot = await buildCouplePortalSnapshot(first.id);
    expect(snapshot).toBeTruthy();

    hydrateCouplePortalSnapshot(snapshot!);
    expect(getCoupleEvents()).toHaveLength(2);
    expect(getCoupleGuests(first.id)[0].name).toBe('Remote Guest');
    expect(getCoupleGuests(second.id)).toHaveLength(0);
  });

  it('preserves canonical venue globals during venue-member snapshot hydration', () => {
    saveVenueMapConfig({
      width: 100,
      height: 80,
      points: [
        { id: 'staff-yard', label: 'Service Yard', kind: 'amenity', x: 10, y: 10, audience: 'staff' },
      ],
      routes: [],
      drawings: [],
      rainContingencies: [],
      updatedAt: '2026-09-05T12:00:00.000Z',
    });

    hydrateCouplePortalSnapshot({
      venueMapConfigs: {
        width: 100,
        height: 80,
        points: [{ id: 'guest-gate', label: 'Guest Gate', kind: 'entry', x: 5, y: 5 }],
        routes: [],
        drawings: [],
        rainContingencies: [],
        updatedAt: '2026-09-04T12:00:00.000Z',
      },
    }, {
      notify: false,
      includeGlobalDomains: false,
    });

    expect(getVenueMapConfig()?.points.map((point) => point.id)).toEqual(['staff-yard']);
  });

  it('recognizes map domains as portal-snapshot invalidations', () => {
    expect(affectsCouplePortalSnapshots('venueMapConfigs')).toBe(true);
    expect(affectsCouplePortalSnapshots('spm_venue_map_configs')).toBe(true);
    expect(affectsCouplePortalSnapshots('venueRules')).toBe(true);
    expect(affectsCouplePortalSnapshots('staffTasks')).toBe(false);
  });

  it('stays a no-op until Supabase configuration is enabled', () => {
    expect(isCoupleCloudEnabled()).toBe(false);
  });
});
