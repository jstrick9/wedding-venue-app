import type { CoupleEvent, GuestPortalConfig, RSVPSubmission } from '../../types';
import { getPlatformProvider } from '../platform';
import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';
import { BACKUP_DOMAINS } from '../../utils/backupDomains';
import { emitDataChanged } from '../../utils/appEvents';
import { sha256Hex } from '../../utils/hash';
import { findCoupleEventById, getCoupleEvents } from './coupleService';
import { getCouplePortalExpiry } from './accessLifecycle';
import { getCoupleGuests } from './coupleGuestService';

export interface CoupleCloudContext {
  organizationId: string;
  userId: string;
}

export type CouplePortalSnapshot = Record<string, unknown>;

const COUPLE_SCOPED_ARRAYS = new Set([
  'coupleAnswers',
  'coupleMessages',
  'coupleGuests',
  'coupleSubmissions',
  'coupleChecklists',
  'coupleVendors',
  'coupleSetupTasks',
  'coupleGuestEvents',
]);

const GLOBAL_DOMAINS = new Set([
  'config',
  'venues',
  'tableSpecs',
  'fixtureTypes',
  'guidelines',
  'templates',
  'linenColors',
  'chairSpecs',
  'wallStyles',
  'spacingSettings',
  'alignmentSettings',
  'indoorFeatureTemplates',
  'outdoorFeatureTemplates',
  'decorItems',
  'decorCategories',
  'decorArrangements',
  'decorPackages',
  'eventQuestions',
  'vendorCategories',
  'vendors',
  'weddingPackages',
  'packageAddOns',
  'venueMapConfigs',
  'venueRules',
  'venueWeather',
]);

export function isCoupleCloudEnabled(): boolean {
  return getPlatformProvider() === 'supabase' && isSupabaseConfigured();
}

function scopeDomain(key: string, value: unknown, coupleEventId: string): unknown {
  if (key === 'coupleEvents') {
    return Array.isArray(value) ? value.filter((event) => event?.id === coupleEventId) : [];
  }

  if (key === 'couplePortalConfigs') {
    const configs = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return configs[coupleEventId] ? { [coupleEventId]: configs[coupleEventId] } : {};
  }

  if (COUPLE_SCOPED_ARRAYS.has(key)) {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => {
      if (key === 'coupleGuests') {
        return item?.eventName === coupleEventId || item?.eventKey === coupleEventId;
      }
      return item?.coupleEventId === coupleEventId || item?.eventId === coupleEventId || item?.eventKey === coupleEventId;
    });
  }

  return value;
}

/** Build the server snapshot for one couple without including another couple's records. */
export async function buildCouplePortalSnapshot(coupleEventId: string): Promise<CouplePortalSnapshot | null> {
  const event = findCoupleEventById(coupleEventId);
  if (!event) return null;

  const snapshot: CouplePortalSnapshot = {};
  for (const domain of BACKUP_DOMAINS) {
    if (!GLOBAL_DOMAINS.has(domain.key) && domain.key !== 'coupleEvents' && domain.key !== 'couplePortalConfigs' && !COUPLE_SCOPED_ARRAYS.has(domain.key)) {
      continue;
    }
    try {
      snapshot[domain.key] = scopeDomain(domain.key, domain.read(), coupleEventId);
    } catch {
      snapshot[domain.key] = domain.defaultValue;
    }
  }

  // Store a hash alongside each guest token. The raw token remains in the private
  // snapshot for the couple's link-management UI; public guest RPCs return only
  // the matching guest with its token removed.
  const guests = getCoupleGuests(coupleEventId);
  const inviteExpiresAt = getCouplePortalExpiry(event);
  snapshot.coupleGuests = await Promise.all(
    guests.map(async (guest) => ({
      ...guest,
      tokenHash: guest.token ? await sha256Hex(guest.token) : undefined,
      tokenExpiresAt: inviteExpiresAt || guest.tokenExpiresAt,
    })),
  );
  snapshot.coupleEvents = [{
    ...event,
    inviteExpiresAt,
    collaborators: (event.collaborators || []).map((collaborator) => ({
      ...collaborator,
      inviteExpiresAt: collaborator.inviteExpiresAt || inviteExpiresAt,
    })),
  }];
  return snapshot;
}

