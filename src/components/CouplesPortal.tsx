import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CoupleEvent,
  CoupleCollaborator,
  CoupleCollaboratorRole,
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
import { getCoupleRsvpSubmissions, removeCoupleRsvp } from '../services/couples/coupleRsvpService';
import { getVenues } from '../hooks/useLayoutState';
import { getVenueMapConfig, findRainContingency } from '../services/wayfinding/venueWayfindingService';
import { getConfig } from '../config';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { EventQuestionsWizard } from './EventQuestionsWizard';
import { showToast } from './Toast';

type TabId = 'overview' | 'spaces' | 'questions' | 'design' | 'guests' | 'portal' | 'chat' | 'collaborators';

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
  const canEditSpaces = myRole === 'couple' || myRole === 'planner';
  const canEditDesign = myRole === 'couple' || myRole === 'planner';
  const canManageGuests = myRole === 'couple' || myRole === 'planner';
  const canAnswerQuestions = myRole !== 'vendor';
  const canManagePortal = myRole === 'couple';
  const canManageCollaborators = myRole === 'couple';

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

  const handleAddGuest = () => {
    if (!event || !guestForm.name.trim()) {
      setGuestError('Please enter the guest’s name.');
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
    updateCoupleGuest(event.id, editingGuest.id, {
      name: editingGuest.name.trim(),
      email: editingGuest.email.trim(),
      phone: editingGuest.phone.trim(),
    });
    setEditingGuest(null);
    setGuestTick((t) => t + 1);
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
    const collab = addCoupleCollaborator(event.id, {
      name: inviteForm.name.trim(),
      email: inviteForm.email.trim(),
      role: inviteForm.role,
    });
    if (collab) {
      setInviteForm({ name: '', email: '', role: 'planner' });
      setInviteError('');
      refresh();
    }
  };

  // Build a mailto: link that pre-fills an invitation email with the invite URL.
  const mailtoInvite = (email: string, name: string, url: string, subject: string) => {
    const body = `Hi ${name},\n\nYou've been invited! Open this link to get started:\n\n${url}\n\n— ${event?.coupleName || 'Your event team'}`;
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleEmailCollaborator = (email: string, name: string, token: string) => {
    const url = `${window.location.origin}${window.location.pathname}#/couples-portal?token=${encodeURIComponent(token)}`;
    window.location.href = mailtoInvite(email, name, url, `Join our wedding planning portal`);
  };

  const handleEmailGuest = (email: string, name: string, token: string) => {
    const url = `${window.location.origin}${window.location.pathname}#/guest-portal?token=${encodeURIComponent(token)}&couple=${encodeURIComponent(event?.id || '')}`;
    window.location.href = mailtoInvite(email, name, url, `RSVP for ${event?.coupleName || 'our wedding'}`);
  };

  /** Pre-fill a gentle RSVP reminder for a guest who hasn't responded yet. */
  const handleRemindGuest = (email: string, name: string, token: string) => {
    const url = `${window.location.origin}${window.location.pathname}#/guest-portal?token=${encodeURIComponent(token)}&couple=${encodeURIComponent(event?.id || '')}`;
    const subject = `Friendly reminder: RSVP for ${event?.coupleName || 'our wedding'}`;
    const body =
      `Hi ${name},\n\n` +
      `We'd love to know if you can make it to ${event?.coupleName || 'our wedding'}! ` +
      `Please RSVP using this link:\n\n${url}\n\n` +
      `— ${event?.coupleName || 'Your event team'}`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
                event.status === 'active' ? 'bg-green-500/70' : 'bg-white/20'
              }`}
            >
              {event.status === 'active' ? '● Active' : '● Invited'}
            </span>
          </div>
        </div>

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
                  <div className="text-3xl">{event.guestCount ?? '—'}</div>
                  <div className="text-xs text-gray-500 mt-1">Expected guests</div>
                </div>
              </div>

              {/* Progress + quick links */}
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-sm mb-3">Your progress</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Questions answered', done: coupleAnswers.length > 0, tab: 'questions' as TabId },
                    { label: 'Venue spaces selected', done: event.selectedSpaces.length > 0, tab: 'spaces' as TabId },
                    { label: 'Layouts submitted for approval', done: event.layoutStatus === 'pending' || event.layoutStatus === 'approved', tab: 'design' as TabId },
                    { label: 'Guests invited', done: coupleGuests.length > 0, tab: 'guests' as TabId },
                    { label: 'Portal personalized', done: !!portalConfig?.welcomeMessage || !!portalConfig?.heroImageUrl || (portalConfig?.mealOptions?.length ?? 0) > 0, tab: 'portal' as TabId },
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
                  disabled={event.layoutStatus === 'pending' || !canEditDesign}
                >
                  {event.layoutStatus === 'pending' ? 'Submitted…' : 'Submit layouts for approval'}
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
                    exportCoupleGuestsCsv(event.id);
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
                            </div>
                          )}
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
    </div>
  );
}
