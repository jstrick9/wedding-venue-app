import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { buildBackupBundle, buildRedactedExportBundle } from './backupExport';
import { applyBackupPayload, preflightBackupImport } from './backupImport';
import {
  containsRedaction,
  countRedactedFields,
  REDACTION_MARKER,
  redactValue,
  redactValueByOmittingSecrets,
} from './backupSecrets';
import { getUsers } from '../hooks/useLayoutState';

/**
 * Backup export/import must never leak security material to a shareable file,
 * and must never let a redacted export clobber live secrets on restore.
 */
describe('backup secrets redaction', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('redacts known secret fields and leaves ordinary data intact', () => {
    const input = {
      users: [
        {
          id: 'u1',
          name: 'Venue Admin',
          password: 'plaintext-legacy',
          passwordHash: 'pbkdf2$salt$hash',
          passwordSalt: 'abc123',
        },
      ],
      venues: [{ id: 'v1', name: 'Seven Paths Manor', websiteUrl: 'https://example.com' }],
      coupleEvents: [
        { id: 'c1', coupleName: 'Sam & Alex', inviteToken: 'couple-secret-abc' },
      ],
    };

    const redacted = redactValue(input) as typeof input;

    expect(redacted.users![0].password).toBe(REDACTION_MARKER);
    expect(redacted.users![0].passwordHash).toBe(REDACTION_MARKER);
    expect(redacted.users![0].passwordSalt).toBe(REDACTION_MARKER);
    expect(redacted.users![0].name).toBe('Venue Admin');
    expect(redacted.venues![0].websiteUrl).toBe('https://example.com');
    expect(redacted.coupleEvents![0].inviteToken).toBe(REDACTION_MARKER);
    expect(redacted.coupleEvents![0].coupleName).toBe('Sam & Alex');
  });

  it('normalizes camelCase, snake_case, and hyphenated secret-key variants', () => {
    const input = {
      accessToken: 'camel-secret',
      access_token: { value: 'structured-snake-secret' },
      'refresh-token': 'hyphen-secret',
      githubToken: 'future-token-alias',
      client_secret: 'future-secret-alias',
      'maps-api-key': 'future-key-alias',
      signing_private_key: 'future-private-key-alias',
      nested: {
        portal_token_hash: 'portal-secret',
        coupleTokenHash: 'couple-secret',
        publicLabel: 'keep this',
      },
    };

    expect(redactValue(input)).toEqual({
      accessToken: REDACTION_MARKER,
      access_token: REDACTION_MARKER,
      'refresh-token': REDACTION_MARKER,
      githubToken: REDACTION_MARKER,
      client_secret: REDACTION_MARKER,
      'maps-api-key': REDACTION_MARKER,
      signing_private_key: REDACTION_MARKER,
      nested: {
        portal_token_hash: REDACTION_MARKER,
        coupleTokenHash: REDACTION_MARKER,
        publicLabel: 'keep this',
      },
    });
    expect(redactValueByOmittingSecrets(input)).toEqual({
      nested: { publicLabel: 'keep this' },
    });
  });

  it('buildBackupBundle keeps the full payload (internal rollback), but the export bundle is redacted', async () => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([
      { id: 'u1', name: 'Admin', password: 'pw', passwordHash: 'h', passwordSalt: 's' },
    ]));

    const internal = await buildBackupBundle();
    expect(internal.payload.users).toEqual([
      { id: 'u1', name: 'Admin', password: 'pw', passwordHash: 'h', passwordSalt: 's' },
    ]);

    const exported = await buildRedactedExportBundle();
    expect(exported.payload.users).toEqual([
      { id: 'u1', name: 'Admin', password: REDACTION_MARKER, passwordHash: REDACTION_MARKER, passwordSalt: REDACTION_MARKER },
    ]);
  });

  it('export bundle checksum matches its (redacted) payload', async () => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([
      { id: 'u1', name: 'Admin', password: 'pw', passwordHash: 'h', passwordSalt: 's' },
    ]));

    const exported = await buildRedactedExportBundle();
    const report = await preflightBackupImport(exported);
    // No checksum error because the checksum was recomputed over the redacted payload.
    expect(report.errors).not.toContainEqual(
      expect.stringContaining('checksum does not match'),
    );
  });

  it('import warns about redacted domains and does not clobber live secrets', async () => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([
      { id: 'u1', name: 'Existing Admin', password: 'keep-me', passwordHash: 'real-hash', passwordSalt: 'real-salt' },
    ]));

    const exported = await buildRedactedExportBundle();
    const report = await preflightBackupImport(exported);
    expect(report.valid).toBe(true);
    expect(report.warnings.some((w) => w.includes('redacted security material'))).toBe(true);

    // Restore the (redacted) export over the current state.
    applyBackupPayload(exported.payload, 'replace');

    // The live user secret must be preserved, not replaced with "[REDACTED]".
    const users = getUsers();
    expect(users).toHaveLength(1);
    expect(users[0].passwordHash).toBe('real-hash');
    expect(users[0].password).toBe('keep-me');
  });

  it('containsRedaction and countRedactedFields behave correctly', () => {
    expect(containsRedaction(REDACTION_MARKER)).toBe(true);
    expect(containsRedaction({ a: 1, b: REDACTION_MARKER })).toBe(true);
    expect(containsRedaction({ a: 1, b: 2 })).toBe(false);
    expect(containsRedaction([{ x: REDACTION_MARKER }, { y: 1 }])).toBe(true);
    expect(countRedactedFields({ a: REDACTION_MARKER, b: { c: REDACTION_MARKER }, d: 1 })).toBe(2);
    expect(countRedactedFields({ a: 1 })).toBe(0);
  });
});