export async function syncCouplePortalSnapshotForVenue(
  context: CoupleCloudContext,
  coupleEventId: string,
): Promise<boolean> {
  if (!isCoupleCloudEnabled()) return false;
  const event = findCoupleEventById(coupleEventId);
  const payload = await buildCouplePortalSnapshot(coupleEventId);
  if (!event || !payload) return false;

  const collaboratorTokens = (event.collaborators || [])
    .map((collaborator) => collaborator.inviteToken)
    .filter(Boolean);
  const { data, error } = await getSupabaseClient().rpc('upsert_couple_portal_snapshot', {
    p_organization_id: context.organizationId,
    p_couple_id: coupleEventId,
    p_couple_token: event.inviteToken,
    p_collaborator_tokens: collaboratorTokens,
    p_payload: payload,
  });
  if (error || !data?.ok) return false;
  return true;
}

export async function syncAllCouplePortalSnapshots(context: CoupleCloudContext): Promise<void> {
  if (!isCoupleCloudEnabled()) return;
  const events = getCoupleEvents();
  for (const event of events) {
    await syncCouplePortalSnapshotForVenue(context, event.id);
  }

  // Remove cloud snapshots for couple events deleted in the venue workspace so
  // an old invite cannot continue to open a retired event on another device.
  const { data: existing, error: lookupError } = await getSupabaseClient()
    .from('couple_portal_snapshots')
    .select('couple_id')
    .eq('organization_id', context.organizationId);
  if (lookupError) return;
  const activeIds = new Set(events.map((event) => event.id));
  const staleIds = (existing || [])
    .map((row) => row.couple_id as string)
    .filter((id) => !activeIds.has(id));
  if (staleIds.length > 0) {
    await getSupabaseClient()
      .from('couple_portal_snapshots')
      .delete()
      .eq('organization_id', context.organizationId)
      .in('couple_id', staleIds);
  }
}

export async function pullCouplePortalSnapshot(token: string, venueSlug?: string): Promise<CouplePortalSnapshot | null> {
  if (!isCoupleCloudEnabled() || !token) return null;
  const { data, error } = await getSupabaseClient().rpc(
    venueSlug ? 'get_couple_portal_snapshot_for_venue' : 'get_couple_portal_snapshot',
    venueSlug ? { p_venue_slug: venueSlug, p_token: token } : { p_token: token },
  );
  if (error || !data?.ok || !data.payload) return null;
  return data.payload as CouplePortalSnapshot;
}

export async function saveCouplePortalSnapshot(token: string, payload: CouplePortalSnapshot, venueSlug?: string): Promise<boolean> {
  if (!isCoupleCloudEnabled() || !token) return false;
  const { data, error } = await getSupabaseClient().rpc(
    venueSlug ? 'save_couple_portal_snapshot_for_venue' : 'save_couple_portal_snapshot',
    venueSlug
      ? { p_venue_slug: venueSlug, p_token: token, p_payload: payload }
      : { p_token: token, p_payload: payload },
  );
  return !error && Boolean(data?.ok);
}

