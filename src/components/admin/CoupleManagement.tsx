import { useEffect, useRef, useState } from 'react';
import { useConfirm } from '../useConfirm';
import type { AdminCommonProps } from './AdminTabTypes';
import { CoupleEvent, CoupleLayoutStatus, CoupleSetupStatus } from '../../types';
import { CoupleLayoutPreview } from '../CoupleLayoutPreview';
import {
  getCoupleEvents,
  createCoupleEvent,
  deleteCoupleEvent,
  updateCoupleEvent,
  reviewCoupleLayout,
  buildEventDays,
  findCoupleEventById,
  buildCoupleInviteUrl,
  rotateCoupleInviteToken,
} from '../../services/couples/coupleService';
import {
  getCoupleMessages,
  sendCoupleMessage,
  getUnreadCoupleMessageCounts,
  markCoupleChatRead,
} from '../../services/couples/coupleChatService';
import { buildGuestInviteUrl, getCoupleGuests, getCouplePortalConfig, rotateCoupleGuestToken, setCouplePortalConfig } from '../../services/couples/coupleGuestService';
import { getCoupleRsvpSubmissions } from '../../services/couples/coupleRsvpService';
import { getCoupleGuestEvents, getAssignedGuestCount, GUEST_EVENT_KIND_LABELS, ensureDerivedGuestEventsForCouple } from '../../services/couples/coupleGuestEventService';
import { getGuestPortalConfig } from '../../utils/guestPortal';
import { getCoupleSetupTasks, addCoupleSetupTask, updateCoupleSetupTask, removeCoupleSetupTask } from '../../services/couples/coupleSetupService';
import { getActiveWeddingPackages, findWeddingPackage, suggestSetupTaskTitles } from '../../services/couples/couplePackageService';
import { findPackageAddOn } from '../../services/couples/coupleAddOnService';
import { BrandedSectionHeader, BrandedStatCard } from './shared/AdminSharedComponents';
import { normalizeEmail } from '../../utils/contactQuality';

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
 * Couples Portal — venue-side management of booked couples, including the layout
 * approval work queue and venue↔couple chat. Multi-day events are supported via an
 * end date (days are derived across the span).
 */
