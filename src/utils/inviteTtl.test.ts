import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NEW_INVITE_TTL_DAYS,
  DEFAULT_REISSUE_INVITE_TTL_DAYS,
  clampInviteTtlDays,
  formatInviteExpiry,
  inviteExpiresAt,
} from './inviteTtl';

describe('inviteTtl', () => {
  it('clamps invite lifetimes between 1 and 90 days', () => {
    expect(clampInviteTtlDays(undefined, DEFAULT_NEW_INVITE_TTL_DAYS)).toBe(14);
    expect(clampInviteTtlDays(0, DEFAULT_REISSUE_INVITE_TTL_DAYS)).toBe(1);
    expect(clampInviteTtlDays(400, 7)).toBe(90);
    expect(clampInviteTtlDays('12', 7)).toBe(12);
  });

  it('computes an ISO expiry from a day count', () => {
    expect(inviteExpiresAt(2, 7, Date.parse('2026-08-22T12:00:00.000Z'))).toBe('2026-08-24T12:00:00.000Z');
    expect(formatInviteExpiry('2026-08-24T12:00:00.000Z')).toContain('2026');
  });
});
