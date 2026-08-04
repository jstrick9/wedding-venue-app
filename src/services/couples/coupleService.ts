import {
  CoupleEvent,
  CoupleCollaborator,
  CoupleCollaboratorRole,
  CoupleSession,
} from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { saveVersionedStorage, loadVersionedStorage } from '../../utils/storage';

const COUPLE_EVENTS_KEY = STORAGE_KEYS.COUPLE_EVENTS;
const COUPLE_EVENTS_VERSION = 1;
const SESSION_KEY = STORAGE_KEYS.COUPLE_SESSION;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/** Extract the couple token from the URL (?token= in the hash) and clear it. */
export function getCoupleTokenFromLocation(location: Location = window.location): string | undefined {
  const hash = location.hash || '';
  const queryIndex = hash.indexOf('?');
  if (queryIndex >= 0) {
    const params = new URLSearchParams(hash.slice(queryIndex + 1));
    const token = params.get('token') || undefined;
    // Clear the token from the URL so it isn't left in browser history.
    if (token) {
      const base = hash.slice(0, queryIndex);
      try {
        window.history.replaceState(null, '', `${base}`);
      } catch {
        // ignore
      }
    }
    return token;
  }
  return undefined;
}

function randomToken(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export function getCoupleEvents(): CoupleEvent[] {
  return loadVersionedStorage<CoupleEvent[]>({
    key: COUPLE_EVENTS_KEY,
    defaultValue: [],
    currentVersion: COUPLE_EVENTS_VERSION,
    validate: (v): v is CoupleEvent[] => Array.isArray(v),
    normalize: (v) => (Array.isArray(v) ? v : []),
  });
}

function saveCoupleEvents(events: CoupleEvent[]): void {
  saveVersionedStorage(COUPLE_EVENTS_KEY, COUPLE_EVENTS_VERSION, events);
}

export function createCoupleEvent(input: {
  coupleName: string;
  eventDate?: string;
  eventEndDate?: string;
  guestCount?: number;
  availableSpaces?: string[];
  createdBy?: string;
}): CoupleEvent {
  const event: CoupleEvent = {
    id: `couple-${Date.now()}`,
    coupleName: input.coupleName.trim(),
    inviteToken: randomToken('cp'),
    status: 'invited',
    eventDate: input.eventDate,
    eventEndDate: input.eventEndDate,
    guestCount: input.guestCount,
    availableSpaces: input.availableSpaces || [],
    selectedSpaces: [],
    collaborators: [],
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveCoupleEvents([...getCoupleEvents(), event]);
  return event;
}

export function updateCoupleEvent(
  id: string,
  patch: Partial<Omit<CoupleEvent, 'id' | 'createdAt' | 'inviteToken'>>,
): CoupleEvent | null {
  let updated: CoupleEvent | null = null;
  const next = getCoupleEvents().map((e) => {
    if (e.id !== id) return e;
    updated = { ...e, ...patch, updatedAt: new Date().toISOString() };
    return updated;
  });
  saveCoupleEvents(next);
  return updated;
}

export function deleteCoupleEvent(id: string): void {
  saveCoupleEvents(getCoupleEvents().filter((e) => e.id !== id));
}

export function findCoupleEventById(id: string): CoupleEvent | undefined {
  return getCoupleEvents().find((e) => e.id === id);
}

export function findCoupleEventByInviteToken(token: string): CoupleEvent | undefined {
  if (!token) return undefined;
  const events = getCoupleEvents();
  return (
    events.find((e) => e.inviteToken === token) ||
    events.find((e) => e.collaborators.some((c) => c.inviteToken === token))
  );
}

export function addCoupleCollaborator(
  eventId: string,
  input: { name: string; email: string; role: CoupleCollaboratorRole },
): CoupleCollaborator | null {
  const event = findCoupleEventById(eventId);
  if (!event) return null;
  const collaborator: CoupleCollaborator = {
    id: `col-${Date.now()}`,
    name: input.name.trim(),
    email: input.email.trim(),
    role: input.role,
    inviteToken: randomToken('cc'),
    invitedAt: new Date().toISOString(),
  };
  updateCoupleEvent(eventId, {
    collaborators: [...event.collaborators, collaborator],
    status: event.status === 'invited' ? 'active' : event.status,
  });
  return collaborator;
}

export function removeCoupleCollaborator(eventId: string, collaboratorId: string): void {
  const event = findCoupleEventById(eventId);
  if (!event) return;
  updateCoupleEvent(eventId, {
    collaborators: event.collaborators.filter((c) => c.id !== collaboratorId),
  });
}

// ── Couple session ──────────────────────────────────────────────────────────
export function saveCoupleSession(eventId: string, collaboratorId: string): void {
  const event = findCoupleEventById(eventId);
  if (!event) return;
  const collaborator = event.collaborators.find((c) => c.id === collaboratorId);
  const session: CoupleSession = {
    v: 1,
    eventId,
    collaboratorId,
    role: collaborator?.role || 'couple',
    coupleName: event.coupleName,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore storage failures
  }
}

export function loadCoupleSession(): CoupleSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CoupleSession;
    if (!parsed?.expiresAt || !parsed.eventId) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCoupleSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

/** Resolve a collaborator via token; returns { eventId, collaborator } or null. */
export function resolveCoupleInviteToken(
  token: string,
): { event: CoupleEvent; collaborator: CoupleCollaborator } | null {
  const events = getCoupleEvents();
  for (const event of events) {
    if (event.inviteToken === token) {
      // The couple invite token: the couple themselves. Create an implicit
      // collaborator if none exists yet.
      let owner = event.collaborators.find((c) => c.role === 'couple');
      if (!owner) {
        owner = {
          id: `col-${event.id}-owner`,
          name: event.coupleName,
          email: '',
          role: 'couple',
          inviteToken: event.inviteToken,
          accepted: true,
          invitedAt: event.createdAt,
        };
        updateCoupleEvent(event.id, { collaborators: [...event.collaborators, owner] });
        return { event: findCoupleEventById(event.id)!, collaborator: owner };
      }
      return { event, collaborator: owner };
    }
    const collab = event.collaborators.find((c) => c.inviteToken === token);
    if (collab) return { event, collaborator: collab };
  }
  return null;
}
