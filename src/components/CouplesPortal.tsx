import { useEffect, useMemo, useState } from 'react';
import {
  CoupleEvent,
  CoupleCollaborator,
  CoupleCollaboratorRole,
  EventQuestion,
  EventAnswer,
} from '../types';
import {
  getCoupleEvents,
  resolveCoupleInviteToken,
  saveCoupleSession,
  loadCoupleSession,
  clearCoupleSession,
  addCoupleCollaborator,
  removeCoupleCollaborator,
  updateCoupleEvent,
  deriveRecommendedVenueCategories,
  submitCoupleLayout,
} from '../services/couples/coupleService';
import { getCoupleAnswers, saveCoupleAnswers } from '../services/couples/coupleAnswersService';
import { getCoupleMessages, sendCoupleMessage } from '../services/couples/coupleChatService';
import { getVenues } from '../hooks/useLayoutState';
import { getConfig } from '../config';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { EventQuestionsWizard } from './EventQuestionsWizard';
import { showToast } from './Toast';

type TabId = 'overview' | 'spaces' | 'questions' | 'design' | 'chat' | 'collaborators';

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
    const cats = deriveRecommendedVenueCategories(answers);
    if (cats.length > 0) {
      const recommended = venues.filter((v) => cats.includes(v.category)).map((v) => v.id);
      if (recommended.length > 0) {
        updateCoupleEvent(event.id, { availableSpaces: recommended });
        refresh();
      }
    }
  };

  // ── Chat (venue ↔ couple) ──────────────────────────────────────────────────
  const [chatDraft, setChatDraft] = useState('');
  const [msgTick, setMsgTick] = useState(0);
  const messages = useMemo(
    () => (event ? getCoupleMessages(event.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event, msgTick],
  );

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
            </div>
          )}

          {activeTab === 'spaces' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Pick which venue spaces you'd like to use for your event (ceremony,
                reception, cocktail hour, and more).
              </p>
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
                        onClick={() => {
                          const next = selected
                            ? event.selectedSpaces.filter((s) => s !== space.id)
                            : [...event.selectedSpaces, space.id];
                          updateCoupleEvent(event.id, { selectedSpaces: next });
                          refresh();
                        }}
                        className={`text-left rounded-xl border p-4 transition-all ${
                          selected
                            ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-800">{space.name}</span>
                          <span className="text-xl">{selected ? '✅' : '➕'}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {space.width}' × {space.height}' • {space.capacity} capacity
                        </div>
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
                      <button
                        type="button"
                        onClick={() => handleCopyInviteLink(c.inviteToken)}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Copy link
                      </button>
                      {me.role === 'couple' && c.id !== me.id && (
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
                  disabled={event.layoutStatus === 'pending'}
                >
                  {event.layoutStatus === 'pending' ? 'Submitted…' : 'Submit layouts for approval'}
                </button>
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

          {activeTab === 'chat' && (
            <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm flex flex-col">
              <h3 className="font-semibold text-sm mb-2">Chat with the venue</h3>
              <div className="flex-1 max-h-[40vh] overflow-y-auto space-y-2 border border-gray-100 rounded-lg p-3 bg-gray-50">
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
