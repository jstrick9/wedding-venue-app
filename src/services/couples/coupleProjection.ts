import type { CoupleEvent, CoupleEventStatus, GuestPortalConfig, GuestPortalGuestRecord, RSVPSubmission } from '../../types';
import { getPlatformProvider } from '../platform';
import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';
import { getEntityRepository, type EntitySyncContext } from '../repository/entityRepository';
import { getCoupleEvents } from './coupleService';
import { getCoupleGuestsForBackup, getCouplePortalConfigsForBackup } from './coupleGuestService';
import { getCoupleRsvpSubmissionsForBackup } from './coupleRsvpService';

/**
 * Couple → org_data + relational `events`/`guests`/`rsvp_submissions` projection.
 *
 * Console metrics (`get_platform_console_metrics`) and the legacy guest RPC
 * (`get_guest_by_portal_token` / `submit_guest_rsvp`) both read the relational
 * tables / `org_data` domains. Until this projection runs, those surfaces read 0
 * even when the venue workspace is full of couple activity (P0-2 / N-4 / P1-9).
 *
 * Invitation tokens remain in local/org_data guest records because the couple
 * UI must copy and safely reissue invitation links. Account-required cloud RPCs
 * require both the token and its bound guest JWT; explicitly historical records
 * retain token compatibility. Relational `guests.portal_token_hash` stores only
 * the SHA-256 hash.
 */

export type ProjectedEventStatus = 'lead' | 'hold' | 'booked' | 'planning' | 'completed' | 'cancelled' | 'lost';

export interface ProjectedCoupleEvent {
  sourceCoupleId: string;
  title: string;
  slug: string;
  status: ProjectedEventStatus;
  startDate: string | null;
  endDate: string | null;
  guestCount: number;
  metadata: Record<string, unknown>;
}

export interface ProjectedCoupleGuest {
  sourceGuestId: string;
  sourceCoupleId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  rsvpStatus: 'pending' | 'confirmed' | 'declined';
  dietaryRestrictions: string | null;
  tableAssignment: string | null;
  roomAssignment: string | null;
  plusOneAllowed: boolean;
  portalToken: string | null;
  portalAccess: {
    enabled: boolean;
    expiresAt: string | null;
  };
  metadata: Record<string, unknown>;
}

export interface ProjectedCoupleRsvp {
  sourceSubmissionId: string;
  sourceGuestId: string;
  sourceCoupleId: string;
  attending: boolean;
  attendingDays: string[];
  mealChoice: string | null;
  plusOneName: string | null;
  plusOneMealChoice: string | null;
  dietaryNotes: string | null;
  specialNeeds: string | null;
  notes: string | null;
  submittedAt: string | null;
}

export interface CoupleProjectionPayload {
  events: ProjectedCoupleEvent[];
  guests: ProjectedCoupleGuest[];
  submissions: ProjectedCoupleRsvp[];
  portalConfigs: Record<string, GuestPortalConfig>;
}

/** How `org_data` payloads are stored: a raw array (entity repository) or a wrapped object. */
export function orgDataArrayLength(payload: unknown, domainKey?: string): number {
  if (Array.isArray(payload)) return payload.length;
  if (payload && typeof payload === 'object' && domainKey) {
    const inner = (payload as Record<string, unknown>)[domainKey];
    return Array.isArray(inner) ? inner.length : 0;
  }
  return 0;
}

export function mapCoupleStatusToEventStatus(status: CoupleEventStatus | string | undefined): ProjectedEventStatus {
  if (status === 'invited') return 'lead';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled' || status === 'lost') return status;
  return 'planning';
}

export function slugifyCoupleId(coupleId: string): string {
  const cleaned = coupleId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `ce-${cleaned || 'couple'}`.slice(0, 64);
}

function guestCoupleId(guest: GuestPortalGuestRecord): string {
  return String(guest.eventName || guest.eventKey || '');
}

function submissionCoupleId(submission: RSVPSubmission): string {
  return String(submission.eventKey || submission.eventName || '');
}

function rsvpStatusForGuest(
  guest: GuestPortalGuestRecord,
  submissions: RSVPSubmission[],
): 'pending' | 'confirmed' | 'declined' {
  const match = submissions.find(
    (s) => s.guestId === guest.id && submissionCoupleId(s) === guestCoupleId(guest),
  );
  if (match) return match.attending ? 'confirmed' : 'declined';
  if (guest.rsvpStatus === 'confirmed' || guest.rsvpStatus === 'declined') return guest.rsvpStatus;
  return 'pending';
}

