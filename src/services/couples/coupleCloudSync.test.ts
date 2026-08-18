import { beforeEach, describe, expect, it } from 'vitest';
import { createCoupleEvent, getCoupleEvents } from './coupleService';
import { addCoupleGuest, getCoupleGuests } from './coupleGuestService';
import {
  buildCouplePortalSnapshot,
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

  it('stays a no-op until Supabase configuration is enabled', () => {
    expect(isCoupleCloudEnabled()).toBe(false);
  });
});