export function CoupleManagement({ config, venues, user, isAdmin, onShowSuccess }: CoupleManagementProps) {
  const { confirm, confirmDialog } = useConfirm();
  const [events, setEvents] = useState<CoupleEvent[]>(() => getCoupleEvents());
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    coupleName: '',
    primaryEmail: '',
    eventDate: '',
    eventEndDate: '',
    guestCount: '',
    packageId: '',
    availableSpaces: [] as string[],
  });
  const [error, setError] = useState('');
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ primaryEmail: '', eventDate: '', eventEndDate: '', guestCount: '', packageId: '', availableSpaces: [] as string[] });
  const [openChat, setOpenChat] = useState<string | null>(null);
  const [openGuests, setOpenGuests] = useState<string | null>(null);
  const [openSetup, setOpenSetup] = useState<string | null>(null);
  const [openPkg, setOpenPkg] = useState<string | null>(null);
  const [openItin, setOpenItin] = useState<string | null>(null);
  const [setupDrafts, setSetupDrafts] = useState<Record<string, { title: string; spaceId: string; dayIndex: string; assignee: string; scheduledFor: string; notes: string }>>({});
  const [setupTick, setSetupTick] = useState(0);
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

  const portalUrl = (token: string) => buildCoupleInviteUrl(token);

  const handleCopy = (token: string) => {
    void navigator.clipboard?.writeText(portalUrl(token)).then(
      () => onShowSuccess('Invitation link copied to clipboard.'),
      () => {},
    );
  };

  const handleReissueCouple = (event: CoupleEvent) => {
    const ownerEmail = event.primaryEmail
      || event.collaborators.find((collaborator) => collaborator.role === 'couple')?.email;
    if (!normalizeEmail(ownerEmail, { required: true }).ok) {
      onShowSuccess('Add a valid primary couple email before reissuing a personal account invite.');
      return;
    }
    const nextToken = rotateCoupleInviteToken(event.id);
    if (!nextToken) {
      onShowSuccess('This couple link cannot be reissued because portal access has closed.');
      return;
    }
    refresh();
    void navigator.clipboard?.writeText(portalUrl(nextToken));
    onShowSuccess('New couple invite link created; couple planning history was preserved.');
  };

  const handleReissueGuest = (event: CoupleEvent, guestId: string, guestName: string) => {
    const guest = getCoupleGuests(event.id).find((candidate) => candidate.id === guestId);
    const email = normalizeEmail(guest?.email, { required: true });
    if (!email.ok) {
      onShowSuccess('Add a valid guest email before reissuing a personal account invite.');
      return;
    }
    const nextToken = rotateCoupleGuestToken(event.id, guestId);
    if (!nextToken) {
      onShowSuccess('This guest link could not be reissued.');
      return;
    }
    refresh();
    void navigator.clipboard?.writeText(buildGuestInviteUrl(nextToken, event.id));
    onShowSuccess(`New guest link created for ${guestName}; RSVP history was preserved.`);
  };

  const handleCreate = () => {
    if (!form.coupleName.trim()) {
      setError('Please enter the couple’s name.');
      return;
    }
    const primaryEmail = normalizeEmail(form.primaryEmail, { required: true });
    if (!primaryEmail.ok) {
      setError(primaryEmail.error || 'Enter the email address that will own the primary couple account.');
      return;
    }
    if (form.eventDate && form.eventEndDate && form.eventEndDate < form.eventDate) {
      setError('The end date must be on or after the start date.');
      return;
    }
    // Guard the guest count so a NaN/negative/0 value can't silently be saved.
    let guestCount: number | undefined;
    if (form.guestCount && form.guestCount.trim()) {
      const gc = parseInt(form.guestCount, 10);
      if (Number.isNaN(gc) || gc < 1) {
        setError('Enter a valid guest count (greater than 0).');
        return;
      }
      guestCount = gc;
    }
    const created = createCoupleEvent({
      coupleName: form.coupleName,
      primaryEmail: primaryEmail.value,
      eventDate: form.eventDate || undefined,
      eventEndDate: form.eventEndDate || undefined,
      guestCount,
      packageId: form.packageId || undefined,
      availableSpaces: form.availableSpaces,
      createdBy: user?.id,
    });
    // Auto-suggest the venue's setup tasks from the assigned package.
    const pkg = findWeddingPackage(form.packageId);
    if (pkg) {
      suggestSetupTaskTitles(pkg).forEach((title) => {
        addCoupleSetupTask(created.id, { title, spaceId: created.selectedSpaces?.[0], suggested: true });
      });
    }
    setForm({ coupleName: '', primaryEmail: '', eventDate: '', eventEndDate: '', guestCount: '', packageId: '', availableSpaces: [] });
    setError('');
    setShowCreate(false);
    refresh();
    onShowSuccess(pkg ? `Couple event created with ${pkg.name}. Setup tasks suggested.` : 'Couple event created. Send the invite link to the couple.');
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
      primaryEmail: ev.primaryEmail || ev.collaborators.find((collaborator) => collaborator.role === 'couple')?.email || '',
      eventDate: ev.eventDate || '',
      eventEndDate: ev.eventEndDate || '',
      guestCount: ev.guestCount != null ? String(ev.guestCount) : '',
      packageId: ev.packageId || '',
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
    let guestCount: number | undefined;
    if (editForm.guestCount && editForm.guestCount.trim()) {
      const gc = parseInt(editForm.guestCount, 10);
      if (Number.isNaN(gc) || gc < 1) {
        onShowSuccess('Enter a valid guest count (greater than 0).');
        return;
      }
      guestCount = gc;
    }
    const updated = findCoupleEventById(editEventId);
    if (!updated) return;
    const primaryEmail = normalizeEmail(editForm.primaryEmail, { required: Boolean(updated.primaryEmail) });
    if (!primaryEmail.ok) {
      onShowSuccess(primaryEmail.error || 'Enter a valid primary couple email.');
      return;
    }
    const availableSet = new Set(editForm.availableSpaces);
    const ownerIndex = updated.collaborators.findIndex((collaborator) => collaborator.role === 'couple');
    const collaborators = [...updated.collaborators];
    if (primaryEmail.value) {
      if (ownerIndex >= 0) {
        collaborators[ownerIndex] = {
          ...collaborators[ownerIndex],
          email: primaryEmail.value,
          personalAccountRequired: true,
        };
      } else {
        collaborators.push({
          id: `col-${updated.id}-owner`,
          name: updated.coupleName,
          email: primaryEmail.value,
          role: 'couple',
          inviteToken: updated.inviteToken,
          inviteIssuedAt: updated.inviteIssuedAt || updated.createdAt,
          inviteExpiresAt: updated.inviteExpiresAt,
          personalAccountRequired: true,
          accepted: false,
          invitedAt: updated.createdAt,
        });
      }
    }
    updateCoupleEvent(editEventId, {
      primaryEmail: primaryEmail.value || undefined,
      personalAccountRequired: Boolean(primaryEmail.value) || updated.personalAccountRequired,
      collaborators,
      eventDate: editForm.eventDate || undefined,
      eventEndDate: editForm.eventEndDate || undefined,
      guestCount,
      packageId: editForm.packageId || undefined,
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
                    ? 'ml-auto bg-[#4A1942] text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}
                style={m.senderSide === 'venue' ? { backgroundColor: config.primaryColor || '#4A1942' } : undefined}
              >
                <div className={`text-[10px] font-semibold ${m.senderSide === 'venue' ? 'text-white/80' : 'text-gray-400'}`}>
                  {m.senderName} · {m.senderSide === 'venue' ? 'Venue' : 'Couple'}
                  {m.createdAt && <span className="font-normal"> · {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
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
            className="btn-primary px-4 py-2 rounded-lg bg-[#4A1942] text-white text-sm font-medium hover:bg-[#3b1435]"
            style={{ backgroundColor: config.primaryColor || '#4A1942' }}
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
      <BrandedSectionHeader
        icon="💍"
        title="Couples Portal"
        description="Create booked couples' events, review their submitted layouts in the work queue, and chat with each couple. Multi-day events (e.g. rehearsal dinner + ceremony) are supported."
        config={config}
      />

      {/* Aggregate operational summary */}
      {(() => {
        const active = events.filter((e) => e.status !== 'completed');
        const awaiting = events.filter((e) => e.layoutStatus === 'pending' || e.layoutStatus === 'changes_requested').length;
        let overnightTotal = 0;
        let overnightCap = 0;
        let setupDone = 0;
        let setupTotal = 0;
        active.forEach((ev) => {
          const st = getCoupleSetupTasks(ev.id);
          setupTotal += st.length;
          setupDone += st.filter((t) => t.status === 'done').length;
          const pkg = findWeddingPackage(ev.packageId);
          const lodging = getCoupleGuestEvents(ev.id).find((e) => e.kind === 'lodging');
          if (lodging) {
            overnightTotal += getAssignedGuestCount(ev.id, lodging.id);
            overnightCap += pkg?.maxOvernightGuests || lodging.capacity;
          }
        });
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <BrandedStatCard icon="💍" label="Active couples" value={active.length} config={config} variant="primary" />
            <BrandedStatCard icon="⏳" label="Awaiting review" value={awaiting} config={config} variant="warning" />
            <BrandedStatCard icon="🛠️" label="Setup complete" value={setupTotal > 0 ? `${Math.round((setupDone / setupTotal) * 100)}%` : '—'} config={config} variant="success" />
            <BrandedStatCard icon="🛏️" label="Overnight guests" value={`${overnightTotal}/${overnightCap}`} config={config} variant="accent" />
          </div>
        );
      })()}

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
                    className="text-xs text-[#4A1942] hover:underline"
                    style={{ color: config.primaryColor || '#4A1942' }}
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
                          ? 'bg-[#4A1942]/10 text-[#4A1942]'
                          : sl.status === 'designed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600';
                      return (
                        <div key={spaceId} className="text-xs">
                          <div className="flex items-start gap-2">
                            <span className={`shrink-0 px-2 py-0.5 rounded-full ${statusBadge}`}>
                              {sl.status}
                            </span>
                            <span className="text-gray-700">{v?.name || spaceId}</span>
                            {sl.notes && <span className="text-gray-500 truncate">— {sl.notes}</span>}
                          </div>
                          {sl.layout && v && (
                            <CoupleLayoutPreview
                              venue={v}
                              layout={sl.layout}
                              guestCount={ev.guestCount}
                              reviewPins={sl.reviewPins}
                              onAddReviewPin={(position, comment) => {
                                const newPin = {
                                  id: `pin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                                  x: position.x,
                                  y: position.y,
                                  comment,
                                  createdAt: new Date().toISOString(),
                                  authorName: user?.name || 'Venue Admin',
                                };
                                const nextPins = [...(sl.reviewPins || []), newPin];
                                updateCoupleEvent(ev.id, {
                                  spaceLayouts: {
                                    ...ev.spaceLayouts,
                                    [spaceId]: { ...sl, reviewPins: nextPins },
                                  },
                                });
                                refresh();
                              }}
                              onRemoveReviewPin={(pinId) => {
                                const nextPins = (sl.reviewPins || []).filter((p) => p.id !== pinId);
                                updateCoupleEvent(ev.id, {
                                  spaceLayouts: {
                                    ...ev.spaceLayouts,
                                    [spaceId]: { ...sl, reviewPins: nextPins },
                                  },
                                });
                                refresh();
                              }}
                            />
                          )}
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
          className="btn-primary px-4 py-2 bg-[#4A1942] text-white rounded-lg text-sm font-medium hover:bg-[#3b1435]"
          style={{ backgroundColor: config.primaryColor || '#4A1942' }}
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
          <div>
            <label htmlFor="new-couple-primary-email" className="block text-xs font-medium text-gray-600 mb-1">Primary couple email *</label>
            <input
              id="new-couple-primary-email"
              type="email"
              value={form.primaryEmail}
              onChange={(e) => setForm({ ...form, primaryEmail: e.target.value })}
              placeholder="couple@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              autoComplete="email"
            />
            <p className="mt-1 text-xs text-gray-500">This fixed address will create the primary personal account. Invite a second partner separately under People.</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Wedding package</label>
              <select
                value={form.packageId}
                onChange={(e) => setForm({ ...form, packageId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                aria-label="Wedding package"
              >
                <option value="">None (no package assigned)</option>
                {getActiveWeddingPackages().map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {form.packageId && (() => {
                const pkg = findWeddingPackage(form.packageId);
                const gc = parseInt(form.guestCount, 10);
                return (
                  <div>
                    <p className="text-xs text-gray-500 mt-1">Setup tasks will be auto-suggested from this package.</p>
                    {pkg && !Number.isNaN(gc) && gc > pkg.maxGuests && (
                      <p className="text-xs text-red-600 mt-1">
                        ⚠️ This guest count ({gc}) exceeds the package's included guests ({pkg.maxGuests}).
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Spaces available to this couple
            </label>
            <div className="flex flex-wrap gap-2">
              {venues.length === 0 ? (
                <p className="text-xs text-gray-400">No venue spaces exist yet — add them in the Venue management section first.</p>
              ) : (
                venues.map((v) => {
                  const selected = form.availableSpaces.includes(v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => toggleSpace(v.id)}
                      className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                        selected
                          ? 'font-bold shadow-sm'
                          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                      style={selected ? { borderColor: config.primaryColor || '#4A1942', backgroundColor: `color-mix(in srgb, ${config.primaryColor || '#4A1942'} 12%, transparent)`, color: config.primaryColor || '#4A1942' } : undefined}
                    >
                      {v.name}
                    </button>
                  );
                })
              )}
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
              className="btn-primary px-4 py-2 rounded-lg bg-[#4A1942] text-white text-sm font-medium hover:bg-[#3b1435]"
              style={{ backgroundColor: config.primaryColor || '#4A1942' }}
            >
              Create Event
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      {events.length > 0 && (
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search couples by name…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          aria-label="Search couples"
        />
      )}

      {/* List */}
      {(() => {
        const q = search.trim().toLowerCase();
        const filtered = q ? events.filter((ev) => ev.coupleName.toLowerCase().includes(q)) : events;
        return filtered.length === 0 && !showCreate ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-gray-500">
          <div className="text-4xl mb-3">💌</div>
          <p className="font-semibold text-gray-700">{q ? 'No matching couples' : 'No couple events yet'}</p>
          <p className="text-sm mt-1">{q ? 'Try a different name.' : 'Create a couple event to invite your first booked couple.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ev) => {
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
                      {ev.primaryEmail
                        ? <span>✉️ {ev.primaryEmail}</span>
                        : <span className="font-semibold text-amber-700">Add a primary email before inviting</span>}
                      {ev.packageId && (() => { const p = findWeddingPackage(ev.packageId); return p ? <span>🎁 {p.name}</span> : null; })()}
                      {(() => {
                        // Flag when a couple's guest count exceeds their package's included
                        // guests, so the venue can catch an overbooked event early.
                        const pkg = ev.packageId ? findWeddingPackage(ev.packageId) : undefined;
                        const limit = pkg?.maxGuests || ev.guestCount;
                        const invited = getCoupleGuests(ev.id).length || ev.guestCount || 0;
                        if (!limit || invited <= limit) return null;
                        return (
                          <span className="text-red-700 bg-red-50 rounded-full px-2 py-0.5" title="The couple has invited more guests than their package includes.">
                            ⚠️ {invited}/{limit} guests (over package cap)
                          </span>
                        );
                      })()}
                      {(() => {
                        const st = getCoupleSetupTasks(ev.id);
                        if (st.length === 0) return null;
                        const done = st.filter((t) => t.status === 'done').length;
                        return <span className="text-sky-700 bg-sky-50 rounded-full px-2 py-0.5">🛠️ {done}/{st.length} setup</span>;
                      })()}
                      {(() => {
                        // Overnight-guest count from the lodging guest event, vs package capacity.
                        const pkg = findWeddingPackage(ev.packageId);
                        const lodgingEvent = getCoupleGuestEvents(ev.id).find((e) => e.kind === 'lodging');
                        if (!lodgingEvent) return null;
                        const assigned = getAssignedGuestCount(ev.id, lodgingEvent.id);
                        const cap = pkg?.maxOvernightGuests || lodgingEvent.capacity;
                        const cls = assigned > cap ? 'text-red-700 bg-red-50' : 'text-[#4A1942] bg-[#4A1942]/10';
                        return <span className={`rounded-full px-2 py-0.5 ${cls}`}>🛏️ {assigned}/{cap} overnight</span>;
                      })()}
                      <span
                        title={ev.selectedSpaces.map((id) => venues.find((v) => v.id === id)?.name || id).join(', ') || 'None selected'}
                      >🏛️ {ev.selectedSpaces.length}/{ev.availableSpaces.length} spaces</span>
                      <span>👥 {ev.collaborators.length} people</span>
                      {(() => {
                        const guests = getCoupleGuests(ev.id);
                        const rsvps = getCoupleRsvpSubmissions(ev.id);
                        // Only count RSVPs belonging to current guests, so stale RSVPs
                        // from removed guests can't inflate the counts or drive
                        // no-reply negative.
                        const current = guests.filter((gu) => rsvps.some((r) => r.guestId === gu.id));
                        const attending = current.filter((gu) => rsvps.find((r) => r.guestId === gu.id)?.attending).length;
                        const declined = current.length - attending;
                        const noReply = guests.length - current.length;
                        return (
                          <span>
                            🎟️ {guests.length} guests · ✅ {attending} attending · ❌ {declined} · ⏳ {Math.max(0, noReply)} no reply
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => handleCopy(ev.inviteToken)} className="text-xs text-[#4A1942] hover:underline" style={{ color: config.primaryColor || '#4A1942' }}>
                      Copy invite
                    </button>
                    <button type="button" onClick={() => handleReissueCouple(ev)} className="text-xs text-amber-700 hover:underline" title="Create a new couple link while preserving planning history">
                      Reissue invite
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const invitedEmail = normalizeEmail(ev.primaryEmail, { required: true });
                        if (!invitedEmail.ok) {
                          onShowSuccess('Add a valid primary couple email before sending the account invite.');
                          return;
                        }
                        const url = portalUrl(ev.inviteToken);
                        const subject = `Your Wedding Planning Portal — ${ev.coupleName}`;
                        const body = `Hi ${ev.coupleName},\n\nWe're so excited to work with you on your wedding! Use the private link below to create your personal Wedding VIP password and access your Couples Portal, where you can design floor layouts, manage your guest list & RSVPs, view wedding packages, and chat directly with our venue team.\n\n${url}\n\nThis link is fixed to ${invitedEmail.value}. Do not forward it; invite additional people from the portal so each person has a separate account.\n\nWarm regards,\nThe Seven Paths Manor Team`;
                        window.location.href = `mailto:${encodeURIComponent(invitedEmail.value)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                        onShowSuccess(`Opened your email app with ${ev.coupleName}'s invite.`);
                      }}
                      className="text-xs text-gray-600 hover:underline"
                      title="Open default email app with pre-drafted personal account invite"
                    >
                      ✉️ Email invite
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
                      onClick={() => setOpenPkg(openPkg === ev.id ? null : ev.id)}
                      className="text-xs text-gray-600 hover:underline"
                    >
                      🎁 Package
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenSetup(openSetup === ev.id ? null : ev.id)}
                      className="text-xs text-gray-600 hover:underline"
                    >
                      🛠️ Setup & Staffing
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenItin(openItin === ev.id ? null : ev.id)}
                      className="text-xs text-gray-600 hover:underline"
                    >
                      🗓️ Itinerary
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
                      onClick={async () => {
                        const ok = await confirm({ title: 'Delete event?', message: `Delete the event for ${ev.coupleName}? This cannot be undone.`, tone: 'danger', confirmLabel: 'Delete' });
                        if (ok) {
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
                            onClick={() => handleCopy(c.inviteToken)}
                            className="text-[#4A1942] hover:underline"
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
                        <span key={d.id} className="text-xs bg-[#4A1942]/10 text-[#4A1942] rounded-full px-2 py-0.5">
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
                      {/* Per-meal catering summary for the venue */}
                      {(() => {
                        const counts = new Map<string, number>();
                        let noMeal = 0;
                        rsvps.filter((r) => r.attending).forEach((r) => {
                          if (r.mealChoice) counts.set(r.mealChoice, (counts.get(r.mealChoice) || 0) + 1);
                          else noMeal += 1;
                          if (r.plusOneName) {
                            if (r.plusOneMealChoice) counts.set(r.plusOneMealChoice, (counts.get(r.plusOneMealChoice) || 0) + 1);
                            else noMeal += 1;
                          }
                        });
                        if (noMeal > 0) counts.set('No meal selected', noMeal);
                        if (counts.size === 0) return null;
                        return (
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {Array.from(counts.entries()).map(([k, n]) => (
                              <span key={k} className="text-[11px] bg-[#4A1942]/10 text-[#4A1942] rounded-full px-2 py-0.5">
                                {k}: {n}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                      {guests.length === 0 ? (
                        <p className="text-xs text-gray-400">No guests added yet.</p>
                      ) : (
                        <div className="space-y-1 max-h-64 overflow-auto">
                          {guests.map((g) => {
                            const rsvp = rsvps.find((r) => r.guestId === g.id);
                            return (
                              <div key={g.id} className="flex flex-col gap-1 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-gray-700 truncate">
                                    {g.name}
                                    {g.tableId ? <span className="text-gray-400"> • 🪑 {g.tableId}</span> : ''}
                                    {g.roomId ? <span className="text-gray-400"> • 🛏️ {g.roomId}</span> : ''}
                                  </span>
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
                                        const email = normalizeEmail(g.email, { required: true });
                                        if (!email.ok) {
                                          onShowSuccess('Add a valid guest email before copying a personal account invite.');
                                          return;
                                        }
                                        const url = buildGuestInviteUrl(g.token!, ev.id);
                                        void navigator.clipboard?.writeText(url).then(
                                          () => onShowSuccess(`Guest account invite link copied for ${g.name}.`),
                                          () => {},
                                        );
                                      }}
                                      className="text-xs text-[#4A1942] hover:underline"
                                      style={{ color: config.primaryColor || '#4A1942' }}
                                      title="Copy guest invite link"
                                    >
                                      📋
                                    </button>
                                  )}
                                  {g.token && (
                                    <button
                                      type="button"
                                      onClick={() => handleReissueGuest(ev, g.id, g.name)}
                                      className="text-xs text-amber-700 hover:underline"
                                      title="Create a new guest link while preserving RSVP history"
                                    >
                                      Reissue
                                    </button>
                                  )}
                                </span>
                                </div>
                                {(() => {
                                  const ids = g.guestEventIds || [];
                                  if (ids.length === 0) return null;
                                  const names = ids
                                    .map((id) => getCoupleGuestEvents(ev.id).find((e) => e.id === id)?.title)
                                    .filter(Boolean);
                                  if (names.length === 0) return null;
                                  return (
                                    <div className="text-xs text-gray-400 pl-0.5 truncate" title={names.join(', ')}>
                                      Invited to: {names.join(', ')}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {openPkg === ev.id && (() => {
                  const pkg = findWeddingPackage(ev.packageId);
                  return (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-xs font-medium text-gray-500 mb-2">Package & Add-ons</div>
                      {!pkg ? (
                        <p className="text-xs text-gray-400">No package assigned. Edit the couple event to assign one.</p>
                      ) : (
                        <div className="space-y-2">
                          <div className="rounded-lg border border-gray-200 p-3">
                            <div className="text-sm font-medium text-gray-800">{pkg.name}</div>
                            <div className="text-xs text-gray-500">
                              ${pkg.price.nonPeak.toLocaleString()} / ${pkg.price.peak.toLocaleString()} / ${pkg.price.premier.toLocaleString()} (NP/P/PR) · {pkg.maxGuests} guests
                              {pkg.maxOvernightGuests > 0 ? ` · ${pkg.maxOvernightGuests} overnight` : ''}
                              {pkg.lodgingIncluded ? ' · 🛏️ lodging incl.' : ''}
                            </div>
                            {pkg.includedItems.length > 0 && (
                              <div className="mt-1 text-xs text-gray-500">{pkg.includedItems.length} included item(s)</div>
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-1">Add-ons added by couple</div>
                            {(ev.addOns || []).length === 0 ? (
                              <p className="text-xs text-gray-400">None yet.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {ev.addOns!.map((a) => {
                                  const ao = findPackageAddOn(a.addOnId);
                                  return ao ? (
                                    <span key={a.addOnId} className="text-xs bg-purple-50 text-purple-700 rounded-full px-2.5 py-1">
                                      {ao.name} · ${ao.price.toLocaleString()}{a.qty && a.qty > 1 ? ` ×${a.qty}` : ''}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {openSetup === ev.id && (() => {
                  const tasks = getCoupleSetupTasks(ev.id);
                  void setupTick;
                  const draft = setupDrafts[ev.id] || { title: '', spaceId: '', dayIndex: '', assignee: '', scheduledFor: '', notes: '' };
                  const setDraft = (p: Partial<typeof draft>) => setSetupDrafts((prev) => ({ ...prev, [ev.id]: { ...(prev[ev.id] || { title: '', spaceId: '', dayIndex: '', assignee: '', scheduledFor: '', notes: '' }), ...p } }));
                  const addTask = () => {
                    if (!draft.title.trim()) { onShowSuccess('Enter a task description.'); return; }
                    addCoupleSetupTask(ev.id, {
                      title: draft.title,
                      spaceId: draft.spaceId || undefined,
                      dayIndex: draft.dayIndex !== '' ? Number(draft.dayIndex) : undefined,
                      assignee: draft.assignee,
                      scheduledFor: draft.scheduledFor || undefined,
                      notes: draft.notes,
                    });
                    setSetupDrafts((prev) => ({ ...prev, [ev.id]: { title: '', spaceId: '', dayIndex: '', assignee: '', scheduledFor: '', notes: '' } }));
                    setSetupTick((t) => t + 1);
                    onShowSuccess('Setup task added.');
                  };
                  const doneCount = tasks.filter((t) => t.status === 'done').length;
                  return (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        Setup & Staffing ({tasks.length}) — what the venue must do before/at each space
                      </div>
                      {tasks.length > 0 && (
                        <div className="mb-2 text-xs text-gray-600">{doneCount} of {tasks.length} complete</div>
                      )}
                      <div className="rounded-lg border border-gray-200 p-3 space-y-2 mb-3">
                        <div className="text-xs font-semibold text-gray-600">Add a setup task</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input type="text" value={draft.title} onChange={(e) => setDraft({ title: e.target.value })} placeholder="Task (e.g. Move tables to reception)" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Setup task title" />
                          <select value={draft.spaceId} onChange={(e) => setDraft({ spaceId: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" aria-label="Setup task space">
                            <option value="">Space (optional)</option>
                            {venues.filter((v) => ev.availableSpaces.includes(v.id)).map((v) => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                          <select value={draft.dayIndex} onChange={(e) => setDraft({ dayIndex: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" aria-label="Setup task day">
                            <option value="">Day (optional)</option>
                            {(ev.days || []).map((d, idx) => (
                              <option key={d.id} value={idx}>{idx + 1}. {d.date}</option>
                            ))}
                          </select>
                          <input type="text" value={draft.assignee} onChange={(e) => setDraft({ assignee: e.target.value })} placeholder="Who (staff name)" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Setup assignee" />
                          <input type="datetime-local" value={draft.scheduledFor} onChange={(e) => setDraft({ scheduledFor: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Setup scheduled time" />
                          <input type="text" value={draft.notes} onChange={(e) => setDraft({ notes: e.target.value })} placeholder="Notes" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Setup notes" />
                        </div>
                        <button type="button" onClick={addTask} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700">
                          + Add task
                        </button>
                      </div>
                      {tasks.length === 0 ? (
                        <p className="text-xs text-gray-400">No setup tasks yet. Add tasks for what needs doing (moving tables/chairs, decor install) before each event/space.</p>
                      ) : (
                        <div className="space-y-2">
                          {tasks.map((t) => (
                            <div key={t.id} className="rounded-lg border border-gray-200 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className={`text-sm ${t.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{t.title}</div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {(() => { const v = venues.find((x) => x.id === t.spaceId); return v ? `🏛️ ${v.name}` : ''; })()}
                                    {t.dayIndex != null && ev.days?.[t.dayIndex] ? ` · Day ${t.dayIndex + 1} (${ev.days[t.dayIndex].date})` : ''}
                                    {t.assignee ? ` · 👤 ${t.assignee}` : ''}
                                    {t.scheduledFor ? ` · 🕒 ${new Date(t.scheduledFor).toLocaleString()}` : ''}
                                  </div>
                                  {t.notes && <div className="text-xs text-gray-600 mt-1">{t.notes}</div>}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <select
                                    value={t.status}
                                    onChange={(e) => { updateCoupleSetupTask(ev.id, t.id, { status: e.target.value as CoupleSetupStatus }); setSetupTick((x) => x + 1); }}
                                    className="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white"
                                    aria-label={`Status for ${t.title}`}
                                  >
                                    <option value="not-started">Not started</option>
                                    <option value="in-progress">In progress</option>
                                    <option value="done">Done</option>
                                  </select>
                                  <button type="button" onClick={() => { removeCoupleSetupTask(ev.id, t.id); setSetupTick((x) => x + 1); }} className="text-xs text-red-500 hover:underline" aria-label={`Remove ${t.title}`}>
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {openItin === ev.id && (() => {
                  // Ensure derived guest events exist (venue sees them even before the
                  // couple opens their portal).
                  ensureDerivedGuestEventsForCouple(ev, findWeddingPackage(ev.packageId), findPackageAddOn);
                  const events = getCoupleGuestEvents(ev.id);
                  const guests = getCoupleGuests(ev.id);
                  const rsvps = getCoupleRsvpSubmissions(ev.id);
                  const attending = rsvps.filter((r) => r.attending);
                  return (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-xs font-medium text-gray-500 mb-2">Guest events &amp; itinerary</div>
                      {events.length === 0 ? (
                        <p className="text-xs text-gray-400">No guest events yet (they derive from the assigned package + add-ons).</p>
                      ) : (
                        <div className="space-y-2">
                          {events.map((ge) => {
                            const assigned = getAssignedGuestCount(ev.id, ge.id);
                            const attendCount = attending.filter((r) => (r.attendingEvents || []).includes(ge.id)).length;
                            const over = assigned > ge.capacity;
                            const invitedNames = guests
                              .filter((g) => (g.guestEventIds || []).includes(ge.id))
                              .map((g) => g.name);
                            return (
                              <div key={ge.id} className="rounded-lg border border-gray-200 p-3">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-gray-800">{ge.title}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{GUEST_EVENT_KIND_LABELS[ge.kind]}</span>
                                  </div>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${over ? 'bg-red-100 text-red-700' : 'bg-[#4A1942]/10 text-[#4A1942]'}`}>
                                    {assigned} invited · {attendCount} attending / {ge.capacity} cap
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {ge.dayIndex != null && ev.days?.[ge.dayIndex] ? `Day ${ge.dayIndex + 1} (${ev.days[ge.dayIndex].date})` : 'All days'}
                                  {ge.startTime ? ` · ${(() => { try { return new Date(ge.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ge.startTime; } })()}` : ''}
                                  {ge.location ? ` · 📍 ${ge.location}` : ''}
                                </div>
                                {invitedNames.length > 0 && (
                                  <div className="mt-1 text-xs text-gray-500 truncate" title={invitedNames.join(', ')}>
                                    Invited: {invitedNames.join(', ')}
                                  </div>
                                )}
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
                    <div>
                      <label htmlFor={`edit-couple-email-${ev.id}`} className="block text-xs text-gray-500 mb-1">Primary couple email</label>
                      <input
                        id={`edit-couple-email-${ev.id}`}
                        type="email"
                        value={editForm.primaryEmail}
                        onChange={(e) => setEditForm({ ...editForm, primaryEmail: e.target.value })}
                        readOnly={Boolean(ev.primaryEmail)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm ${ev.primaryEmail ? 'bg-gray-100 text-gray-600' : ''}`}
                        placeholder="Required before sending a personal account invite"
                        title={ev.primaryEmail ? 'The email is fixed to this personal account invitation.' : undefined}
                        autoComplete="email"
                      />
                    </div>
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
                      <label className="block text-xs text-gray-500 mb-1">Wedding package</label>
                      <select
                        value={editForm.packageId}
                        onChange={(e) => setEditForm({ ...editForm, packageId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        aria-label="Wedding package (edit)"
                      >
                        <option value="">None (no package assigned)</option>
                        {getActiveWeddingPackages().map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Available spaces</label>
                      <div className="flex flex-wrap gap-2">
                        {venues.length === 0 ? (
                          <p className="text-xs text-gray-400">No venue spaces exist yet — add them in Venue management first.</p>
                        ) : (
                          venues.map((v) => {
                            const sel = editForm.availableSpaces.includes(v.id);
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => toggleEditSpace(v.id)}
                                className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                                  sel
                                    ? 'font-bold shadow-sm'
                                    : 'border-gray-300 bg-white text-gray-600'
                                }`}
                                style={
                                  sel
                                    ? {
                                        borderColor: config.primaryColor || '#4A1942',
                                        backgroundColor: `color-mix(in srgb, ${config.primaryColor || '#4A1942'} 12%, transparent)`,
                                        color: config.primaryColor || '#4A1942',
                                      }
                                    : undefined
                                }
                              >
                                {v.name}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        className="btn-primary px-4 py-2 rounded-lg bg-[#4A1942] text-white text-sm font-medium hover:bg-[#3b1435]"
                        style={{ backgroundColor: config.primaryColor || '#4A1942' }}
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
      );
      })()}
      {confirmDialog}
    </div>
  );
}
