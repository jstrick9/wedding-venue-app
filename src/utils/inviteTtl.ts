export const DEFAULT_NEW_INVITE_TTL_DAYS = 14;
export const DEFAULT_REISSUE_INVITE_TTL_DAYS = 7;
export const MIN_INVITE_TTL_DAYS = 1;
export const MAX_INVITE_TTL_DAYS = 90;

export function clampInviteTtlDays(value: unknown, fallback: number): number {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_INVITE_TTL_DAYS, Math.max(MIN_INVITE_TTL_DAYS, parsed));
}

export function inviteExpiresAt(days: unknown, fallback = DEFAULT_NEW_INVITE_TTL_DAYS, now = Date.now()): string {
  const ttl = clampInviteTtlDays(days, fallback);
  return new Date(now + ttl * 24 * 60 * 60 * 1000).toISOString();
}

export function formatInviteExpiry(iso?: string | null): string {
  if (!iso) return 'the configured expiry';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}
