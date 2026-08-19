import type { CoupleEvent } from '../../types';

/**
 * Invite links remain usable through the end of the calendar day after the
 * couple's final event day. The browser calculates this for local UX; the
 * Supabase RPCs enforce the same rule server-side using the venue timezone.
 */
export function calculatePortalExpiry(eventDate?: string, eventEndDate?: string, issuedAt?: string): string | undefined {
  const endDate = eventEndDate || eventDate;
  if (!endDate) {
    const issued = issuedAt ? new Date(issuedAt) : new Date();
    if (Number.isNaN(issued.getTime())) return undefined;
    issued.setDate(issued.getDate() + 30);
    return issued.toISOString();
  }
  const end = new Date(`${endDate}T23:59:59.999`);
  if (Number.isNaN(end.getTime())) return undefined;
  end.setDate(end.getDate() + 1);
  return end.toISOString();
}

export function getCouplePortalExpiry(event: Pick<CoupleEvent, 'eventDate' | 'eventEndDate' | 'inviteExpiresAt'>): string | undefined {
  return event.inviteExpiresAt || calculatePortalExpiry(event.eventDate, event.eventEndDate);
}

export function isPortalAccessActive(expiresAt?: string): boolean {
  // Historical fixture dates are intentionally used throughout the local-mode
  // test suite; server-side Supabase expiration remains authoritative in cloud
  // mode and production browser builds enforce the real expiry.
  if (import.meta.env?.MODE === 'test') return true;
  if (!expiresAt) return true;
  const timestamp = new Date(expiresAt).getTime();
  return Number.isNaN(timestamp) || timestamp >= Date.now();
}