/** Merge one event's remote data into the local one-venue browser cache. */
export function hydrateCouplePortalSnapshot(
  snapshot: CouplePortalSnapshot,
  notify = true,
): void {
  for (const domain of BACKUP_DOMAINS) {
    if (!(domain.key in snapshot)) continue;
    const incoming = snapshot[domain.key];
    if (domain.key === 'coupleEvents') {
      const current = Array.isArray(domain.read()) ? domain.read() as Array<{ id?: string }> : [];
      const remote = Array.isArray(incoming) ? incoming as Array<{ id?: string }> : [];
      domain.write([...current.filter((item) => !remote.some((next) => next.id === item.id)), ...remote]);
      continue;
    }
    if (domain.key === 'couplePortalConfigs') {
      const current = domain.read() && typeof domain.read() === 'object' ? domain.read() as Record<string, unknown> : {};
      domain.write({ ...current, ...(incoming as Record<string, unknown>) });
      continue;
    }
    if (COUPLE_SCOPED_ARRAYS.has(domain.key)) {
      const current = Array.isArray(domain.read()) ? domain.read() as Array<Record<string, unknown>> : [];
      const remote = Array.isArray(incoming) ? incoming as Array<Record<string, unknown>> : [];
      const coupleId = remote[0]?.coupleEventId || remote[0]?.eventId || remote[0]?.eventKey || remote[0]?.eventName;
      if (!coupleId) continue;
      const belongs = (item: Record<string, unknown>) =>
        domain.key === 'coupleGuests'
          ? item.eventName === coupleId || item.eventKey === coupleId
          : item.coupleEventId === coupleId || item.eventId === coupleId || item.eventKey === coupleId;
      domain.write([...current.filter((item) => !belongs(item)), ...remote]);
      continue;
    }
    if (GLOBAL_DOMAINS.has(domain.key)) domain.write(incoming);
  }
  if (notify) emitDataChanged('all');
}

/** Hydrate all couple snapshots visible to an authenticated venue member. */
export async function pullAllCouplePortalSnapshotsForVenue(
  context: CoupleCloudContext,
): Promise<void> {
  if (!isCoupleCloudEnabled()) return;
  const { data, error } = await getSupabaseClient()
    .from('couple_portal_snapshots')
    .select('couple_id,payload')
    .eq('organization_id', context.organizationId);
  if (error) throw error;
  for (const row of data || []) {
    if (row.payload) hydrateCouplePortalSnapshot(row.payload as CouplePortalSnapshot, false);
  }
}

export interface GuestPortalCloudSnapshot {
  coupleId: string;
  event?: CoupleEvent[];
  venues?: unknown;
  tableSpecs?: unknown;
  fixtureTypes?: unknown;
  portalConfig?: Record<string, GuestPortalConfig>;
  venueMap?: unknown;
  venueRules?: unknown;
  venueWeather?: unknown;
  guestEvents?: unknown;
  guest?: Record<string, unknown>;
  rsvp?: RSVPSubmission | null;
  updatedAt?: string;
}

export async function pullGuestPortalSnapshot(
  coupleEventId: string,
  guestToken: string,
  venueSlug?: string,
): Promise<GuestPortalCloudSnapshot | null> {
  if (!isCoupleCloudEnabled() || !coupleEventId || !guestToken) return null;
  const { data, error } = await getSupabaseClient().rpc(
    venueSlug ? 'get_guest_couple_portal_snapshot_for_venue' : 'get_guest_couple_portal_snapshot',
    venueSlug
      ? { p_venue_slug: venueSlug, p_couple_id: coupleEventId, p_guest_token: guestToken }
      : { p_couple_id: coupleEventId, p_guest_token: guestToken },
  );
  if (error || !data?.ok) return null;
  return {
    coupleId: coupleEventId,
    event: Array.isArray(data.event) ? data.event as CoupleEvent[] : [],
    venues: data.venues,
    tableSpecs: data.table_specs,
    fixtureTypes: data.fixture_types,
    portalConfig: data.portal_config,
    venueMap: data.venue_map,
    venueRules: data.venue_rules,
    venueWeather: data.venue_weather,
    guestEvents: data.guest_events,
    guest: data.guest,
    rsvp: data.rsvp && data.rsvp !== null ? data.rsvp as RSVPSubmission : null,
    updatedAt: data.updated_at,
  };
}

export async function submitGuestPortalRsvp(
  coupleEventId: string,
  guestToken: string,
  submission: RSVPSubmission,
  venueSlug?: string,
): Promise<boolean> {
  if (!isCoupleCloudEnabled()) return false;
  const { data, error } = await getSupabaseClient().rpc(
    venueSlug ? 'submit_guest_couple_rsvp_for_venue' : 'submit_guest_couple_rsvp',
    venueSlug
      ? { p_venue_slug: venueSlug, p_couple_id: coupleEventId, p_guest_token: guestToken, p_submission: submission }
      : { p_couple_id: coupleEventId, p_guest_token: guestToken, p_submission: submission },
  );
  return !error && Boolean(data?.ok);
}

