import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CoupleEvent,
  CoupleCollaborator,
  CoupleCollaboratorRole,
  CoupleVendor,
  EventQuestion,
  EventAnswer,
  GuestPortalConfig,
  PortalScheduleItem,
  DEFAULT_MEAL_OPTIONS,
} from '../types';
import {
  getCoupleEvents,
  resolveCoupleInviteToken,
  acceptCoupleInvite,
  saveCoupleSession,
  loadCoupleSession,
  clearCoupleSession,
  addCoupleCollaborator,
  removeCoupleCollaborator,
  updateCoupleEvent,
  deriveRecommendedVenueCategories,
  submitCoupleLayout,
  setSpaceLayout,
  saveCoupleSpaceLayout,
} from '../services/couples/coupleService';
import { getCoupleAnswers, saveCoupleAnswers } from '../services/couples/coupleAnswersService';
import { getCoupleMessages, sendCoupleMessage, markCoupleChatRead, getUnreadCoupleMessageCounts } from '../services/couples/coupleChatService';
import {
  getCoupleGuests,
  addCoupleGuest,
  updateCoupleGuest,
  removeCoupleGuest,
  importCoupleGuests,
  exportCoupleGuestsCsv,
  buildGuestInviteUrl,
  getCouplePortalConfig,
  setCouplePortalConfig,
} from '../services/couples/coupleGuestService';
import { getGuestPortalConfig } from '../utils/guestPortal';
import { parseGuestCsv } from '../utils/guestCsv';
import { getCoupleRsvpSubmissions, removeCoupleRsvp, upsertCoupleRsvp } from '../services/couples/coupleRsvpService';
import { getCoupleChecklist, addCoupleChecklistItem, toggleCoupleChecklistItem, removeCoupleChecklistItem } from '../services/couples/coupleChecklistService';
import { getCoupleVendors, addCoupleVendor, updateCoupleVendor, removeCoupleVendor, getVenuePreferredVendors } from '../services/couples/coupleVendorService';
import { VENDOR_CATEGORIES } from '../types/vendor';
import { findWeddingPackage, PACKAGE_DURATIONS, INCLUDED_ITEMS } from '../services/couples/couplePackageService';
import { getActivePackageAddOns, findPackageAddOn, ADD_ON_CATEGORIES } from '../services/couples/coupleAddOnService';
import { getCoupleSetupTasks, addCoupleSetupTask } from '../services/couples/coupleSetupService';
import {
  getCoupleGuestEvents,
  addCoupleGuestEvent,
  updateCoupleGuestEvent,
  removeCoupleGuestEvent,
  assignGuestToEvent,
  removeGuestFromEvent,
  getAssignedGuestCount,
  findCoupleGuestEvent,
  ensureDerivedGuestEvents,
  GUEST_EVENT_KIND_LABELS,
} from '../services/couples/coupleGuestEventService';
import { getVenues } from '../hooks/useLayoutState';
import { getVenueVendors } from '../hooks/useVendors';
import { getVenueMapConfig, findRainContingency, getVenueRules } from '../services/wayfinding/venueWayfindingService';
import { getVenueWeather, eventDates } from '../services/weather/venueWeatherService';
import { getConfig } from '../config';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { EventQuestionsWizard } from './EventQuestionsWizard';
import { showToast } from './Toast';
import { sendCoupleEmail } from '../services/couples/coupleEmailService';
import { CoupleLayoutEditor } from './CoupleLayoutEditor';

type TabId = 'overview' | 'package' | 'spaces' | 'questions' | 'design' | 'checklist' | 'vendors' | 'guests' | 'portal' | 'chat' | 'collaborators';

interface CouplesPortalProps {
  coupleToken?: string;
  onExitPortal: () => void;
}

/**
 * Couples Portal — the portal a booked couple (and their invited collaborators)
 * use after the wedding venue creates their event. This is the foundation slice:
 * token-based access, an overview of the booked event, choosing venue spaces, and
 * inviting collaborators (planner / parents / vendors). Space-driven questions,
 * layout design/approval, and a per-couple guest portal are layered on next.
 */
