import {
  CoupleEvent,
  CoupleCollaborator,
  CoupleCollaboratorRole,
  CoupleSession,
  CoupleEventDay,
  CoupleLayoutReview,
  CoupleLayoutStatus,
  CoupleSpaceLayout,
  EventAnswer,
  EventQuestion,
} from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { saveVersionedStorage, loadVersionedStorage } from '../../utils/storage';
import { removeCoupleGuestsAndConfig } from './coupleGuestService';
import { removeCoupleRsvps } from './coupleRsvpService';
import { removeCoupleMessages } from './coupleChatService';
import { removeCoupleAnswers } from './coupleAnswersService';
import { removeCoupleChecklists } from './coupleChecklistService';
import { removeCoupleVendors } from './coupleVendorService';
import { removeCoupleSetupTasks } from './coupleSetupService';
import { removeCoupleGuestEvents } from './coupleGuestEventService';

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

/** Build named days across an event date span (e.g. Fri rehearsal, Sat ceremony). */
export function buildEventDays(eventDate?: string, eventEndDate?: string): CoupleEventDay[] {
  if (!eventDate) return [];
  const start = new Date(eventDate);
  const end = eventEndDate ? new Date(eventEndDate) : start;
  if (isNaN(start.getTime())) return [];
  const days: CoupleEventDay[] = [];
  const endTime = isNaN(end.getTime()) || end < start ? start : end;
  const cursor = new Date(start);
  let i = 1;
  while (cursor <= endTime && days.length < 7) {
    days.push({
      id: `day-${cursor.getTime()}`,
      label: i === 1 ? `Day ${i}` : `Day ${i}`,
      date: cursor.toISOString().slice(0, 10),
    });
    cursor.setDate(cursor.getDate() + 1);
    i += 1;
  }
  return days;
}

/**
 * Derive recommended venue categories from a couple's Event Question answers.
 * Mirrors the wizard's space logic: each group/answer that the couple confirms
 * "uses" adds a corresponding venue category.
 */
/**
 * Derive recommended venue categories from a couple's Event Question answers.
 * Mirrors the wizard's space logic: it inspects each answered question's GROUP and
 * TEXT to add a corresponding venue category (the answers alone only store the
 * questionId, which is an opaque `eq-<timestamp>` and can't be matched by text).
 */
export function deriveRecommendedVenueCategories(
  answers: EventAnswer[],
  questions?: EventQuestion[],
): string[] {
  const set = new Set<string>();
  const byId = new Map((questions || []).map((q) => [q.id, q]));
  answers.forEach((a) => {
    const v = a.answerValue;
    if (v === undefined || v === null || String(v).trim() === '') return;
    const answer = String(v).toLowerCase();
    const q = byId.get(a.questionId);
    const text = (q?.text || a.questionId).toLowerCase();

    if (q?.group === 'Ceremony' && (answer.includes('yes') || answer.includes('use'))) set.add('ceremony');
    if (q?.group === 'Reception' && (answer.includes('yes') || answer.includes('use'))) set.add('reception');
    if (q?.group === 'Lodging' && (answer.includes('yes') || answer.includes('use'))) set.add('lodging');
    if (q?.group === 'Rehearsal Dinner' && (answer.includes('yes') || answer.includes('use'))) set.add('rehearsal-dinner');
    // Venue category is 'cocktail' (LayoutCategory); normalize so cocktail venues match.
    if (text.includes('cocktail') && (answer.includes('yes') || answer.includes('use') || answer.includes('cocktail'))) set.add('cocktail');
    if (answer.includes('outdoor')) set.add('outdoor');
  });
  return [...set];
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
  packageId?: string;
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
    packageId: input.packageId,
    addOns: [],
    days: buildEventDays(input.eventDate, input.eventEndDate),
    availableSpaces: input.availableSpaces || [],
    selectedSpaces: [],
    layoutStatus: 'none',
    layoutHistory: [],
    collaborators: [],
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveCoupleEvents([...getCoupleEvents(), event]);
  return event;
}

