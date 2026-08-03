import { beforeEach, describe, expect, it } from 'vitest';
import { saveVersionedStorage } from './storage';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { STORAGE_VERSIONS } from '../constants/storageVersions';
import { buildBackupBundle } from './backupExport';
import { applyBackupPayload } from './backupImport';
import { getStoredDirectMessages } from '../hooks/useDirectMessages';
import {
  getGuestPortalConfig,
  getPortalGuests,
  getPortalRSVPSubmissions,
} from './guestPortal';

/**
 * Regression test for the backup/restore data-loss bug: versioned keys
 * (DIRECT_MESSAGES, PORTAL_CONFIG, PORTAL_GUESTS, RSVP_SUBMISSIONS) were being
 * exported as storage envelopes, then double-wrapped on restore, which silently
 * wiped the data. This test uses the real storage + accessor implementations
 * (no mocks) to prove a full round-trip preserves the data.
 */
describe('backup/restore round-trip for versioned domains', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('preserves direct messages, portal config, portal guests, and RSVP submissions', async () => {
    const messages = [
      { id: 'm1', threadId: 't1', senderId: 'u1', senderName: 'Admin', message: 'hi', createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    const portalConfig = { eventTitle: 'Spring Wedding', showMap: true, showRSVP: true };
    const portalGuests = [{ id: 'g1', name: 'Guest One', eventKey: 'spring-wedding' }];
    const rsvp = [
      { id: 'r1', fullName: 'Guest One', attending: true, submittedAt: '2026-01-01T00:00:00.000Z' },
    ];

    saveVersionedStorage(
      STORAGE_KEYS.DIRECT_MESSAGES,
      STORAGE_VERSIONS.DIRECT_MESSAGES,
      messages,
    );
    saveVersionedStorage(
      STORAGE_KEYS.PORTAL_CONFIG,
      STORAGE_VERSIONS.PORTAL_CONFIG,
      portalConfig,
    );
    saveVersionedStorage(
      STORAGE_KEYS.PORTAL_GUESTS,
      STORAGE_VERSIONS.PORTAL_GUESTS,
      portalGuests,
    );
    saveVersionedStorage(
      STORAGE_KEYS.RSVP_SUBMISSIONS,
      STORAGE_VERSIONS.RSVP_SUBMISSIONS,
      rsvp,
    );

    const bundle = await buildBackupBundle();

    // Payload must contain the unwrapped data, not storage envelopes.
    expect(bundle.payload.directMessages).toEqual(messages);
    expect(bundle.payload.portalConfig).toEqual(portalConfig);
    expect(bundle.payload.portalGuests).toEqual(portalGuests);
    expect(bundle.payload.rsvpSubmissions).toEqual(rsvp);

    // Wipe everything, then restore.
    localStorage.clear();
    applyBackupPayload(bundle.payload, 'replace');

    // Data must survive the round-trip through the real accessors.
    expect(getStoredDirectMessages()).toEqual(messages);
    expect(getGuestPortalConfig()).toEqual(portalConfig);
    expect(getPortalGuests()).toEqual(portalGuests);
    expect(getPortalRSVPSubmissions()).toEqual(rsvp);
  });
});