export default function CouplesPortal({ coupleToken, onExitPortal }: CouplesPortalProps) {
  const config = getConfig();
  const [session, setSession] = useState(() => loadCoupleSession());
  const [events, setEvents] = useState<CoupleEvent[]>(() => getCoupleEvents());
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [invalidInvite, setInvalidInvite] = useState(false);

  const event = useMemo(
    () => events.find((e) => e.id === session?.eventId) || null,
    [events, session],
  );
  const me = useMemo(
    () => event?.collaborators.find((c) => c.id === session?.collaboratorId) || null,
    [event, session],
  );

  // ── Tiered collaborator permissions ─────────────────────────────────────────
  // couple: full control. planner: design/spaces/guests/questions but not portal
  // branding or collaborators. family: can help answer questions + view + chat.
  // vendor: view + chat only.
  const myRole: CoupleCollaboratorRole = me?.role || 'couple';
  // A venue-marked "completed" event is locked for planning: everything is
  // view-only (the couple can still read and chat).
  const isComplete = event?.status === 'completed';
  const canEditSpaces = !isComplete && (myRole === 'couple' || myRole === 'planner');
  const canEditDesign = !isComplete && (myRole === 'couple' || myRole === 'planner');
  const canManageGuests = !isComplete && (myRole === 'couple' || myRole === 'planner');
  const canAnswerQuestions = !isComplete && myRole !== 'vendor';
  const canManagePortal = !isComplete && myRole === 'couple';
  const canManageCollaborators = !isComplete && myRole === 'couple';

  // Token-based entry: if we have a token and no session, resolve it and sign in.
  useEffect(() => {
    if (session) return;
    if (!coupleToken) return;
    const resolved = resolveCoupleInviteToken(coupleToken);
    if (!resolved) {
      setInvalidInvite(true);
      return;
    }
    saveCoupleSession(resolved.event.id, resolved.collaborator.id);
    acceptCoupleInvite(resolved.event.id, resolved.collaborator.id);
    setSession(loadCoupleSession());
    setEvents(getCoupleEvents());
  }, [coupleToken, session]);

  const venues = useMemo(() => getVenues(), []);

  const refresh = () => setEvents(getCoupleEvents());

  // ── Questions (reuse venue's Event Questions, scoped per couple event) ──────
  const eventQuestions = useMemo<EventQuestion[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EVENT_QUESTIONS);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as EventQuestion[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const coupleAnswers = useMemo<EventAnswer[]>(
    () => (event ? getCoupleAnswers(event.id) : []),
    [event],
  );

  const handleSaveAnswers = (answers: EventAnswer[]) => {
    if (!event) return;
    saveCoupleAnswers(event.id, answers);
    // Derive recommended venue categories from answers and narrow availableSpaces
    // to the venues whose category was selected by the couple's answers.
    const cats = deriveRecommendedVenueCategories(answers, eventQuestions);
    if (cats.length > 0) {
      const recommended = venues.filter((v) => cats.includes(v.category)).map((v) => v.id);
      // Preserve any spaces the couple already selected so a narrowing never leaves a
      // selected space unavailable (which would orphan it in selectedSpaces).
      const preserved = (event.selectedSpaces || []).filter((id) =>
        venues.some((v) => v.id === id),
      );
      const merged = Array.from(new Set([...preserved, ...recommended]));
      if (merged.length > 0) {
        updateCoupleEvent(event.id, { availableSpaces: merged });
        refresh();
      }
    }
  };

  // ── Chat (venue ↔ couple) ──────────────────────────────────────────────────
  const [chatDraft, setChatDraft] = useState('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [msgTick, setMsgTick] = useState(0);
  const messages = useMemo(
    () => (event ? getCoupleMessages(event.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event, msgTick],
  );
  // Unread venue→couple messages shown as a badge on the Chat tab.
  const unreadVenueChat = useMemo(
    () => (event ? (getUnreadCoupleMessageCounts([event.id], 'couple')[event.id] || 0) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event, msgTick],
  );

  // Refresh the chat periodically (and when the tab is opened) so the couple sees new
  // venue messages without having to send one themselves. While the Chat tab is open
  // the couple side is marked as "read" so the venue's unread badge stays accurate.
  useEffect(() => {
    if (activeTab === 'chat' && event) markCoupleChatRead(event.id, 'couple');
    setMsgTick((t) => t + 1);
    const id = setInterval(() => {
      if (activeTab === 'chat' && event) markCoupleChatRead(event.id, 'couple');
      setMsgTick((t) => t + 1);
    }, 5000);
    return () => clearInterval(id);
  }, [activeTab === 'chat', event?.id]);

  // Auto-scroll the couple chat to the newest message when it updates.
  useEffect(() => {
    if (activeTab === 'chat') {
      const el = chatScrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [activeTab, msgTick]);

  const handleSendMessage = () => {
    if (!event || !chatDraft.trim()) return;
    sendCoupleMessage({
      coupleEventId: event.id,
      senderId: me?.id || 'couple',
      senderName: me?.name || event.coupleName,
      senderSide: 'couple',
      message: chatDraft,
    });
    setChatDraft('');
    setMsgTick((t) => t + 1);
  };

  const handleLogout = () => {
    clearCoupleSession();
    setSession(null);
  };

  // ── Invite / collaborator handlers ─────────────────────────────────────────
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'planner' as CoupleCollaboratorRole,
  });
  const [inviteError, setInviteError] = useState('');

  // ── Guests management ────────────────────────────────────────────────────
  const [guestTick, setGuestTick] = useState(0);
  // Poll so the couple sees new guest RSVPs (submitted from another device)
  // without reloading the page.
  useEffect(() => {
    const id = setInterval(() => setGuestTick((t) => t + 1), 10000);
    return () => clearInterval(id);
  }, []);
  const coupleGuests = useMemo(
    () => (event ? getCoupleGuests(event.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event, guestTick],
  );
  const coupleRsvps = useMemo(
    () => (event ? getCoupleRsvpSubmissions(event.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event, guestTick],
  );
  const [guestForm, setGuestForm] = useState({ name: '', email: '', phone: '' });
  const [expandedGuestRsvp, setExpandedGuestRsvp] = useState<string | null>(null);
  const [guestError, setGuestError] = useState('');
  const [editingGuest, setEditingGuest] = useState<{ id: string; name: string; email: string; phone: string } | null>(null);
  // Manual RSVP recording (e.g. a guest responded by phone).
  const [rsvpGuestId, setRsvpGuestId] = useState<string | null>(null);
  const [rsvpRecord, setRsvpRecord] = useState({ attending: true as boolean, meal: '', plusOne: '', notes: '' });

  // ── Checklist (couple's own prep checklist) ───────────────────────────────
  const [checklistTick, setChecklistTick] = useState(0);
  const coupleChecklist = useMemo(
    () => (event ? getCoupleChecklist(event.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event, checklistTick],
  );
  const [newCheckItem, setNewCheckItem] = useState({ title: '', phase: '', dueDate: '' });
  const addCheckItem = () => {
    if (!event || !newCheckItem.title.trim()) {
      showToast('Enter a checklist item.', 'warning');
      return;
    }
    addCoupleChecklistItem(event.id, {
      title: newCheckItem.title,
      phase: newCheckItem.phase,
      dueDate: newCheckItem.dueDate,
      createdBy: me?.id,
    });
    setNewCheckItem({ title: '', phase: '', dueDate: '' });
    setChecklistTick((t) => t + 1);
  };

  // ── Vendors (couple's vendors; pick from venue preferred or add custom) ───
  const [vendorTick, setVendorTick] = useState(0);
  const coupleVendors = useMemo(
    () => (event ? getCoupleVendors(event.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event, vendorTick],
  );
  const preferredVendors = useMemo(() => getVenuePreferredVendors(getVenueVendors()), []);
  const [customVendor, setCustomVendor] = useState({ name: '', category: 'other', contactName: '', email: '', phone: '', notes: '' });
  const addCustomVendor = () => {
    if (!event || !customVendor.name.trim()) {
      showToast('Enter a vendor name.', 'warning');
      return;
    }
    addCoupleVendor(event.id, {
      name: customVendor.name,
      category: customVendor.category,
      source: 'custom',
      contactName: customVendor.contactName,
      email: customVendor.email,
      phone: customVendor.phone,
      notes: customVendor.notes,
    });
    setCustomVendor({ name: '', category: 'other', contactName: '', email: '', phone: '', notes: '' });
    setVendorTick((t) => t + 1);
  };
  const pickPreferredVendor = (v: { id: string; name: string; category: string; contactName?: string; email?: string; phone?: string; website?: string }) => {
    if (!event) return;
    const added = addCoupleVendor(event.id, {
      name: v.name,
      category: v.category,
      source: 'preferred',
      venueVendorId: v.id,
      contactName: v.contactName,
      email: v.email,
      phone: v.phone,
      website: v.website,
    });
    setVendorTick((t) => t + 1);
    showToast(added ? `${v.name} added to your vendors.` : `${v.name} is already on your list.`, added ? 'success' : 'info');
  };
  const setVendorStatus = (vendorId: string, status: CoupleVendor['status']) => {
    if (!event) return;
    updateCoupleVendor(event.id, vendorId, { status });
    setVendorTick((t) => t + 1);
  };

  // ── Package & add-ons (couple's booked package + paid add-ons) ────────────
  const [pkgTick, setPkgTick] = useState(0);
  // Layout editor modal state.
  const [layoutEditorSpace, setLayoutEditorSpace] = useState<string | null>(null);
  const bookedPackage = useMemo(() => (event ? findWeddingPackage(event.packageId) : undefined), [event, pkgTick]);
  const addOnCatalog = useMemo(() => getActivePackageAddOns(), []);
  const coupleAddOns = useMemo(() => event?.addOns || [], [event, pkgTick]);

  // ── Guest events (itinerary) ───────────────────────────────────────────────
  const [guestEventTick, setGuestEventTick] = useState(0);
  const coupleGuestEvents = useMemo(
    () => (event ? getCoupleGuestEvents(event.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event, guestEventTick],
  );
  const [newGuestEvent, setNewGuestEvent] = useState({ title: '', capacity: '25' });
  const addGuestEvent = () => {
    if (!event || !newGuestEvent.title.trim()) {
      showToast('Enter an event name.', 'warning');
      return;
    }
    addCoupleGuestEvent(event.id, {
      title: newGuestEvent.title,
      kind: 'custom',
      capacity: newGuestEvent.capacity ? Number(newGuestEvent.capacity) : 25,
    });
    setNewGuestEvent({ title: '', capacity: '25' });
    setGuestEventTick((t) => t + 1);
  };
  // Resolve the couple's selected add-ons to their catalog entries.
  const resolvedAddOns = useMemo(
    () => coupleAddOns.map((a) => findPackageAddOn(a.addOnId)).filter((x): x is NonNullable<typeof x> => !!x),
    [coupleAddOns],
  );
  // Auto-derive default guest events from the package + the couple's add-ons (once).
  useEffect(() => {
    if (!event) return;
    ensureDerivedGuestEvents(event.id, bookedPackage, resolvedAddOns);
    setGuestEventTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, bookedPackage?.id, resolvedAddOns.length]);
  const hasAddOn = (id: string) => coupleAddOns.some((a) => a.addOnId === id);
  const toggleAddOn = (addOnId: string) => {
    if (!event) return;
    const current = event.addOns || [];
    const wasAdded = hasAddOn(addOnId);
    const next = wasAdded
      ? current.filter((a) => a.addOnId !== addOnId)
      : [...current, { addOnId, addedAt: new Date().toISOString() }];
    updateCoupleEvent(event.id, { addOns: next });
    // When the couple adds certain add-ons, auto-suggest a venue setup task so
    // the venue plans the corresponding prep (the venue keeps control/edits).
    const ao = findPackageAddOn(addOnId);
    if (!wasAdded && ao) {
      const existing = getCoupleSetupTasks(event.id);
      const tasks: { key: string; title: string }[] = [];
      if (ao.category === 'lodging') tasks.push({ key: 'lodging', title: 'Prepare lodging for overnight guests' });
      if (ao.category === 'activity') tasks.push({ key: 'activity', title: `Set up guided activity: ${ao.name}` });
      if (ao.category === 'ceremony-reception') tasks.push({ key: 'ceremony', title: `Set up add-on: ${ao.name}` });
      tasks.forEach((t) => {
        if (!existing.some((x) => x.suggested && x.title.toLowerCase().includes(t.key))) {
          addCoupleSetupTask(event.id, { title: t.title, suggested: true });
        }
      });
    }
    setPkgTick((t) => t + 1);
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleAddGuest = () => {
    if (!event || !guestForm.name.trim()) {
      setGuestError('Please enter the guest’s name.');
      return;
    }
    if (guestForm.email.trim() && !isValidEmail(guestForm.email)) {
      setGuestError("That email address isn't valid.");
      return;
    }
    addCoupleGuest(event.id, {
      name: guestForm.name,
      email: guestForm.email,
      phone: guestForm.phone,
    });
    setGuestForm({ name: '', email: '', phone: '' });
    setGuestError('');
    setGuestTick((t) => t + 1);
  };

  const handleSaveGuestEdit = () => {
    if (!event || !editingGuest) return;
    if (!editingGuest.name.trim()) {
      showToast('Please enter the guest’s name.', 'warning');
      return;
    }
    if (editingGuest.email.trim() && !isValidEmail(editingGuest.email)) {
      showToast("That email address isn't valid.", 'warning');
      return;
    }
    updateCoupleGuest(event.id, editingGuest.id, {
      name: editingGuest.name.trim(),
      email: editingGuest.email.trim(),
      phone: editingGuest.phone.trim(),
    });
    setEditingGuest(null);
    setGuestTick((t) => t + 1);
  };

  const saveRecordedRsvp = () => {
    if (!event || !rsvpGuestId) return;
    const guest = coupleGuests.find((g) => g.id === rsvpGuestId);
    if (!guest) return;
    const existing = coupleRsvps.find((r) => r.guestId === guest.id);
    upsertCoupleRsvp(event.id, {
      id: existing?.id || `rsvp-${Date.now()}`,
      guestId: guest.id,
      eventName: event.id,
      eventKey: event.id,
      fullName: guest.name,
      email: guest.email || '',
      phone: guest.phone || '',
      attending: rsvpRecord.attending,
      mealChoice: rsvpRecord.attending ? rsvpRecord.meal || undefined : undefined,
      plusOneName: rsvpRecord.attending ? rsvpRecord.plusOne.trim() || undefined : undefined,
      notes: rsvpRecord.notes.trim() || undefined,
      attendingDays: rsvpRecord.attending ? existing?.attendingDays : [],
      // Manual RSVP defaults to the guest's assigned events (so per-event counts work).
      attendingEvents: rsvpRecord.attending
        ? existing?.attendingEvents && existing.attendingEvents.length > 0
          ? existing.attendingEvents
          : guest.guestEventIds || []
        : [],
      submittedAt: new Date().toISOString(),
    });
    setRsvpGuestId(null);
    setRsvpRecord({ attending: true, meal: '', plusOne: '', notes: '' });
    setGuestTick((t) => t + 1);
    showToast(`RSVP recorded for ${guest.name}.`, 'success');
  };

  const handleCopyGuestLink = (token: string) => {
    void navigator.clipboard?.writeText(buildGuestInviteUrl(token, event?.id)).then(
      () => showToast('Guest invite link copied to clipboard.', 'success'),
      () => showToast('Could not copy — copy the link below.', 'warning'),
    );
  };

  const handleImportGuests = (content: string) => {
    if (!event) return;
    // Use the robust shared CSV parser (quoted fields, header detection) for consistency
    // with the venue's guest import.
    const result = parseGuestCsv(content, getCoupleGuests(event.id));
    if (!result.ok) {
      showToast(result.error || 'Could not parse the CSV file.', 'warning');
      return;
    }
    const rows = (result.guests || []).map((g) => ({ name: g.name, email: g.email || '', phone: g.phone || '' }));
    const added = importCoupleGuests(event.id, rows);
    setGuestTick((t) => t + 1);
    showToast(`Imported ${added} guest${added === 1 ? '' : 's'}.`, 'success');
  };

  // ── Portal settings (per-couple guest portal customization) ────────────────
  const [portalConfigTick, setPortalConfigTick] = useState(0);
  const portalConfig = useMemo<GuestPortalConfig | null>(() => {
    if (!event) return null;
    const venueCfg = getGuestPortalConfig();
    return getCouplePortalConfig(event.id, venueCfg, {
      coupleName: event.coupleName,
      eventDate: event.eventDate,
      eventEndDate: event.eventEndDate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, portalConfigTick]);

  // True only when the couple has actually personalized their guest portal beyond
  // the seeded defaults (hero image set, or welcome/meal options/deadline changed).
  const portalPersonalized = useMemo(() => {
    if (!portalConfig) return false;
    const venueCfg = getGuestPortalConfig();
    const hasHero = !!portalConfig.heroImageUrl;
    const welcomeChanged = !!portalConfig.welcomeMessage && portalConfig.welcomeMessage !== venueCfg?.welcomeMessage;
    const deadlineSet = !!portalConfig.rsvpDeadlineDate;
    const mealsChanged =
      !!portalConfig.mealOptions &&
      portalConfig.mealOptions.length > 0 &&
      (portalConfig.mealOptions.length !== (venueCfg?.mealOptions?.length ?? 0) ||
        portalConfig.mealOptions.some((o, i) => o.value !== venueCfg?.mealOptions?.[i]?.value));
    return hasHero || welcomeChanged || deadlineSet || mealsChanged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalConfig]);

  const [portalDraft, setPortalDraft] = useState<GuestPortalConfig | null>(null);
  const [newMealOption, setNewMealOption] = useState('');
  const [newScheduleItem, setNewScheduleItem] = useState<{ title: string; startTime: string; location: string; dayIndex: number }>({ title: '', startTime: '', location: '', dayIndex: 0 });
  const [portalSaved, setPortalSaved] = useState(false);

  useEffect(() => {
    if (portalConfig) setPortalDraft(portalConfig);
  }, [portalConfig]);

  const savePortalSettings = () => {
    if (!event || !portalDraft) return;
    setCouplePortalConfig(event.id, portalDraft);
    setPortalConfigTick((t) => t + 1);
    setPortalSaved(true);
    setTimeout(() => setPortalSaved(false), 2000);
    showToast('Guest portal settings saved.', 'success');
  };

  const handleInvite = () => {
    if (!event || !inviteForm.name.trim() || !inviteForm.email.trim()) {
      setInviteError('Please provide a name and email.');
      return;
    }
    if (!isValidEmail(inviteForm.email)) {
      setInviteError("That email address isn't valid.");
      return;
    }
    if (event.collaborators.some((c) => c.email.trim().toLowerCase() === inviteForm.email.trim().toLowerCase())) {
      setInviteError('That email is already invited to this portal.');
      return;
    }
    const collab = addCoupleCollaborator(event.id, {
      name: inviteForm.name.trim(),
      email: inviteForm.email.trim(),
      role: inviteForm.role,
    });
    if (collab) {
      setInviteForm({ name: '', email: '', role: 'planner' });
      setInviteError('');
      refresh();
    } else {
      setInviteError('Could not invite — the email may already be on this portal.');
    }
  };

  const coupleName = event?.coupleName || 'our wedding';
  const orgId = (config as any)?.organizationId || '';

  const handleEmailCollaborator = (email: string, name: string, token: string) => {
    const url = `${window.location.origin}${window.location.pathname}#/couples-portal?token=${encodeURIComponent(token)}`;
    const subject = 'Join our wedding planning portal';
    const body = `Hi ${name},\n\nYou've been invited! Open this link to get started:\n\n${url}\n\n— ${coupleName}`;
    void sendCoupleEmail(email, {
      name,
      url,
      coupleName,
      kind: 'couple_invite',
      organizationId: orgId,
      subject,
      body,
    }).then((res) => {
      if (res === 'sent') showToast('Invitation email sent.', 'success');
      else if (res === 'mailto') showToast('Opening your email app to send the invite.', 'info');
    });
  };

  const handleEmailGuest = (email: string, name: string, token: string) => {
    const url = `${window.location.origin}${window.location.pathname}#/guest-portal?token=${encodeURIComponent(token)}&couple=${encodeURIComponent(event?.id || '')}`;
    const subject = `RSVP for ${coupleName}`;
    const body = `Hi ${name},\n\nYou've been invited! Please RSVP here:\n\n${url}\n\n— ${coupleName}`;
    void sendCoupleEmail(email, {
      name,
      url,
      coupleName,
      kind: 'guest_invite',
      organizationId: orgId,
      subject,
      body,
    }).then((res) => {
      if (res === 'sent') showToast('Guest invite email sent.', 'success');
      else if (res === 'mailto') showToast('Opening your email app to send the invite.', 'info');
    });
  };

  /** Send a gentle RSVP reminder to a guest who hasn't responded yet. */
  const handleRemindGuest = (email: string, name: string, token: string) => {
    const url = `${window.location.origin}${window.location.pathname}#/guest-portal?token=${encodeURIComponent(token)}&couple=${encodeURIComponent(event?.id || '')}`;
    const subject = `Friendly reminder: RSVP for ${coupleName}`;
    const body =
      `Hi ${name},\n\n` +
      `We'd love to know if you can make it to ${coupleName}! ` +
      `Please RSVP using this link:\n\n${url}\n\n` +
      `— ${coupleName}`;
    void sendCoupleEmail(email, {
      name,
      url,
      coupleName,
      kind: 'guest_reminder',
      organizationId: orgId,
      subject,
      body,
    }).then((res) => {
      if (res === 'sent') showToast('Reminder email sent.', 'success');
      else if (res === 'mailto') showToast('Opening your email app to send the reminder.', 'info');
    });
  };

  /** Number of invited guests who have not responded (used for the reminder action). */
  const noResponseGuests = coupleGuests.filter((g) => !coupleRsvps.some((r) => r.guestId === g.id));

  const handleCopyInviteLink = (token: string) => {
    const url = `${window.location.origin}${window.location.pathname}#/couples-portal?token=${encodeURIComponent(token)}`;
    void navigator.clipboard?.writeText(url).then(
      () => {},
      () => {},
    );
  };

  // ── Render states ──────────────────────────────────────────────────────────
  if (invalidInvite) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow p-6 max-w-sm w-full text-center space-y-3">
          <div className="text-3xl">💌</div>
          <p className="text-base font-semibold text-gray-800">Invitation not found</p>
          <p className="text-sm text-gray-600">
            This invitation link isn't valid. Please check the link, or contact the venue
            coordinator for a new one.
          </p>
          <button
            type="button"
            onClick={onExitPortal}
            className="mt-2 px-4 py-2 rounded-lg bg-gray-800 text-white text-sm"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (!session || !event || !me) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow p-6 max-w-sm w-full text-center space-y-3">
          <div className="text-3xl">💍</div>
          <p className="text-base font-semibold text-gray-800">Couples Portal</p>
          <p className="text-sm text-gray-600">
            Sign in with the invitation link you received to view and plan your event.
          </p>
          <button
            type="button"
            onClick={onExitPortal}
            className="mt-2 px-4 py-2 rounded-lg bg-gray-800 text-white text-sm"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '🏠' },
    { id: 'questions', label: 'Questions', icon: '❓' },
    { id: 'spaces', label: 'Venue Spaces', icon: '🏛️' },
    { id: 'design', label: 'Design & Approval', icon: '🎨' },
    { id: 'package', label: 'Package', icon: '🎁' },
    { id: 'checklist', label: 'Checklist', icon: '✅' },
    { id: 'vendors', label: 'Vendors', icon: '🧰' },
    { id: 'guests', label: 'Guests', icon: '👥' },
    { id: 'portal', label: 'Portal Settings', icon: '🎛️' },
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'collaborators', label: 'People', icon: '👥' },
  ];

  const roleLabel = (r: CoupleCollaboratorRole) =>
    r === 'couple' ? 'Couple' : r === 'planner' ? 'Planner' : r === 'family' ? 'Family' : 'Vendor';

  const eligibleSpaces = venues.filter((v) => event.availableSpaces.includes(v.id));

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-slate-100 flex flex-col">
      <header className="px-4 pt-4 pb-2 flex items-center justify-between bg-white/70 backdrop-blur-sm border-b border-indigo-100">
        <button
          type="button"
          onClick={onExitPortal}
          className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 underline underline-offset-2 transition-colors"
          aria-label="Return to login screen"
        >
          ← Back to Login
        </button>
        <h1 className="text-sm font-semibold text-gray-800">💍 Couples Portal</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
        >
          Sign out
        </button>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 shadow">
          <div className="text-xs uppercase tracking-wider text-white/70">Your event</div>
          <h2 className="text-2xl font-bold mt-1">{event.coupleName}</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {event.eventDate && (
              <span className="rounded-full bg-white/20 px-3 py-1">
                📅 {new Date(event.eventDate).toLocaleDateString()}
              </span>
            )}
            {event.guestCount && (
              <span className="rounded-full bg-white/20 px-3 py-1">👥 {event.guestCount} guests</span>
            )}
            <span
              className={`rounded-full px-3 py-1 ${
                event.status === 'active'
                  ? 'bg-green-500/70'
                  : event.status === 'completed'
                    ? 'bg-sky-500/70'
                    : 'bg-white/20'
              }`}
            >
              {event.status === 'active'
                ? '● Active'
                : event.status === 'completed'
                  ? '✓ Completed'
                  : '● Invited'}
            </span>
          </div>
        </div>

        {isComplete && (
          <div className="mt-3 rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-800">
            💐 <strong>This event is complete.</strong> Planning is now view-only — you can still
            review everything and message the venue.
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto border-b border-gray-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === t.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <span className="mr-1">{t.icon}</span> {t.label}
              {t.id === 'chat' && !event ? null : t.id === 'chat' && unreadVenueChat > 0 ? (
                <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px]">
                  {unreadVenueChat}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === 'overview' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Welcome, <span className="font-semibold">{me.name}</span> ({roleLabel(me.role)}).
                Plan your celebration, choose your spaces, and invite your wedding party.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-white border border-gray-200 p-4 text-center shadow-sm">
                  <div className="text-3xl">{event.selectedSpaces.length}</div>
                  <div className="text-xs text-gray-500 mt-1">Selected spaces</div>
                </div>
                <div className="rounded-xl bg-white border border-gray-200 p-4 text-center shadow-sm">
                  <div className="text-3xl">{event.collaborators.length}</div>
                  <div className="text-xs text-gray-500 mt-1">People in your portal</div>
                </div>
                <div className="rounded-xl bg-white border border-gray-200 p-4 text-center shadow-sm">
                  <div className="text-3xl">{event.guestCount ?? (bookedPackage ? bookedPackage.maxGuests : '—')}</div>
                  <div className="text-xs text-gray-500 mt-1">{bookedPackage ? 'Guest limit (package)' : 'Expected guests'}</div>
                </div>
              </div>

              {/* Package summary */}
              {bookedPackage && (
                <button
                  type="button"
                  onClick={() => setActiveTab('package')}
                  className="w-full rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 p-4 text-left shadow-sm hover:border-indigo-300"
                >
                  <div className="text-xs text-indigo-500 font-medium mb-1">Your package</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-800">{bookedPackage.name}</span>
                    <span className="text-xs text-gray-500">
                      {PACKAGE_DURATIONS.find((d) => d.id === bookedPackage.durationType)?.label} → add add-ons
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {bookedPackage.maxGuests} guests{bookedPackage.maxOvernightGuests > 0 ? ` · ${bookedPackage.maxOvernightGuests} overnight` : ''}
                    {bookedPackage.lodgingIncluded ? ' · 🛏️ lodging included' : ''}
                    {(event.addOns?.length || 0) > 0 ? ` · ${event.addOns!.length} add-on(s)` : ''}
                  </div>
                </button>
              )}

              {/* Progress + quick links */}
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-sm mb-3">Your progress</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Questions answered', done: coupleAnswers.length > 0, tab: 'questions' as TabId },
                    { label: 'Venue spaces selected', done: event.selectedSpaces.length > 0, tab: 'spaces' as TabId },
                    { label: 'Layouts submitted for approval', done: event.layoutStatus === 'pending' || event.layoutStatus === 'approved', tab: 'design' as TabId },
                    { label: 'Guests invited', done: coupleGuests.length > 0, tab: 'guests' as TabId },
                    { label: 'Guest itinerary set up', done: coupleGuestEvents.length > 0 && coupleGuests.some((g) => (g.guestEventIds || []).length > 0), tab: 'guests' as TabId },
                    { label: 'Portal personalized', done: portalPersonalized, tab: 'portal' as TabId },
                  ].map((step) => (
                    <button
                      key={step.label}
                      type="button"
                      onClick={() => setActiveTab(step.tab)}
                      className="w-full flex items-center gap-2 text-sm text-left hover:bg-gray-50 rounded-lg px-2 py-1.5"
                    >
                      <span className="text-base">{step.done ? '✅' : '⬜'}</span>
                      <span className={`flex-1 ${step.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{step.label}</span>
                      <span className="text-gray-300">→</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Weather for the event days (helps plan outdoor spaces) */}
              {(() => {
                const dates = eventDates(event.eventDate, event.eventEndDate);
                const forecasts = dates
                  .map((d) => ({ d, f: getVenueWeather().forecasts[d] }))
                  .filter((x) => x.f);
                if (forecasts.length === 0) return null;
                return (
                  <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                    <h3 className="font-semibold text-sm mb-2">🌤️ Weather forecast</h3>
                    <div className="space-y-2">
                      {forecasts.map(({ d, f }) => (
                        <div key={d} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{new Date(d + 'T00:00:00').toLocaleDateString()}</span>
                          <span className="inline-flex items-center gap-2 text-gray-700">
                            <span>{f.condition.includes('Rain') || (f.rainChance ?? 0) >= 50 ? '🌧️' : f.condition.includes('Cloud') ? '☁️' : '☀️'}</span>
                            <span className="font-medium">{f.condition}</span>
                            {f.tempLow != null && f.tempHigh != null && (
                              <span className="text-gray-500">{f.tempLow}°–{f.tempHigh}°</span>
                            )}
                            {f.rainChance != null && <span className="text-sky-600">☔ {f.rainChance}%</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Share / preview guest portal */}
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-sm mb-2">Guest portal</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Send your guests their invite links from the Guests tab, or preview your
                  guest portal to see it as they will.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}${window.location.pathname}#/guest-portal?couple=${encodeURIComponent(event.id)}`;
                      void navigator.clipboard?.writeText(url).then(
                        () => showToast('Guest portal link copied to clipboard.', 'success'),
                        () => showToast('Could not copy — copy the link below.', 'warning'),
                      );
                    }}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                  >
                    🔗 Copy portal link
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.open(`${window.location.origin}${window.location.pathname}#/guest-portal?couple=${encodeURIComponent(event.id)}&preview=1`, '_blank');
                    }}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    👁️ Preview portal
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'package' && (
            <div className="space-y-3">
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-sm mb-1">Your wedding package</h3>
                {!bookedPackage ? (
                  <p className="text-xs text-gray-500">
                    Your venue hasn't assigned a package yet. Check back soon, or message the venue.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-bold text-gray-900">{bookedPackage.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                        {PACKAGE_DURATIONS.find((d) => d.id === bookedPackage.durationType)?.label}
                      </span>
                    </div>
                    {bookedPackage.description && <p className="text-sm text-gray-600">{bookedPackage.description}</p>}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                      <div className="rounded-lg bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">Included guests</div>
                        <div className="font-semibold">{bookedPackage.maxGuests}</div>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">Overnight guests</div>
                        <div className="font-semibold">{bookedPackage.maxOvernightGuests > 0 ? bookedPackage.maxOvernightGuests : '—'}</div>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">On-site lodging</div>
                        <div className="font-semibold">{bookedPackage.lodgingIncluded ? 'Included' : 'Add-on'}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Season pricing</div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="bg-gray-100 rounded-full px-3 py-1">Non-Peak: ${bookedPackage.price.nonPeak.toLocaleString()}</span>
                        <span className="bg-gray-100 rounded-full px-3 py-1">Peak: ${bookedPackage.price.peak.toLocaleString()}</span>
                        <span className="bg-gray-100 rounded-full px-3 py-1">Premier: ${bookedPackage.price.premier.toLocaleString()}</span>
                      </div>
                    </div>
                    {bookedPackage.includedItems.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">What's included</div>
                        <div className="flex flex-wrap gap-1.5">
                          {bookedPackage.includedItems.map((id) => (
                            <span key={id} className="text-xs bg-green-50 text-green-700 rounded-full px-2.5 py-1">
                              ✓ {INCLUDED_ITEMS.find((x) => x.id === id)?.label || id}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Add-ons */}
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-sm mb-1">Add-ons you can add</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Add extras to your day — lodging, activities, horse &amp; carriage, and more. You can
                  add or remove these anytime.
                </p>
                {addOnCatalog.length === 0 ? (
                  <p className="text-xs text-gray-400">No add-ons available right now.</p>
                ) : (
                  <div className="space-y-2">
                    {addOnCatalog.map((a) => {
                      const cat = ADD_ON_CATEGORIES.find((c) => c.id === a.category);
                      const added = hasAddOn(a.id);
                      return (
                        <div key={a.id} className="rounded-lg border border-gray-200 p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-800">{cat?.icon} {a.name}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {cat?.label}{a.priceNote ? ` · ${a.priceNote}` : ''}
                              {a.venueVendorId ? ` · ${venues.find((v) => v.id === a.venueVendorId)?.name || 'property'}` : ''}
                              {a.description ? ` · ${a.description}` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-sm font-semibold text-gray-800">${a.price.toLocaleString()}</span>
                            <button
                              type="button"
                              disabled={!canManageGuests}
                              onClick={() => toggleAddOn(a.id)}
                              className={`shrink-0 text-xs px-3 py-1.5 rounded-lg ${
                                added
                                  ? 'bg-green-600 text-white'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
                              } disabled:opacity-50`}
                            >
                              {added ? '✓ Added' : '+ Add'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'spaces' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Pick which venue spaces you'd like to use for your event (ceremony,
                reception, cocktail hour, and more).
              </p>
              {!canEditSpaces && (
                <p className="text-xs text-gray-500 italic">View-only — your role cannot change the selected spaces.</p>
              )}
              {eligibleSpaces.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-gray-500">
                  <div className="text-3xl mb-2">🏛️</div>
                  <p className="font-semibold text-gray-700">No spaces assigned yet</p>
                  <p className="text-sm mt-1">
                    The venue will let you know which spaces are available for your event.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {eligibleSpaces.map((space) => {
                    const selected = event.selectedSpaces.includes(space.id);
                    return (
                      <button
                        key={space.id}
                        type="button"
                        disabled={!canEditSpaces}
                        onClick={() => {
                          const next = selected
                            ? event.selectedSpaces.filter((s) => s !== space.id)
                            : [...event.selectedSpaces, space.id];
                          updateCoupleEvent(event.id, { selectedSpaces: next });
                          refresh();
                        }}
                        className={`text-left rounded-xl border p-4 transition-all ${
                          canEditSpaces
                            ? selected
                              ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                              : 'border-gray-200 bg-white hover:border-indigo-300'
                            : selected
                              ? 'border-indigo-300 bg-indigo-50'
                              : 'border-gray-200 bg-gray-50 cursor-default'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-800">{space.name}</span>
                          <span className="text-xl">{selected ? '✅' : '➕'}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {space.width}' × {space.height}' • {space.capacity} capacity
                          {space.environment && (
                            <span className={`ml-1 inline-block px-1.5 py-0.5 rounded ${space.environment === 'outdoor' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                              {space.environment === 'outdoor' ? '🌤️ outdoor' : space.environment === 'both' ? '🏛️ indoor/outdoor' : '🏠 indoor'}
                            </span>
                          )}
                        </div>
                        {selected && (() => {
                          const limit = bookedPackage ? bookedPackage.maxGuests : event.guestCount;
                          if (!limit || !space.capacity || space.capacity >= limit) return null;
                          return (
                            <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1">
                              ⚠️ This space seats {space.capacity} but you expect {limit} guests.
                            </div>
                          );
                        })()}
                        {(() => {
                          const backup = findRainContingency(getVenueMapConfig(), space.id);
                          if (backup) {
                            const backupVenue = venues.find((v) => v.id === backup.indoorVenueId);
                            return (
                              <div className="mt-2 text-[11px] text-blue-700 bg-blue-50 rounded px-2 py-1">
                                🌧️ Rain backup: {backupVenue?.name || backup.indoorVenueId}
                              </div>
                            );
                          }
                          // Warn when an outdoor space is selected but has no venue-configured backup.
                          if (selected && space.environment === 'outdoor') {
                            return (
                              <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1">
                                ⚠️ No rain backup set — ask the venue about a contingency.
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'collaborators' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Invite your planner, parents, or vendors into your portal so they can help
                plan and approve layouts.
              </p>
              {!canManageCollaborators && (
                <p className="text-xs text-gray-500 italic">View-only — only the couple can invite or remove people.</p>
              )}

              {canManageCollaborators && (
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-sm mb-3">Invite someone</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Name"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    aria-label="Collaborator name"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    aria-label="Collaborator email"
                  />
                  <select
                    value={inviteForm.role}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, role: e.target.value as CoupleCollaboratorRole })
                    }
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    aria-label="Collaborator role"
                  >
                    <option value="planner">Planner</option>
                    <option value="family">Family</option>
                    <option value="vendor">Vendor</option>
                  </select>
                </div>
                {inviteError && <p className="text-xs text-red-600 mt-2">{inviteError}</p>}
                <button
                  type="button"
                  onClick={handleInvite}
                  className="mt-3 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                >
                  ➕ Send invite
                </button>
              </div>
              )}

              <div className="space-y-2">
                {event.collaborators.map((c: CoupleCollaborator) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white border border-gray-200 p-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-800 truncate">{c.name}</div>
                      <div className="text-xs text-gray-500">
                        {c.email || '—'} • {roleLabel(c.role)}
                        {c.accepted ? ' • ✅ accepted' : ' • ⏳ pending'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canManageCollaborators && (
                        <button
                          type="button"
                          onClick={() => handleCopyInviteLink(c.inviteToken)}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Copy link
                        </button>
                      )}
                      {canManageCollaborators && c.email && (
                        <button
                          type="button"
                          onClick={() => handleEmailCollaborator(c.email, c.name, c.inviteToken)}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          ✉️ Email invite
                        </button>
                      )}
                      {canManageCollaborators && c.id !== me.id && (
                        <button
                          type="button"
                          onClick={() => {
                            removeCoupleCollaborator(event.id, c.id);
                            refresh();
                          }}
                          className="text-xs text-red-500 hover:underline"
                          aria-label={`Remove ${c.name}`}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {event.collaborators.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-8 text-center text-gray-500">
                    <p>No collaborators yet. Invite your planner or family to get started.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'questions' && (
            <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
              <h3 className="font-semibold text-sm mb-1">Tell us about your event</h3>
              <p className="text-xs text-gray-500 mb-3">
                Answer the venue's questions to narrow down which spaces and layouts suit
                your guest count and plans. Your answers also recommend venue spaces.
              </p>
              {eventQuestions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 px-6 py-8 text-center text-gray-500 text-sm">
                  The venue hasn't set up any event questions yet.
                </div>
              ) : (
                <EventQuestionsWizard
                  questions={eventQuestions}
                  initialAnswers={coupleAnswers}
                  userId={me?.id || 'couple'}
                  eventId={event.id}
                  readOnly={!canAnswerQuestions}
                  onSaveAnswers={handleSaveAnswers}
                  onVenueFilterChange={() => {}}
                  onComplete={() => refresh()}
                />
              )}
            </div>
          )}

          {activeTab === 'design' && (
            <div className="space-y-3">
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-sm mb-1">Design & Approval</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Design each of your selected spaces in the layout planner, then submit for
                  the venue's approval. The venue reviews your layouts in their work queue.
                </p>
                {!canEditDesign && (
                  <p className="text-xs text-gray-500 italic mb-3">View-only — your role cannot edit or submit layouts.</p>
                )}
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${
                      event.layoutStatus === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : event.layoutStatus === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : event.layoutStatus === 'changes_requested'
                            ? 'bg-blue-100 text-blue-700'
                            : event.layoutStatus === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {event.layoutStatus === 'none'
                      ? 'Not started'
                      : event.layoutStatus === 'draft'
                        ? 'Draft'
                        : event.layoutStatus === 'pending'
                          ? 'Submitted — awaiting venue review'
                          : event.layoutStatus === 'approved'
                            ? 'Approved 🎉'
                            : event.layoutStatus === 'changes_requested'
                              ? 'Changes requested'
                              : 'Rejected'}
                  </span>
                </div>
                {event.layoutComment && (
                  <p className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="font-semibold">Venue note:</span> {event.layoutComment}
                  </p>
                )}
                {(event.layoutStatus === 'changes_requested' || event.layoutStatus === 'rejected') && (
                  <p className="mt-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                    {event.layoutStatus === 'changes_requested'
                      ? 'The venue asked for changes. Revise your layouts above and resubmit for approval.'
                      : 'The venue didn\'t approve these layouts. Review their note, revise, and resubmit when ready.'}
                  </p>
                )}
                {event.layoutStatus === 'approved' && (
                  <p className="mt-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                    These layouts are approved. If your plans change, you can revise and submit updated layouts for a new review.
                  </p>
                )}
                {event.layoutHistory && event.layoutHistory.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {event.layoutHistory.map((h, i) => (
                      <div key={i} className="text-xs text-gray-500">
                        <span className="font-medium">{h.action === 'approve' ? '✓ Approved' : h.action === 'reject' ? '✕ Rejected' : '↻ Changes requested'}</span>
                        {' by '}{h.byName}
                        {h.comment ? ` — ${h.comment}` : ''}
                        <span className="text-gray-400"> · {new Date(h.at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!event.selectedSpaces.length) {
                      showToast('Please select at least one venue space before submitting.', 'warning');
                      return;
                    }
                    submitCoupleLayout(event.id, { byName: me?.name });
                    refresh();
                  }}
                  className="mt-3 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                  disabled={event.layoutStatus === 'pending' || event.layoutStatus === 'approved' || !canEditDesign}
                >
                  {event.layoutStatus === 'pending'
                    ? 'Submitted — awaiting venue review'
                    : event.layoutStatus === 'approved'
                      ? 'Approved ✓'
                      : event.layoutStatus === 'changes_requested' || event.layoutStatus === 'rejected'
                        ? 'Resubmit for approval'
                        : 'Submit layouts for approval'}
                </button>
              </div>

              {/* Per-space design status */}
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-sm mb-2">Your spaces</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Mark each selected space as designed and add notes so the venue can review
                  your plan before approving.
                </p>
                <div className="space-y-2">
                  {event.selectedSpaces.length === 0 ? (
                    <p className="text-xs text-gray-400">No spaces selected yet.</p>
                  ) : (
                    event.selectedSpaces.map((spaceId) => {
                      const venue = venues.find((v) => v.id === spaceId);
                      const sl = (event.spaceLayouts || {})[spaceId];
                      return (
                        <div key={spaceId} className="rounded-lg border border-gray-200 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-sm text-gray-800">
                              {venue?.name || spaceId}
                            </span>
                            <select
                              value={sl?.status || 'draft'}
                              disabled={!canEditDesign}
                              onChange={(e) => {
                                setSpaceLayout(event.id, spaceId, {
                                  status: e.target.value as 'draft' | 'designed' | 'submitted',
                                });
                                refresh();
                              }}
                              className="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white disabled:bg-gray-50"
                              aria-label={`Design status for ${venue?.name || spaceId}`}
                            >
                              <option value="draft">Draft</option>
                              <option value="designed">Designed</option>
                              <option value="submitted">Submitted</option>
                            </select>
                          </div>
                          <input
                            type="text"
                            value={sl?.notes || ''}
                            disabled={!canEditDesign}
                            onChange={(e) => {
                              setSpaceLayout(event.id, spaceId, { notes: e.target.value });
                              refresh();
                            }}
                            placeholder="Notes for the venue (capacity, layout, requests…)"
                            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
                            aria-label={`Notes for ${venue?.name || spaceId}`}
                          />
                          {canEditDesign && venue && (
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setLayoutEditorSpace(spaceId)}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
                              >
                                🎨 {sl?.layout ? 'Edit layout' : 'Open layout editor'}
                              </button>
                              {sl?.layout && (
                                <span className="text-xs text-gray-500">
                                  {sl.layout.tables.length} table(s) · {sl.layout.fixtures.length} fixture(s) · {sl.layout.decor.length} decor saved
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-sm mb-2">Your event days</h3>
                <div className="space-y-2">
                  {(event.days && event.days.length > 0 ? event.days : []).map((day) => (
                    <div key={day.id} className="flex items-center gap-3 text-sm">
                      <span className="w-20 text-gray-500">{day.date}</span>
                      <span className="font-medium text-gray-700">{day.label}</span>
                    </div>
                  ))}
                  {(!event.days || event.days.length === 0) && (
                    <p className="text-xs text-gray-500">
                      No event days configured yet (the venue sets these up).
                    </p>
                  )}
                </div>
              </div>

              {/* Venue rules to keep in mind when designing */}
              {getVenueRules().rules.length > 0 && (
                <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                  <h3 className="font-semibold text-sm mb-2">📜 Venue rules to keep in mind</h3>
                  <ul className="space-y-1 text-xs text-gray-600 list-disc list-inside">
                    {getVenueRules().rules.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'checklist' && (
            <div className="space-y-3">
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-sm mb-1">Your event checklist</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Build your own prep checklist — based on your approved layouts and chosen decor.
                  The venue keeps its own separate setup/staffing plan.
                </p>
                {!canManageGuests && (
                  <p className="text-xs text-gray-500 italic mb-3">View-only — your role cannot edit the checklist.</p>
                )}
                {canManageGuests && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newCheckItem.title}
                      onChange={(e) => setNewCheckItem({ ...newCheckItem, title: e.target.value })}
                      placeholder="Checklist item (e.g. Finalize seating chart)"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      aria-label="Checklist item title"
                    />
                    <input
                      type="text"
                      value={newCheckItem.phase}
                      onChange={(e) => setNewCheckItem({ ...newCheckItem, phase: e.target.value })}
                      placeholder="Phase (e.g. Planning, Setup, Day-of)"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      aria-label="Checklist phase"
                    />
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={newCheckItem.dueDate}
                        onChange={(e) => setNewCheckItem({ ...newCheckItem, dueDate: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        aria-label="Checklist due date"
                      />
                      <button
                        type="button"
                        onClick={addCheckItem}
                        className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Items ({coupleChecklist.length})</h3>
                  {coupleChecklist.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {coupleChecklist.filter((i) => i.done).length} of {coupleChecklist.length} done
                    </span>
                  )}
                </div>
                {coupleChecklist.length === 0 ? (
                  <p className="text-xs text-gray-400">No checklist items yet.</p>
                ) : (
                  <div className="space-y-2">
                    {coupleChecklist.map((item) => (
                      <div key={item.id} className="rounded-lg border border-gray-200 p-3 flex items-center gap-3">
                        <button
                          type="button"
                          disabled={!canManageGuests}
                          onClick={() => {
                            toggleCoupleChecklistItem(event!.id, item.id);
                            setChecklistTick((t) => t + 1);
                          }}
                          className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center text-xs ${
                            item.done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-transparent'
                          }`}
                          aria-label={`Toggle ${item.title}`}
                        >
                          ✓
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm ${item.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{item.title}</div>
                          <div className="text-xs text-gray-500">
                            {item.phase && <span>{item.phase}</span>}
                            {item.phase && item.dueDate && ' · '}
                            {item.dueDate && <span>📅 {new Date(item.dueDate + 'T00:00:00').toLocaleDateString()}</span>}
                          </div>
                        </div>
                        {canManageGuests && (
                          <button
                            type="button"
                            onClick={() => {
                              removeCoupleChecklistItem(event!.id, item.id);
                              setChecklistTick((t) => t + 1);
                            }}
                            className="text-xs text-red-500 hover:underline"
                            aria-label={`Remove ${item.title}`}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'vendors' && (
            <div className="space-y-3">
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-sm mb-1">Your vendors</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Pick from the venue's preferred vendors, or add your own. Track who you've
                  booked for your event.
                </p>
                {!canManageGuests && (
                  <p className="text-xs text-gray-500 italic mb-3">View-only — your role cannot edit vendors.</p>
                )}
              </div>

              {/* Venue preferred vendors (read-only picks) */}
              {preferredVendors.length > 0 && (
                <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                  <h3 className="font-semibold text-sm mb-1">🏛️ Venue preferred vendors</h3>
                  <p className="text-xs text-gray-500 mb-3">One-tap to add any of these to your list.</p>
                  <div className="space-y-2">
                    {preferredVendors.map((v) => {
                      const already = coupleVendors.some((cv) => cv.venueVendorId === v.id);
                      return (
                        <div key={v.id} className="rounded-lg border border-gray-200 p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-800">{v.name}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {VENDOR_CATEGORIES.find((c) => c.id === v.category)?.label || v.category}
                              {v.contactName ? ` · ${v.contactName}` : ''}
                              {v.email ? ` · ${v.email}` : ''}
                            </div>
                          </div>
                          {canManageGuests && (
                            <button
                              type="button"
                              disabled={already}
                              onClick={() => pickPreferredVendor(v)}
                              className={`shrink-0 text-xs px-3 py-1.5 rounded-lg ${
                                already
                                  ? 'bg-gray-100 text-gray-500 cursor-default'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
                              }`}
                            >
                              {already ? '✓ Added' : '+ Add'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add custom vendor */}
              {canManageGuests && (
                <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                  <h3 className="font-semibold text-sm mb-2">➕ Add your own vendor</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={customVendor.name}
                      onChange={(e) => setCustomVendor({ ...customVendor, name: e.target.value })}
                      placeholder="Vendor name"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      aria-label="Custom vendor name"
                    />
                    <select
                      value={customVendor.category}
                      onChange={(e) => setCustomVendor({ ...customVendor, category: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                      aria-label="Custom vendor category"
                    >
                      {VENDOR_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={customVendor.contactName}
                      onChange={(e) => setCustomVendor({ ...customVendor, contactName: e.target.value })}
                      placeholder="Contact name"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      aria-label="Custom vendor contact"
                    />
                    <input
                      type="email"
                      value={customVendor.email}
                      onChange={(e) => setCustomVendor({ ...customVendor, email: e.target.value })}
                      placeholder="Email"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      aria-label="Custom vendor email"
                    />
                    <input
                      type="tel"
                      value={customVendor.phone}
                      onChange={(e) => setCustomVendor({ ...customVendor, phone: e.target.value })}
                      placeholder="Phone"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      aria-label="Custom vendor phone"
                    />
                    <input
                      type="text"
                      value={customVendor.notes}
                      onChange={(e) => setCustomVendor({ ...customVendor, notes: e.target.value })}
                      placeholder="Notes"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      aria-label="Custom vendor notes"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addCustomVendor}
                    className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                  >
                    Add vendor
                  </button>
                </div>
              )}

              {/* Couple's vendor list */}
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-sm mb-3">Your vendor list ({coupleVendors.length})</h3>
                {coupleVendors.length === 0 ? (
                  <p className="text-xs text-gray-400">No vendors yet. Add your own or pick from the venue's list.</p>
                ) : (
                  <div className="space-y-2">
                    {coupleVendors.map((v) => (
                      <div key={v.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-800">{v.name}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {VENDOR_CATEGORIES.find((c) => c.id === v.category)?.label || v.category}
                              {v.source === 'preferred' ? ' · venue preferred' : ' · your own'}
                              {v.contactName ? ` · ${v.contactName}` : ''}
                              {v.email ? ` · ${v.email}` : ''}
                              {v.phone ? ` · ${v.phone}` : ''}
                              {v.cost != null ? ` · $${v.cost}` : ''}
                            </div>
                            {v.notes && <div className="text-xs text-gray-600 mt-1">{v.notes}</div>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              value={v.status}
                              disabled={!canManageGuests}
                              onChange={(e) => setVendorStatus(v.id, e.target.value as CoupleVendor['status'])}
                              className="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white disabled:bg-gray-50"
                              aria-label={`Status for ${v.name}`}
                            >
                              <option value="requested">Requested</option>
                              <option value="contacted">Contacted</option>
                              <option value="booked">Booked</option>
                              <option value="declined">Declined</option>
                            </select>
                            {canManageGuests && (
                              <button
                                type="button"
                                onClick={() => {
                                  removeCoupleVendor(event!.id, v.id);
                                  setVendorTick((t) => t + 1);
                                }}
                                className="text-xs text-red-500 hover:underline"
                                aria-label={`Remove ${v.name}`}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'guests' && (
            <div className="space-y-3">
              {/* RSVP summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Invited', value: coupleGuests.length, color: 'text-gray-800', icon: '👥' },
                  { label: 'Attending', value: coupleGuests.filter((g) => coupleRsvps.some((r) => r.guestId === g.id && r.attending)).length, color: 'text-green-600', icon: '✅' },
                  { label: 'Not attending', value: coupleGuests.filter((g) => coupleRsvps.some((r) => r.guestId === g.id && !r.attending)).length, color: 'text-red-600', icon: '❌' },
                  { label: 'No response', value: coupleGuests.filter((g) => !coupleRsvps.some((r) => r.guestId === g.id)).length, color: 'text-amber-600', icon: '⏳' },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-white border border-gray-200 p-4 text-center shadow-sm">
                    <div className="text-xl">{s.icon}</div>
                    <div className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
              {(() => {
                const limit = bookedPackage ? bookedPackage.maxGuests : event.guestCount;
                if (!limit || coupleGuests.length <= limit) return null;
                return (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
                    ⚠️ You've invited {coupleGuests.length} guests, which is above your{' '}
                    {bookedPackage ? 'package' : 'expected'} guest limit of {limit}.
                    Let the venue know if you'll need extra space.
                  </div>
                );
              })()}
              {/* Meal summary (for catering) */}
              {(() => {
                const attending = coupleRsvps.filter((r) => r.attending);
                const counts = new Map<string, number>();
                let unselected = 0;
                attending.forEach((r) => {
                  if (r.mealChoice) counts.set(r.mealChoice, (counts.get(r.mealChoice) || 0) + 1);
                  else unselected += 1; // attending guest with no meal chosen
                  // Plus-one meals count toward catering too.
                  if (r.plusOneMealChoice) counts.set(r.plusOneMealChoice, (counts.get(r.plusOneMealChoice) || 0) + 1);
                });
                const totalMeals = Array.from(counts.values()).reduce((a, b) => a + b, 0) + unselected;
                if (totalMeals === 0) return null;
                return (
                  <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                    <h3 className="font-semibold text-sm mb-2">🍽️ Meal counts</h3>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(counts.entries()).map(([value, n]) => (
                        <span key={value} className="text-sm bg-gray-100 rounded-full px-3 py-1 text-gray-700">
                          {(portalConfig?.mealOptions?.find((o) => o.value === value)?.label) || value}: <strong>{n}</strong>
                        </span>
                      ))}
                      {unselected > 0 && (
                        <span className="text-sm bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1">
                          No meal selected: <strong>{unselected}</strong>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {attending.length} attending · {totalMeals} total meal(s) for catering.
                    </p>
                  </div>
                );
              })()}
              {/* Per-event RSVP headcount */}
              {coupleGuestEvents.length > 0 && (() => {
                const attending = coupleRsvps.filter((r) => r.attending);
                return (
                  <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                    <h3 className="font-semibold text-sm mb-2">🎟️ RSVPs per event</h3>
                    <div className="space-y-1.5">
                      {coupleGuestEvents.map((ge) => {
                        const count = attending.filter((r) => (r.attendingEvents || []).includes(ge.id)).length;
                        const assigned = getAssignedGuestCount(event!.id, ge.id);
                        return (
                          <div key={ge.id} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{ge.title}</span>
                            <span className="text-xs text-gray-600">
                              {count} attending / {assigned} invited{ge.capacity ? ` / ${ge.capacity} cap` : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {/* Guest events & itinerary */}
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-sm">📅 Guest events &amp; itinerary</h3>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  These are the events your guests are invited to (from your package &amp; add-ons).
                  Set each event's capacity and assign specific guests to each one — e.g. a limited
                  rehearsal dinner or overnight lodging. Guests see only their assigned events and
                  RSVP to each.
                </p>
                {!canManageGuests && <p className="text-xs text-gray-500 italic mb-3">View-only — your role cannot edit guest events.</p>}
                <div className="space-y-2">
                  {coupleGuestEvents.length === 0 && <p className="text-xs text-gray-400">No guest events yet. Assign a package to auto-create them.</p>}
                  {coupleGuestEvents.map((ge) => {
                    const assigned = getAssignedGuestCount(event!.id, ge.id);
                    const over = assigned > ge.capacity;
                    return (
                      <div key={ge.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-800">{ge.title}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{GUEST_EVENT_KIND_LABELS[ge.kind]}</span>
                              {ge.derived && <span className="text-xs text-indigo-400">auto</span>}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {ge.dayIndex != null && event.days?.[ge.dayIndex] ? `Day ${ge.dayIndex + 1} (${event.days[ge.dayIndex].date})` : 'All days'}
                              {ge.startTime ? ` · ${new Date(ge.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                              {ge.location ? ` · ${ge.location}` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${over ? 'bg-red-100 text-red-700' : 'bg-indigo-50 text-indigo-700'}`}>
                              {assigned}/{ge.capacity} assigned
                            </span>
                            {canManageGuests && (
                              <button type="button" onClick={() => { removeCoupleGuestEvent(event!.id, ge.id); setGuestEventTick((t) => t + 1); }} className="text-xs text-red-500 hover:underline" aria-label={`Remove ${ge.title}`}>
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Edit capacity */}
                        {canManageGuests && (
                          <div className="mt-2 flex items-center gap-2">
                            <label className="text-xs text-gray-500">Capacity</label>
                            <input
                              type="number"
                              min={1}
                              value={ge.capacity}
                              onChange={(e) => { updateCoupleGuestEvent(event!.id, ge.id, { capacity: Number(e.target.value) }); setGuestEventTick((t) => t + 1); }}
                              className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-xs"
                              aria-label={`Capacity for ${ge.title}`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {canManageGuests && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs font-medium text-gray-500 mb-1">Add a custom guest event</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input type="text" value={newGuestEvent.title} onChange={(e) => setNewGuestEvent({ ...newGuestEvent, title: e.target.value })} placeholder="Event name" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Custom event name" />
                      <input type="number" value={newGuestEvent.capacity} min={1} onChange={(e) => setNewGuestEvent({ ...newGuestEvent, capacity: e.target.value })} placeholder="Capacity" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Custom event capacity" />
                    </div>
                    <button type="button" onClick={addGuestEvent} className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700">+ Add event</button>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-sm mb-1">Manage your guests</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Add guests, send each one their own invite link to your guest portal, and
                  see who has RSVP'd.
                </p>
                {!canManageGuests && (
                  <p className="text-xs text-gray-500 italic mb-3">View-only — your role cannot add, edit, or remove guests.</p>
                )}
                {canManageGuests && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="Guest name"
                      value={guestForm.name}
                      onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      aria-label="Guest name"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={guestForm.email}
                      onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      aria-label="Guest email"
                    />
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={guestForm.phone}
                      onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      aria-label="Guest phone"
                    />
                    <button
                      type="button"
                      onClick={handleAddGuest}
                      className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                    >
                      ➕ Add guest
                    </button>
                  </div>
                )}
                {guestError && canManageGuests && <p className="text-xs text-red-600 mt-2">{guestError}</p>}
                {canManageGuests && (
                  <label className="mt-3 inline-flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => handleImportGuests(String(reader.result || ''));
                        reader.readAsText(file);
                      }}
                    />
                    📥 Import guests (CSV: name,email,phone)
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!event) return;
                    exportCoupleGuestsCsv(event.id, coupleRsvps);
                    showToast('Guest list exported as CSV.', 'success');
                  }}
                  className="ml-3 text-xs text-indigo-600 hover:underline"
                >
                  📤 Export CSV
                </button>
              </div>

              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="font-semibold text-sm">
                    Guest list ({coupleGuests.length})
                  </h3>
                  {canManageGuests && noResponseGuests.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
                        const rows = noResponseGuests.map((g) => [g.name, g.email || '', g.phone || ''].map(esc).join(','));
                        const csv = ['Name,Email,Phone', ...rows].join('\n');
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'no-response-guests.csv';
                        a.click();
                        URL.revokeObjectURL(url);
                        showToast(`Exported ${noResponseGuests.length} guest${noResponseGuests.length === 1 ? '' : 's'} who haven't responded. Use the 🔔 per-guest button to send a reminder email.`, 'info');
                      }}
                      className="text-xs text-amber-600 hover:underline"
                      title="Download a CSV of guests who haven't responded so you can follow up"
                    >
                      📄 No-response list ({noResponseGuests.length})
                    </button>
                  )}
                </div>
                {coupleGuests.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 px-6 py-8 text-center text-gray-500 text-sm">
                    No guests yet. Add your first guest above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {coupleGuests.map((g) => {
                      const rsvp = coupleRsvps.find((r) => r.guestId === g.id);
                      return (
                        <div key={g.id} className="rounded-lg border border-gray-200 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-sm text-gray-800 truncate">{g.name}</div>
                              <div className="text-xs text-gray-500 truncate">
                                {g.email || '—'} {g.phone ? `• ${g.phone}` : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setExpandedGuestRsvp(expandedGuestRsvp === g.id ? null : g.id)}
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  rsvp ? (rsvp.attending ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700') : 'bg-gray-100 text-gray-500'
                                }`}
                                aria-label={`RSVP details for ${g.name}`}
                              >
                                {rsvp ? (rsvp.attending ? 'Attending' : 'Not attending') : 'No RSVP'}
                              </button>
                            {canManageGuests && g.token && (
                              <button
                                type="button"
                                onClick={() => handleCopyGuestLink(g.token!)}
                                className="text-xs text-indigo-600 hover:underline"
                              >
                                Copy link
                              </button>
                            )}
                            {canManageGuests && g.email && g.token && (
                              <button
                                type="button"
                                onClick={() => handleEmailGuest(g.email!, g.name, g.token!)}
                                className="text-xs text-indigo-600 hover:underline"
                              >
                                ✉️ Email invite
                              </button>
                            )}
                            {canManageGuests && !rsvp && g.email && g.token && (
                              <button
                                type="button"
                                onClick={() => handleRemindGuest(g.email!, g.name, g.token!)}
                                className="text-xs text-amber-600 hover:underline"
                                title="Send an RSVP reminder to this guest"
                              >
                                🔔 Remind
                              </button>
                            )}
                            {canManageGuests && (
                              <button
                                type="button"
                                onClick={() => {
                                  const existing = coupleRsvps.find((r) => r.guestId === g.id);
                                  setRsvpRecord({
                                    attending: existing?.attending ?? true,
                                    meal: existing?.mealChoice || '',
                                    plusOne: existing?.plusOneName || '',
                                    notes: existing?.notes || '',
                                  });
                                  setRsvpGuestId(rsvpGuestId === g.id ? null : g.id);
                                }}
                                className="text-xs text-teal-600 hover:underline"
                                title="Record or edit this guest's RSVP (e.g. from a phone call)"
                              >
                                📝 Record RSVP
                              </button>
                            )}
                            {canManageGuests && (
                              <button
                                type="button"
                                onClick={() => setEditingGuest({ id: g.id, name: g.name, email: g.email || '', phone: g.phone || '' })}
                                className="text-xs text-gray-500 hover:underline"
                              >
                                ✏️ Edit
                              </button>
                            )}
                            {canManageGuests && (
                              <button
                                type="button"
                                onClick={() => {
                                  removeCoupleGuest(event!.id, g.id);
                                  removeCoupleRsvp(event!.id, g.id);
                                  setGuestTick((t) => t + 1);
                                }}
                                className="text-xs text-red-500 hover:underline"
                                aria-label={`Remove ${g.name}`}
                              >
                                Remove
                              </button>
                            )}
                            </div>
                          </div>
                          {editingGuest && editingGuest.id === g.id && (
                            <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-4 gap-2">
                              <input
                                type="text"
                                value={editingGuest.name}
                                onChange={(e) => setEditingGuest({ ...editingGuest, name: e.target.value })}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="Name"
                                aria-label="Edit guest name"
                              />
                              <input
                                type="email"
                                value={editingGuest.email}
                                onChange={(e) => setEditingGuest({ ...editingGuest, email: e.target.value })}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="Email"
                                aria-label="Edit guest email"
                              />
                              <input
                                type="tel"
                                value={editingGuest.phone}
                                onChange={(e) => setEditingGuest({ ...editingGuest, phone: e.target.value })}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="Phone"
                                aria-label="Edit guest phone"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={handleSaveGuestEdit}
                                  className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingGuest(null)}
                                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                          {rsvpGuestId === g.id && (
                            <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Attending?</label>
                                <select
                                  value={rsvpRecord.attending ? 'yes' : 'no'}
                                  onChange={(e) => setRsvpRecord({ ...rsvpRecord, attending: e.target.value === 'yes' })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  aria-label="Recorded attending status"
                                >
                                  <option value="yes">Yes</option>
                                  <option value="no">No</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Meal choice</label>
                                <select
                                  value={rsvpRecord.meal}
                                  disabled={!rsvpRecord.attending}
                                  onChange={(e) => setRsvpRecord({ ...rsvpRecord, meal: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
                                  aria-label="Recorded meal choice"
                                >
                                  <option value="">No meal</option>
                                  {(portalConfig?.mealOptions && portalConfig.mealOptions.length > 0
                                    ? portalConfig.mealOptions
                                    : DEFAULT_MEAL_OPTIONS
                                  ).map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                              </div>
                              <input
                                type="text"
                                value={rsvpRecord.plusOne}
                                disabled={!rsvpRecord.attending}
                                onChange={(e) => setRsvpRecord({ ...rsvpRecord, plusOne: e.target.value })}
                                placeholder="Plus one name"
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
                                aria-label="Recorded plus one"
                              />
                              <input
                                type="text"
                                value={rsvpRecord.notes}
                                onChange={(e) => setRsvpRecord({ ...rsvpRecord, notes: e.target.value })}
                                placeholder="Notes (e.g. dietary)"
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                aria-label="Recorded notes"
                              />
                              <div className="flex gap-2 sm:col-span-2">
                                <button
                                  type="button"
                                  onClick={saveRecordedRsvp}
                                  className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
                                >
                                  Save RSVP
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRsvpGuestId(null)}
                                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                          {expandedGuestRsvp === g.id && rsvp && (
                            <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600 space-y-1">
                              {rsvp.mealChoice && <p>🍽️ Meal: {(portalConfig?.mealOptions && portalConfig.mealOptions.find((o) => o.value === rsvp.mealChoice)?.label) || rsvp.mealChoice}</p>}
                              {rsvp.plusOneName && (
                                <p>➕ Plus one: {rsvp.plusOneName}
                                  {rsvp.plusOneMealChoice ? ` · ${(portalConfig?.mealOptions?.find((o) => o.value === rsvp.plusOneMealChoice)?.label) || rsvp.plusOneMealChoice}` : ''}
                                </p>
                              )}
                              {rsvp.dietaryNotes && <p>🥗 Dietary: {rsvp.dietaryNotes}</p>}
                              {rsvp.specialNeeds && <p>♿ Special needs: {rsvp.specialNeeds}</p>}
                              {rsvp.notes && <p>📝 Notes: {rsvp.notes}</p>}
                              {rsvp.attendingDays && rsvp.attendingDays.length > 0 && (
                                <p>📅 Days: {rsvp.attendingDays.map((d) => d.replace('day', 'Day ')).join(', ')}</p>
                              )}
                              {!rsvp.mealChoice && !rsvp.plusOneName && !rsvp.dietaryNotes && !rsvp.specialNeeds && !rsvp.notes && (
                                <p className="text-gray-400">No meal/dietary details provided.</p>
                              )}
                              {rsvp.attendingEvents && rsvp.attendingEvents.length > 0 && (
                                <p>📅 Attending: {rsvp.attendingEvents.map((id) => findCoupleGuestEvent(id)?.title || id).join(', ')}</p>
                              )}
                            </div>
                          )}
                          {/* Per-guest event assignment (which events this guest is invited to) */}
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <div className="text-xs font-medium text-gray-500 mb-1">Invited to events</div>
                            {coupleGuestEvents.length === 0 ? (
                              <p className="text-xs text-gray-400">No guest events defined yet.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {coupleGuestEvents.map((ge) => {
                                  const checked = (g.guestEventIds || []).includes(ge.id);
                                  const atCap = !checked && getAssignedGuestCount(event!.id, ge.id) >= ge.capacity;
                                  return (
                                    <button
                                      key={ge.id}
                                      type="button"
                                      disabled={!canManageGuests}
                                      onClick={() => {
                                        if (checked) {
                                          removeGuestFromEvent(event!.id, g.id, ge.id);
                                        } else {
                                          if (atCap) {
                                            showToast(`${ge.title} is at capacity (${ge.capacity}).`, 'warning');
                                            return;
                                          }
                                          assignGuestToEvent(event!.id, g.id, ge.id);
                                        }
                                        setGuestEventTick((t) => t + 1);
                                        setGuestTick((t) => t + 1);
                                      }}
                                      className={`text-[11px] px-2 py-1 rounded-full border disabled:cursor-default ${
                                        checked
                                          ? 'bg-indigo-600 text-white border-indigo-600'
                                          : atCap
                                            ? 'bg-gray-100 text-gray-400 border-gray-200'
                                            : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'
                                      }`}
                                    >
                                      {checked ? '✓ ' : ''}{ge.title}{atCap && !checked ? ` (full)` : ''}
                                    </button>
                                  );
                                })}
                                </div>
                              )}
                            </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'portal' && (
            <div className="space-y-3">
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-sm mb-1">Your guest portal settings</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Personalize the portal your guests see — the welcome message, schedule,
                  and meal choices. These were pre-filled from the venue; adjust them to fit
                  your day.
                </p>

                {!canManagePortal && (
                  <p className="text-xs text-gray-500 italic mb-3">View-only — only the couple can change portal settings.</p>
                )}

                {!portalDraft ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : !canManagePortal ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 space-y-2">
                    {portalDraft.welcomeMessage && (
                      <p><span className="font-medium">Welcome:</span> {portalDraft.welcomeMessage}</p>
                    )}
                    {portalDraft.rsvpMessage && (
                      <p><span className="font-medium">RSVP message:</span> {portalDraft.rsvpMessage}</p>
                    )}
                    <p>
                      <span className="font-medium">Visible tabs:</span>{' '}
                      {[
                        ['showRSVP', 'RSVP'],
                        ['showSchedule', 'Schedule'],
                        ['showMap', 'Map'],
                        ['showLodging', 'Lodging'],
                        ['showWayfinding', 'Wayfinding'],
                      ]
                        .filter(([k]) => portalDraft[k as keyof GuestPortalConfig])
                        .map(([, l]) => l)
                        .join(', ') || 'None'}
                    </p>
                    {(portalDraft.scheduleItems?.length || 0) > 0 && (
                      <p><span className="font-medium">Schedule items:</span> {portalDraft.scheduleItems!.length}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Hero image */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Hero image (URL)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={portalDraft.heroImageUrl || ''}
                          onChange={(e) => setPortalDraft({ ...portalDraft, heroImageUrl: e.target.value })}
                          placeholder="https://…/hero.jpg"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          aria-label="Hero image URL"
                        />
                        <button
                          type="button"
                          onClick={() => setPortalDraft({ ...portalDraft, heroImageUrl: '' })}
                          className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-500 hover:bg-gray-50"
                        >
                          Clear
                        </button>
                      </div>
                      {portalDraft.heroImageUrl && (
                        <img
                          src={portalDraft.heroImageUrl}
                          alt="Hero preview"
                          className="mt-2 h-24 w-full object-cover rounded-lg border border-gray-200"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Welcome message
                      </label>
                      <textarea
                        rows={2}
                        value={portalDraft.welcomeMessage || ''}
                        onChange={(e) => setPortalDraft({ ...portalDraft, welcomeMessage: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Welcome to our wedding!"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        RSVP message
                      </label>
                      <textarea
                        rows={2}
                        value={portalDraft.rsvpMessage || ''}
                        onChange={(e) => setPortalDraft({ ...portalDraft, rsvpMessage: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          RSVP deadline
                        </label>
                        <input
                          type="date"
                          value={portalDraft.rsvpDeadlineDate || ''}
                          onChange={(e) => setPortalDraft({ ...portalDraft, rsvpDeadlineDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Guest access closes
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={portalDraft.accessGracePeriodHours ?? 36}
                          onChange={(e) => setPortalDraft({ ...portalDraft, accessGracePeriodHours: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    {/* Tabs */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Visible tabs
                      </label>
                      <div className="flex flex-wrap gap-3">
                        {(
                          [
                            ['showRSVP', 'RSVP'],
                            ['showSchedule', 'Schedule'],
                            ['showMap', 'Map'],
                            ['showLodging', 'Lodging'],
                            ['showWayfinding', 'Wayfinding'],
                          ] as [keyof GuestPortalConfig, string][]
                        ).map(([key, label]) => (
                          <label key={key} className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!portalDraft[key]}
                              onChange={(e) => setPortalDraft({ ...portalDraft, [key]: e.target.checked })}
                              className="w-4 h-4 rounded border-gray-300"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Meal options */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Meal choices
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {(portalDraft.mealOptions && portalDraft.mealOptions.length > 0
                          ? portalDraft.mealOptions
                          : DEFAULT_MEAL_OPTIONS
                        ).map((opt) => (
                          <span key={opt.value} className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm text-indigo-800">
                            {opt.label}
                            <button
                              type="button"
                              onClick={() =>
                                setPortalDraft({
                                  ...portalDraft,
                                  mealOptions: (portalDraft.mealOptions && portalDraft.mealOptions.length > 0
                                    ? portalDraft.mealOptions
                                    : DEFAULT_MEAL_OPTIONS
                                  ).filter((o) => o.value !== opt.value),
                                })
                              }
                              className="text-indigo-400 hover:text-indigo-700 font-bold leading-none"
                              aria-label={`Remove ${opt.label}`}
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newMealOption}
                          onChange={(e) => setNewMealOption(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const label = newMealOption.trim();
                              if (!label) return;
                              const value = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                              const current = portalDraft.mealOptions && portalDraft.mealOptions.length > 0 ? portalDraft.mealOptions : DEFAULT_MEAL_OPTIONS;
                              if (!current.some((o) => o.value === value)) {
                                setPortalDraft({ ...portalDraft, mealOptions: [...current, { value, label }] });
                              }
                              setNewMealOption('');
                            }
                          }}
                          placeholder="Add a meal option (Enter)"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          aria-label="Add meal option"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const label = newMealOption.trim();
                            if (!label) return;
                            const value = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                            const current = portalDraft.mealOptions && portalDraft.mealOptions.length > 0 ? portalDraft.mealOptions : DEFAULT_MEAL_OPTIONS;
                            if (!current.some((o) => o.value === value)) {
                              setPortalDraft({ ...portalDraft, mealOptions: [...current, { value, label }] });
                            }
                            setNewMealOption('');
                          }}
                          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Schedule items */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Schedule
                      </label>
                      <div className="space-y-2 mb-2">
                        {(portalDraft.scheduleItems || []).map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            <span className="flex-1">{item.title}</span>
                            <span className="text-gray-500 text-xs">{item.startTime ? new Date(item.startTime).toLocaleString() : ''}</span>
                            <button
                              type="button"
                              onClick={() => setPortalDraft({ ...portalDraft, scheduleItems: (portalDraft.scheduleItems || []).filter((s) => s.id !== item.id) })}
                              className="text-red-400 hover:text-red-600"
                              aria-label={`Remove ${item.title}`}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        {(!portalDraft.scheduleItems || portalDraft.scheduleItems.length === 0) && (
                          <p className="text-xs text-gray-400">No schedule items yet.</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Title"
                          value={newScheduleItem.title}
                          onChange={(e) => setNewScheduleItem({ ...newScheduleItem, title: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          aria-label="Schedule item title"
                        />
                        <input
                          type="datetime-local"
                          value={newScheduleItem.startTime}
                          onChange={(e) => setNewScheduleItem({ ...newScheduleItem, startTime: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          aria-label="Schedule item time"
                        />
                        <input
                          type="text"
                          placeholder="Location (optional)"
                          value={newScheduleItem.location}
                          onChange={(e) => setNewScheduleItem({ ...newScheduleItem, location: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          aria-label="Schedule item location"
                        />
                        {event?.days && event.days.length > 1 ? (
                          <select
                            value={newScheduleItem.dayIndex}
                            onChange={(e) => setNewScheduleItem({ ...newScheduleItem, dayIndex: Number(e.target.value) })}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                            aria-label="Schedule item day"
                          >
                            {event.days.map((d, idx) => (
                              <option key={d.id} value={idx}>{idx + 1}. {d.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (!newScheduleItem.title.trim()) return;
                            const item: PortalScheduleItem = {
                              id: `sched-${Date.now()}`,
                              title: newScheduleItem.title.trim(),
                              startTime: newScheduleItem.startTime ? new Date(newScheduleItem.startTime).toISOString() : new Date().toISOString(),
                              location: newScheduleItem.location || undefined,
                              dayIndex: newScheduleItem.dayIndex,
                            };
                            setPortalDraft({ ...portalDraft, scheduleItems: [...(portalDraft.scheduleItems || []), item] });
                            setNewScheduleItem({ title: '', startTime: '', location: '', dayIndex: 0 });
                          }}
                          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={savePortalSettings}
                      className="w-full py-3 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
                    >
                      {portalSaved ? '✅ Saved!' : '💾 Save portal settings'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm flex flex-col">
              <h3 className="font-semibold text-sm mb-2">Chat with the venue</h3>
              <div ref={chatScrollRef} className="flex-1 max-h-[40vh] overflow-y-auto space-y-2 border border-gray-100 rounded-lg p-3 bg-gray-50">
                {messages.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    No messages yet. Say hello to your venue coordinator!
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                        m.senderSide === 'couple'
                          ? 'ml-auto bg-indigo-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-800'
                      }`}
                    >
                      <div className={`text-[10px] font-semibold ${m.senderSide === 'couple' ? 'text-indigo-200' : 'text-gray-400'}`}>
                        {m.senderName} · {m.senderSide === 'venue' ? 'Venue' : 'Couple'}
                        {m.createdAt && <span className="font-normal"> · {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                      </div>
                      <div>{m.message}</div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  placeholder="Message the venue..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  aria-label="Chat message"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="px-4 py-4 text-center text-xs text-gray-500">
        {config.venueName || 'Wedding Venue'} · Couples Portal
      </footer>

      {/* Embedded layout editor for a selected space */}
      {layoutEditorSpace && (() => {
        const venue = venues.find((v) => v.id === layoutEditorSpace);
        if (!venue) return null;
        const sl = (event.spaceLayouts || {})[layoutEditorSpace];
        return (
          <CoupleLayoutEditor
            venue={venue}
            initial={sl?.layout || null}
            onSave={(layout) => {
              saveCoupleSpaceLayout(event.id, layoutEditorSpace, layout);
              refresh();
              showToast(`${venue.name} layout saved.`, 'success');
            }}
            onClose={() => setLayoutEditorSpace(null)}
          />
        );
      })()}
    </div>
  );
}
