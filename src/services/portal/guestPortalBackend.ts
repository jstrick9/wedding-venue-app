import { getPlatformProvider } from '../platform';
import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';
import {
  findGuestInEvent,
  getPortalGuestsForEvent,
  setPortalRSVPSubmissions,
} from '../../utils/guestPortal';
import type { GuestPortalGuestRecord, RSVPSubmission } from '../../types';

/**
 * Guest-portal persistence/identity abstraction.
 *
 * The portal is public-facing (wedding guests are not authenticated users), so
 * the backend layer is a separate concern from the main app:
 *  - `local`    → identity + RSVP stored in localStorage (current behavior).
 *  - `supabase` → identity is verified server-side via the
 *    `get_guest_by_portal_token` RPC (security-definer, token hashed at rest),
 *    and RSVPs are submitted via the `submit_guest_rsvp` RPC. This moves the
 *    security boundary from the browser to the server, as RLS policies never
 *    grant anonymous guests broad table access.
 */

export interface GuestPortalContext {
  eventName: string;
}

export interface GuestPortalBackend {
  provider: 'local' | 'supabase';
  findGuest(context: GuestPortalContext, identifier: string): Promise<GuestPortalGuestRecord | undefined>;
  submitRSVP(context: GuestPortalContext, submission: RSVPSubmission): Promise<boolean>;
}

/** Local provider — delegates to the existing localStorage utilities. */
export class LocalGuestPortalBackend implements GuestPortalBackend {
  provider = 'local' as const;

  async findGuest(context: GuestPortalContext, identifier: string): Promise<GuestPortalGuestRecord | undefined> {
    return findGuestInEvent(context.eventName, identifier);
  }

  async submitRSVP(_context: GuestPortalContext, submission: RSVPSubmission): Promise<boolean> {
    const { getPortalRSVPSubmissions } = await import('../../utils/guestPortal');
    const currentSubs = getPortalRSVPSubmissions();
    const next = currentSubs.some((s) => s.guestId === submission.guestId)
      ? currentSubs.map((s) => (s.guestId === submission.guestId ? submission : s))
      : [submission, ...currentSubs];
    setPortalRSVPSubmissions(next);
    return true;
  }
}

/** Supabase provider — server-verified identity + server-submitted RSVP. */
export class SupabaseGuestPortalBackend implements GuestPortalBackend {
  provider = 'supabase' as const;

  async findGuest(context: GuestPortalContext, identifier: string): Promise<GuestPortalGuestRecord | undefined> {
    if (!isSupabaseConfigured()) return undefined;
    const supabase = getSupabaseClient();
    // The token is the primary server-side identifier. For email/name lookup we
    // still fall back to local records if the org has published them (the
    // server RPC only resolves tokens).
    const token = identifier.trim();
    if (token.length >= 8) {
      const { data, error } = await supabase.rpc('get_guest_by_portal_token', { p_token: token });
      if (error) return undefined;
      if (data?.ok && data.guest) {
        const g = data.guest;
        return {
          id: g.id,
          name: g.full_name,
          email: g.email,
          token, // carry the token so RSVP submission uses the server RPC
          eventKey: normalizeEventKey(context.eventName),
          allowPortalAccess: true,
          tableId: g.table_assignment || undefined,
          roomId: g.room_assignment || undefined,
        } as GuestPortalGuestRecord;
      }
    }
    // Fall back to locally-published guest records (email/name).
    return getPortalGuestsForEvent(context.eventName).find((guest) => {
      const n = identifier.trim().toLowerCase();
      return (
        guest.email?.trim().toLowerCase() === n ||
        guest.name.trim().toLowerCase() === n
      );
    });
  }

  async submitRSVP(context: GuestPortalContext, submission: RSVPSubmission): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    const supabase = getSupabaseClient();
    const token = submission.token || findToken(submission);
    if (!token) {
      // No token available — fall back to local persistence so the user isn't
      // blocked, but the authoritative copy is local in this case.
      return new LocalGuestPortalBackend().submitRSVP(context, submission);
    }
    const { data, error } = await supabase.rpc('submit_guest_rsvp', {
      p_token: token,
      p_full_name: submission.fullName,
      p_email: submission.email,
      p_attending: submission.attending,
      p_attending_days: submission.attendingDays || [],
      p_meal_choice: submission.mealChoice ?? null,
      p_plus_one_name: submission.plusOneName ?? null,
      p_plus_one_meal_choice: submission.plusOneMealChoice ?? null,
      p_dietary_notes: submission.dietaryNotes ?? null,
      p_special_needs: submission.specialNeeds ?? null,
      p_notes: submission.notes ?? null,
    });
    if (error || !data?.ok) return false;
    return true;
  }
}

function normalizeEventKey(eventName: string): string {
  return eventName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function findToken(submission: RSVPSubmission): string | undefined {
  return (submission as unknown as { token?: string }).token;
}

export function getGuestPortalBackend(): GuestPortalBackend {
  return getPlatformProvider() === 'supabase'
    ? new SupabaseGuestPortalBackend()
    : new LocalGuestPortalBackend();
}
