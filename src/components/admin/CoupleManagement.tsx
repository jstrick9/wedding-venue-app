import { useEffect, useRef, useState } from 'react';
import type { AdminCommonProps } from './AdminTabTypes';
import { CoupleEvent, CoupleLayoutStatus } from '../../types';
import {
  getCoupleEvents,
  createCoupleEvent,
  deleteCoupleEvent,
  updateCoupleEvent,
  reviewCoupleLayout,
  buildEventDays,
  findCoupleEventById,
} from '../../services/couples/coupleService';
import {
  getCoupleMessages,
  sendCoupleMessage,
  getUnreadCoupleMessageCounts,
  markCoupleChatRead,
} from '../../services/couples/coupleChatService';
import { getCoupleGuests, getCouplePortalConfig, setCouplePortalConfig } from '../../services/couples/coupleGuestService';
import { getCoupleRsvpSubmissions } from '../../services/couples/coupleRsvpService';
import { getGuestPortalConfig } from '../../utils/guestPortal';

interface CoupleManagementProps {
  config: AdminCommonProps['config'];
  venues: AdminCommonProps['venues'];
  user: AdminCommonProps['user'];
  isAdmin?: boolean;
  onShowSuccess: (msg: string) => void;
}

const LAYOUT_BADGE: Record<CoupleLayoutStatus, { label: string; cls: string }> = {
  none: { label: 'Not started', cls: 'bg-gray-100 text-gray-600' },
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  pending: { label: 'Awaiting review', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  changes_requested: { label: 'Changes requested', cls: 'bg-blue-100 text-blue-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
};

/**
 * Couples & Events — venue-side management of booked couples, including the layout
 * approval work queue and venue↔couple chat. Multi-day events are supported via an
 * end date (days are derived across the span).
 */
export function CoupleManagement({ config, venues, user, isAdmin, onShowSuccess }: CoupleManagementProps) {
  const [events, setEvents] = useState<CoupleEvent[]>(() => getCoupleEvents());
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    coupleName: '',
    eventDate: '',
    eventEndDate: '',
    guestCount: '',
    availableSpaces: [] as string[],
  });
  const [error, setError] = useState('');
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ eventDate: '', eventEndDate: '', guestCount: '', availableSpaces: [] as string[] });
  const [openChat, setOpenChat] = useState<string | null>(null);
  const [openGuests, setOpenGuests] = useState<string | null>(null);
  const [chatDrafts, setChatDrafts] = useState<Record<string, string>>({});
  const [chatTick, setChatTick] = useState(0);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Periodically re-poll so the unread-chat badge stays current even when the
  // venue is on the tab but not inside an open chat pane.
  const [pollTick, setPollTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPollTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  // Refresh the chat pane while open so new couple messages appear without the venue
  // having to reload or send. Opening the pane marks the venue side as "read"
  // (clears the unread badge) and keeps it clear while the pane stays open.
  useEffect(() => {
    if (!openChat) return;
    const mark = () => {
      markCoupleChatRead(openChat, 'venue');
      setChatTick((t) => t + 1);
    };
    mark();
    const id = setInterval(mark, 5000);
    return () => clearInterval(id);
  }, [openChat]);

  // Auto-scroll the open chat pane to the newest message.
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatTick, openChat]);
  // Optional review comment per couple event in the approval queue.
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});

  const refresh = () => setEvents(getCoupleEvents());
  void pollTick; // re-render periodically so the unread badge stays current
  const unreadCounts = getUnreadCoupleMessageCounts(events.map((e) => e.id));

  const portalUrl = (token: string) =>
    `${window.location.origin}${window.location.pathname}#/couples-portal?token=${encodeURIComponent(token)}`;

  const handleCopy = (token: string) => {
    void navigator.clipboard?.writeText(portalUrl(token)).then(
      () => onShowSuccess('Invitation link copied to clipboard.'),
      () => {},
    );
  };

  const handleCreate = () => {
    if (!form.coupleName.trim()) {
      setError('Please enter the couple’s name.');
      return;
    }
    if (form.eventDate && form.eventEndDate && form.eventEndDate < form.eventDate) {
      setError('The end date must be on or after the start date.');
      return;
    }
    createCoupleEvent({
      coupleName: form.coupleName,
      eventDate: form.eventDate || undefined,
      eventEndDate: form.eventEndDate || undefined,
      guestCount: form.guestCount ? parseInt(form.guestCount, 10) || undefined : undefined,
      availableSpaces: form.availableSpaces,
      createdBy: user?.id,
    });
    setForm({ coupleName: '', eventDate: '', eventEndDate: '', guestCount: '', availableSpaces: [] });
    setError('');
    setShowCreate(false);
    refresh();
    onShowSuccess('Couple event created. Send the invite link to the couple.');
  };

  const toggleSpace = (venueId: string) => {
    setForm((prev) => ({
      ...prev,
      availableSpaces: prev.availableSpaces.includes(venueId)
        ? prev.availableSpaces.filter((v) => v !== venueId)
        : [...prev.availableSpaces, venueId],
    }));
  };

  const startEdit = (ev: CoupleEvent) => {
    setEditForm({
      eventDate: ev.eventDate || '',
      eventEndDate: ev.eventEndDate || '',
      guestCount: ev.guestCount != null ? String(ev.guestCount) : '',
      availableSpaces: [...ev.availableSpaces],
    });
    setEditEventId(ev.id);
  };

  const toggleEditSpace = (venueId: string) => {
    setEditForm((prev) => ({
      ...prev,
      availableSpaces: prev.availableSpaces.includes(venueId)
        ? prev.availableSpaces.filter((v) => v !== venueId)
        : [...prev.availableSpaces, venueId],
    }));
  };

  const handleSaveEdit = () => {
    if (!editEventId) return;
    if (editForm.eventDate && editForm.eventEndDate && editForm.eventEndDate < editForm.eventDate) {
      onShowSuccess('The end date must be on or after the start date.');
      return;
    }
    const updated = findCoupleEventById(editEventId);
    const availableSet = new Set(editForm.availableSpaces);
    updateCoupleEvent(editEventId, {
      eventDate: editForm.eventDate || undefined,
      eventEndDate: editForm.eventEndDate || undefined,
      guestCount: editForm.guestCount ? parseInt(editForm.guestCount, 10) || undefined : undefined,
      availableSpaces: editForm.availableSpaces,
      // Drop any selected spaces that are no longer available to avoid orphaned selections.
      selectedSpaces: (updated?.selectedSpaces || []).filter((id) => availableSet.has(id)),
      // Drop layout status/notes for spaces that are no longer available.
      spaceLayouts: Object.fromEntries(
        Object.entries(updated?.spaceLayouts || {}).filter(([sid]) => availableSet.has(sid)),
      ),
      days: buildEventDays(editForm.eventDate || undefined, editForm.eventEndDate || undefined),
    });
    // Propagate date changes to the couple's guest portal config so guests see the
    // correct dates, multi-day flag, and RSVP window.
    if (updated) {
      const cfg = getCouplePortalConfig(editEventId, getGuestPortalConfig(), {
        coupleName: updated.coupleName,
        eventDate: editForm.eventDate || updated.eventDate,
        eventEndDate: editForm.eventEndDate || updated.eventEndDate,
      });
      setCouplePortalConfig(editEventId, {
        ...cfg,
        eventStartDate: editForm.eventDate || cfg.eventStartDate,
        eventEndDate: editForm.eventEndDate || cfg.eventEndDate,
        isMultiDay: !!(editForm.eventDate && editForm.eventEndDate && editForm.eventEndDate !== editForm.eventDate),
      });
    }
    setEditEventId(null);
    refresh();
    onShowSuccess('Couple event updated.');
  };

  // Chat pane for an event
  const renderChat = (ev: CoupleEvent) => {
    void chatTick; // re-render when the periodic refresh ticks
    const messages = getCoupleMessages(ev.id);
    const draft = chatDrafts[ev.id] || '';
    const send = () => {
      if (!draft.trim()) return;
      sendCoupleMessage({
        coupleEventId: ev.id,
        senderId: user?.id || 'venue',
        senderName: user?.name || 'Venue',
        senderSide: 'venue',
        message: draft,
      });
      setChatDrafts((p) => ({ ...p, [ev.id]: '' }));
    };
    return (
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500">Chat with {ev.coupleName}</span>
          <button
            type="button"
            onClick={() => setOpenChat(null)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Close
          </button>
        </div>
        <div ref={chatScrollRef} className="max-h-56 overflow-y-auto space-y-2 bg-gray-50 rounded-lg p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No messages yet.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  m.senderSide === 'venue'
                    ? 'ml-auto bg-rose-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}
              >
                <div className={`text-[10px] font-semibold ${m.senderSide === 'venue' ? 'text-rose-100' : 'text-gray-400'}`}>
                  {m.senderName} · {m.senderSide === 'venue' ? 'Venue' : 'Couple'}
                </div>
                <div>{m.message}</div>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setChatDrafts((p) => ({ ...p, [ev.id]: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Reply to the couple..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            aria-label={`Chat with ${ev.coupleName}`}
          />
          <button
            type="button"
            onClick={send}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700"
          >
            Send
          </button>
        </div>
      </div>
    );
  };

  // Approval queue (pending / changes_requested)
  const approvalQueue = events.filter((e) => e.layoutStatus === 'pending' || e.layoutStatus === 'changes_requested');

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 p-4 text-white">
        <h2 className="text-base font-bold">💍 Couples &amp; Events</h2>
        <p className="text-xs text-white/80 mt-1">
          Create booked couples' events, review their submitted layouts in the work queue,
          and chat with each couple. Multi-day events (e.g. rehearsal dinner + ceremony)
          are supported.
        </p>
      </div>

      {/* Layout Approval Work Queue */}
      {approvalQueue.length > 0 && (
        <div className="rounded-xl bg-white border border-amber-200 p-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-1">📋 Layout Approval Queue</h3>
          <p className="text-xs text-gray-500 mb-3">
            {approvalQueue.length} layout{approvalQueue.length === 1 ? '' : 's'} awaiting venue review.
          </p>
          <div className="space-y-3">
            {approvalQueue.map((ev) => (
              <div key={ev.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium text-gray-800">{ev.coupleName}</div>
                    <div className="text-xs text-gray-500">
                      {ev.selectedSpaces.length} space{ev.selectedSpaces.length === 1 ? '' : 's'} · {ev.guestCount || '—'} guests
                      {ev.layoutStatus === 'changes_requested' ? ' · changes requested' : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.open(portalUrl(ev.inviteToken), '_blank')}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Open couple portal
                  </button>
                </div>
                {ev.layoutComment && (
                  <p className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="font-semibold">Previous note:</span> {ev.layoutComment}
                  </p>
                )}
                {ev.spaceLayouts && Object.keys(ev.spaceLayouts).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(ev.spaceLayouts).map(([spaceId, sl]) => {
                      const v = venues.find((x) => x.id === spaceId);
                      const statusBadge =
                        sl.status === 'submitted'
                          ? 'bg-indigo-100 text-indigo-700'
                          : sl.status === 'designed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600';
                      return (
                        <div key={spaceId} className="text-xs flex items-start gap-2">
                          <span className={`shrink-0 px-2 py-0.5 rounded-full ${statusBadge}`}>
                            {sl.status}
                          </span>
                          <span className="text-gray-700">{v?.name || spaceId}</span>
                          {sl.notes && <span className="text-gray-500 truncate">— {sl.notes}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
                <input
                  type="text"
                  value={reviewComments[ev.id] || ''}
                  onChange={(e) => setReviewComments((p) => ({ ...p, [ev.id]: e.target.value }))}
                  placeholder="Optional note to the couple (shown on their side)"
                  className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  aria-label={`Review note for ${ev.coupleName}`}
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      reviewCoupleLayout(ev.id, 'approve', {
                        byName: user?.name || 'Venue',
                        comment: reviewComments[ev.id] || undefined,
                      });
                      refresh();
                      onShowSuccess(`${ev.coupleName}'s layouts approved.`);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
                  >
                    ✓ Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      reviewCoupleLayout(ev.id, 'request_changes', {
                        byName: user?.name || 'Venue',
                        comment: reviewComments[ev.id] || 'Please revise your layouts.',
                      });
                      refresh();
                      onShowSuccess(`Changes requested for ${ev.coupleName}.`);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                  >
                    ↻ Request changes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      reviewCoupleLayout(ev.id, 'reject', {
                        byName: user?.name || 'Venue',
                        comment: reviewComments[ev.id] || undefined,
                      });
                      refresh();
                      onShowSuccess(`${ev.coupleName}'s layouts rejected.`);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-600">
          <strong>{events.length}</strong> couple event{events.length === 1 ? '' : 's'}
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700"
        >
          + New Couple Event
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl bg-white border border-gray-200 p-4 space-y-3 shadow-sm">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Couple name *</label>
            <input
              type="text"
              value={form.coupleName}
              onChange={(e) => setForm({ ...form, coupleName: e.target.value })}
              placeholder="e.g. Smith & Johnson"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start date</label>
              <input
                type="date"
                value={form.eventDate}
                onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End date (multi-day)</label>
              <input
                type="date"
                value={form.eventEndDate}
                onChange={(e) => setForm({ ...form, eventEndDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Guest count</label>
              <input
                type="number"
                min={0}
                value={form.guestCount}
                onChange={(e) => setForm({ ...form, guestCount: e.target.value })}
                placeholder="e.g. 120"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Spaces available to this couple
            </label>
            <div className="flex flex-wrap gap-2">
              {venues.map((v) => {
                const selected = form.availableSpaces.includes(v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggleSpace(v.id)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                      selected
                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-rose-300'
                    }`}
                  >
                    {v.name}
                  </button>
                );
              })}
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium"
            >
              Create Event
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {events.length === 0 && !showCreate ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-gray-500">
          <div className="text-4xl mb-3">💌</div>
          <p className="font-semibold text-gray-700">No couple events yet</p>
          <p className="text-sm mt-1">Create a couple event to invite your first booked couple.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => {
            const badge = LAYOUT_BADGE[ev.layoutStatus];
            return (
              <div key={ev.id} className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">{ev.coupleName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        ev.status === 'completed'
                          ? 'bg-gray-200 text-gray-700'
                          : ev.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}>
                        {ev.status}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
                      {ev.eventDate && <span>📅 {new Date(ev.eventDate).toLocaleDateString()}</span>}
                      {ev.eventEndDate && ev.eventEndDate !== ev.eventDate && (
                        <span>– {new Date(ev.eventEndDate).toLocaleDateString()}</span>
                      )}
                      {ev.guestCount && <span>👥 {ev.guestCount} guests</span>}
                      <span>🏛️ {ev.selectedSpaces.length}/{ev.availableSpaces.length} spaces</span>
                      <span>👥 {ev.collaborators.length} people</span>
                      {(() => {
                        const g = getCoupleGuests(ev.id).length;
                        const rsvps = getCoupleRsvpSubmissions(ev.id);
                        const attending = rsvps.filter((r) => r.attending).length;
                        const declined = rsvps.filter((r) => !r.attending).length;
                        return (
                          <span>
                            🎟️ {g} guests · ✅ {attending} attending · ❌ {declined} · ⏳ {Math.max(0, g - rsvps.length)} no reply
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => handleCopy(ev.inviteToken)} className="text-xs text-rose-600 hover:underline">
                      Copy invite
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(portalUrl(ev.inviteToken), '_blank')}
                      className="text-xs text-gray-600 hover:underline"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(ev)}
                      className="text-xs text-gray-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenGuests(openGuests === ev.id ? null : ev.id)}
                      className="text-xs text-gray-600 hover:underline"
                    >
                      👥 Guests
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenChat(openChat === ev.id ? null : ev.id)}
                      className="text-xs text-gray-600 hover:underline relative"
                    >
                      💬 Chat
                      {(unreadCounts[ev.id] || 0) > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px]">
                          {unreadCounts[ev.id]}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateCoupleEvent(ev.id, {
                          status: ev.status === 'completed' ? 'active' : 'completed',
                        });
                        refresh();
                      }}
                      className="text-xs text-gray-600 hover:underline"
                    >
                      {ev.status === 'completed' ? '↩ Reopen' : '✓ Complete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete the event for ${ev.coupleName}?`)) {
                          deleteCoupleEvent(ev.id);
                          refresh();
                        }
                      }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {ev.collaborators.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs font-medium text-gray-500 mb-1">Collaborators</div>
                    <div className="flex flex-wrap gap-2">
                      {ev.collaborators.map((c) => (
                        <span key={c.id} className="text-xs bg-gray-100 rounded-full px-2 py-0.5 text-gray-700 flex items-center gap-1">
                          {c.name} ({c.role}){c.accepted ? ' ✓' : ' · pending'}
                          <button
                            type="button"
                            onClick={() => handleCopy(portalUrl(c.inviteToken))}
                            className="text-indigo-600 hover:underline"
                            title="Copy collaborator invite link"
                          >
                            📋
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {ev.days && ev.days.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs font-medium text-gray-500 mb-1">Event days</div>
                    <div className="flex flex-wrap gap-2">
                      {ev.days.map((d) => (
                        <span key={d.id} className="text-xs bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5">
                          {d.date} · {d.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {openGuests === ev.id && (() => {
                  const guests = getCoupleGuests(ev.id);
                  const rsvps = getCoupleRsvpSubmissions(ev.id);
                  return (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-xs font-medium text-gray-500 mb-2">Guests ({guests.length})</div>
                      {guests.length === 0 ? (
                        <p className="text-xs text-gray-400">No guests added yet.</p>
                      ) : (
                        <div className="space-y-1 max-h-64 overflow-auto">
                          {guests.map((g) => {
                            const rsvp = rsvps.find((r) => r.guestId === g.id);
                            return (
                              <div key={g.id} className="flex items-center justify-between gap-2 text-sm">
                                <span className="text-gray-700 truncate">{g.name}</span>
                                <span className="flex items-center gap-2 shrink-0">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    rsvp ? (rsvp.attending ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700') : 'bg-gray-100 text-gray-500'
                                  }`}>
                                    {rsvp ? (rsvp.attending ? 'Attending' : 'Not attending') : 'No response'}
                                  </span>
                                  {rsvp?.attending && (
                                    <span className="text-xs text-gray-600 max-w-[220px] truncate" title={[
                                      rsvp.mealChoice ? `Meal: ${rsvp.mealChoice}` : '',
                                      rsvp.plusOneName ? `Plus one: ${rsvp.plusOneName}` : '',
                                      rsvp.dietaryNotes ? `Dietary: ${rsvp.dietaryNotes}` : '',
                                      rsvp.specialNeeds ? `Special needs: ${rsvp.specialNeeds}` : '',
                                      rsvp.notes ? `Notes: ${rsvp.notes}` : '',
                                    ].filter(Boolean).join(' · ')}>
                                      {[
                                        rsvp.mealChoice ? `🍽️ ${rsvp.mealChoice}` : '',
                                        rsvp.specialNeeds ? '♿' : '',
                                        rsvp.dietaryNotes ? '🥗' : '',
                                      ].filter(Boolean).join(' ') || '—'}
                                    </span>
                                  )}
                                  {g.token && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const url = `${window.location.origin}${window.location.pathname}#/guest-portal?token=${encodeURIComponent(g.token!)}&couple=${encodeURIComponent(ev.id)}`;
                                        void navigator.clipboard?.writeText(url).then(
                                          () => onShowSuccess(`Guest invite link copied for ${g.name}.`),
                                          () => {},
                                        );
                                      }}
                                      className="text-xs text-rose-600 hover:underline"
                                      title="Copy guest invite link"
                                    >
                                      📋
                                    </button>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {openChat === ev.id && renderChat(ev)}

                {editEventId === ev.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                    <div className="text-xs font-medium text-gray-500">Edit event</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Start date</label>
                        <input
                          type="date"
                          value={editForm.eventDate}
                          onChange={(e) => setEditForm({ ...editForm, eventDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">End date</label>
                        <input
                          type="date"
                          value={editForm.eventEndDate}
                          onChange={(e) => setEditForm({ ...editForm, eventEndDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Guest count</label>
                      <input
                        type="number"
                        min={0}
                        value={editForm.guestCount}
                        onChange={(e) => setEditForm({ ...editForm, guestCount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Available spaces</label>
                      <div className="flex flex-wrap gap-2">
                        {venues.map((v) => {
                          const sel = editForm.availableSpaces.includes(v.id);
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => toggleEditSpace(v.id)}
                              className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                                sel
                                  ? 'border-rose-500 bg-rose-50 text-rose-700'
                                  : 'border-gray-300 bg-white text-gray-600'
                              }`}
                            >
                              {v.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditEventId(null)}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