export function buildCoupleProjectionPayload(
  events: CoupleEvent[] = getCoupleEvents(),
  guests: GuestPortalGuestRecord[] = getCoupleGuestsForBackup(),
  submissions: RSVPSubmission[] = getCoupleRsvpSubmissionsForBackup(),
  portalConfigs: Record<string, GuestPortalConfig> = getCouplePortalConfigsForBackup(),
): CoupleProjectionPayload {
  const projectedEvents: ProjectedCoupleEvent[] = events.map((event) => ({
    sourceCoupleId: event.id,
    title: event.coupleName,
    slug: slugifyCoupleId(event.id),
    status: mapCoupleStatusToEventStatus(event.status),
    startDate: event.eventDate || null,
    endDate: event.eventEndDate || event.eventDate || null,
    guestCount: Math.max(0, Number(event.guestCount || guests.filter((g) => guestCoupleId(g) === event.id).length || 0)),
    metadata: {
      source: 'couple',
      layoutStatus: event.layoutStatus,
      packageId: event.packageId,
      inviteExpiresAt: event.inviteExpiresAt,
      selectedSpaces: event.selectedSpaces,
    },
  }));

  const projectedGuests: ProjectedCoupleGuest[] = guests
    .filter((guest) => guestCoupleId(guest))
    .map((guest) => ({
      sourceGuestId: guest.id,
      sourceCoupleId: guestCoupleId(guest),
      fullName: guest.name,
      email: guest.email || null,
      phone: guest.phone || null,
      rsvpStatus: rsvpStatusForGuest(guest, submissions),
      dietaryRestrictions: guest.dietaryRestrictions || null,
      tableAssignment: guest.tableId || null,
      roomAssignment: guest.roomId || null,
      plusOneAllowed: Boolean(guest.plusOne),
      portalToken: guest.token && !guest.tokenRevokedAt ? guest.token : null,
      portalAccess: {
        enabled: guest.allowPortalAccess !== false && !guest.tokenRevokedAt,
        expiresAt: guest.tokenExpiresAt || null,
      },
      metadata: {
        source: 'couple',
        guestEventIds: guest.guestEventIds || [],
        tokenIssuedAt: guest.tokenIssuedAt,
      },
    }));

  const projectedSubmissions: ProjectedCoupleRsvp[] = submissions
    .filter((submission) => submission.guestId && submissionCoupleId(submission))
    .map((submission) => ({
      sourceSubmissionId: submission.id,
      sourceGuestId: submission.guestId,
      sourceCoupleId: submissionCoupleId(submission),
      attending: Boolean(submission.attending),
      attendingDays: Array.isArray(submission.attendingDays) ? submission.attendingDays : [],
      mealChoice: submission.mealChoice || null,
      plusOneName: submission.plusOneName || null,
      plusOneMealChoice: submission.plusOneMealChoice || null,
      dietaryNotes: submission.dietaryNotes || null,
      specialNeeds: submission.specialNeeds || null,
      notes: submission.notes || null,
      submittedAt: submission.submittedAt || null,
    }));

  return {
    events: projectedEvents,
    guests: projectedGuests,
    submissions: projectedSubmissions,
    portalConfigs,
  };
}

export function isCoupleProjectionEnabled(): boolean {
  return getPlatformProvider() === 'supabase' && isSupabaseConfigured();
}

/**
 * Persist couple domains into `org_data` and project them into the relational
 * `events` / `guests` / `rsvp_submissions` / `guest_portal_configs` tables.
 */
export async function syncCoupleRelationalProjection(context: EntitySyncContext): Promise<boolean> {
  if (!isCoupleProjectionEnabled()) return false;

  const repo = getEntityRepository();
  await repo.pushDomain(context, 'coupleEvents');
  await repo.pushDomain(context, 'coupleGuests');
  await repo.pushDomain(context, 'coupleSubmissions');
  await repo.pushDomain(context, 'couplePortalConfigs');

  const payload = buildCoupleProjectionPayload();
  const { data, error } = await getSupabaseClient().rpc('sync_couple_projection', {
    p_organization_id: context.organizationId,
    p_events: payload.events,
    p_guests: payload.guests,
    p_submissions: payload.submissions,
    p_portal_configs: payload.portalConfigs,
  });
  if (error) throw error;
  if (!data?.ok) {
    throw new Error(String(data?.error || 'Couple projection failed.'));
  }
  return true;
}
