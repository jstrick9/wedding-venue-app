import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { STORAGE_VERSIONS } from '../constants/storageVersions';
import { saveVersionedStorage } from './storage';
import { applyBackupPayload } from './backupImport';
import { buildBackupBundle } from './backupExport';

describe('backup registry completeness for local multi-couple mode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exports and restores couple RSVPs and venue admin settings', async () => {
    const coupleRsvp = [{
      id: 'rsvp-1',
      guestId: 'guest-1',
      eventKey: 'couple-1',
      eventName: 'couple-1',
      fullName: 'Guest One',
      email: 'guest@example.com',
      attending: true,
      submittedAt: new Date().toISOString(),
    }];
    const communication = [{ id: 'ct-1', label: 'Welcome', text: 'Hello', category: 'chat' }];
    const operations = { checklist: [{ id: 'oc-1' }], zones: [{ id: 'oz-1' }] };
    const security = { sessionTimeoutDays: 14 };
    const invites = [{ token: 'invite-1', status: 'pending' }];

    saveVersionedStorage(STORAGE_KEYS.COUPLE_SUBMISSIONS, STORAGE_VERSIONS.COUPLE_SUBMISSIONS, coupleRsvp);
    localStorage.setItem(STORAGE_KEYS.COMMUNICATION_TEMPLATES, JSON.stringify(communication));
    localStorage.setItem(STORAGE_KEYS.OPERATIONS_SETTINGS, JSON.stringify(operations));
    localStorage.setItem(STORAGE_KEYS.SECURITY_SETTINGS, JSON.stringify(security));
    localStorage.setItem(STORAGE_KEYS.ORG_INVITES, JSON.stringify(invites));

    const bundle = await buildBackupBundle();
    expect(bundle.payload.coupleSubmissions).toEqual(coupleRsvp);
    expect(bundle.payload.communicationTemplates).toEqual(communication);
    expect(bundle.payload.operationsSettings).toEqual(operations);
    expect(bundle.payload.securitySettings).toEqual(security);
    expect(bundle.payload.orgInvites).toEqual(invites);

    localStorage.clear();
    applyBackupPayload(bundle.payload, 'replace');

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.COUPLE_SUBMISSIONS) || '{}').data).toEqual(coupleRsvp);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.COMMUNICATION_TEMPLATES) || 'null')).toEqual(communication);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.OPERATIONS_SETTINGS) || 'null')).toEqual(operations);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.SECURITY_SETTINGS) || 'null')).toEqual(security);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.ORG_INVITES) || 'null')).toEqual(invites);
  });
});