/** Submit a couple's layout for venue approval (work queue). */
export function submitCoupleLayout(
  id: string,
  opts?: { byName?: string },
): CoupleEvent | null {
  const event = findCoupleEventById(id);
  if (!event) return null;
  // Mark every selected space as submitted (unless already reviewed).
  const spaceLayouts = { ...(event.spaceLayouts || {}) };
  event.selectedSpaces.forEach((sid) => {
    const cur = spaceLayouts[sid];
    if (cur && cur.status !== 'submitted') spaceLayouts[sid] = { ...cur, status: 'submitted' };
    else if (!cur) spaceLayouts[sid] = { status: 'submitted' };
  });
  return updateCoupleEvent(id, {
    layoutStatus: 'pending',
    layoutComment: undefined,
    spaceLayouts,
  });
}

/** Record the couple's design status/notes for a single space. */
export function setSpaceLayout(
  id: string,
  spaceId: string,
  patch: { status?: 'draft' | 'designed' | 'submitted'; notes?: string },
): CoupleEvent | null {
  const event = findCoupleEventById(id);
  if (!event) return null;
  const spaceLayouts = { ...(event.spaceLayouts || {}) };
  spaceLayouts[spaceId] = { ...(spaceLayouts[spaceId] || { status: 'draft' }), ...patch };
  return updateCoupleEvent(id, { spaceLayouts });
}

/** Save (upsert) a drawn layout for a single couple space and mark it designed. */
export function saveCoupleSpaceLayout(
  id: string,
  spaceId: string,
  layout: CoupleSpaceLayout,
): CoupleEvent | null {
  const event = findCoupleEventById(id);
  if (!event) return null;
  const spaceLayouts = { ...(event.spaceLayouts || {}) };
  const prev = spaceLayouts[spaceId] || { status: 'draft' };
  spaceLayouts[spaceId] = {
    ...prev,
    status: prev.status === 'submitted' ? 'submitted' : 'designed',
    layout,
  };
  return updateCoupleEvent(id, { spaceLayouts });
}

/** Venue reviews a couple layout: approve / request changes / reject. */
export function reviewCoupleLayout(
  id: string,
  action: 'approve' | 'request_changes' | 'reject',
  opts: { byName: string; comment?: string },
): CoupleEvent | null {
  const event = findCoupleEventById(id);
  if (!event) return null;
  const review: CoupleLayoutReview = {
    action,
    byName: opts.byName,
    comment: opts.comment,
    at: new Date().toISOString(),
  };
  const status: CoupleLayoutStatus =
    action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'changes_requested';
  return updateCoupleEvent(id, {
    layoutStatus: status,
    layoutComment: opts.comment,
    layoutHistory: [...(event.layoutHistory || []), review],
  });
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
  // Cascade-delete the couple's related data so nothing is orphaned in storage.
  removeCoupleGuestsAndConfig(id);
  removeCoupleRsvps(id);
  removeCoupleMessages(id);
  removeCoupleAnswers(id);
  removeCoupleChecklists(id);
  removeCoupleVendors(id);
  removeCoupleSetupTasks(id);
  removeCoupleGuestEvents(id);
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
  // Prevent inviting the same email twice (e.g. planner already invited).
  const dup = event.collaborators.some(
    (c) => c.email.trim().toLowerCase() === input.email.trim().toLowerCase(),
  );
  if (dup) return null;
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

/** Mark a collaborator as having accepted their invite. */
export function acceptCoupleInvite(eventId: string, collaboratorId: string): void {
  const event = findCoupleEventById(eventId);
  if (!event) return;
  updateCoupleEvent(eventId, {
    collaborators: event.collaborators.map((c) =>
      c.id === collaboratorId ? { ...c, accepted: true } : c,
    ),
  });
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
