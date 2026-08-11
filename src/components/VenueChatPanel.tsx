// @ts-nocheck
import React, { useState, useMemo, useEffect } from 'react';
import { getCoupleEvents } from '../services/couples/coupleService';
import {
  getCoupleMessages,
  sendCoupleMessage,
  markCoupleChatRead,
  getUnreadCoupleMessageCounts,
} from '../services/couples/coupleChatService';
import { DirectMessagePanel } from './DirectMessagePanel';
import { on, emitDataChanged } from '../utils/appEvents';
import { getConfig, useBrandingConfig } from '../config';
import { showToast } from './Toast';
import type { CoupleEvent, User } from '../types';

interface VenueChatPanelProps {
  user: User;
  isAdmin: boolean;
  onClose?: () => void;
  inline?: boolean;
  users?: User[];
}

const QUICK_REPLIES = [
  {
    label: '✨ Layout Approved',
    text: "Hi! We've reviewed and approved your floor plan and seating layout for your wedding day. Everything looks fantastic!",
  },
  {
    label: '⏱️ Timeline Check-in',
    text: 'Hi! Just checking in on your wedding day timeline. Let us know if you need any help coordinating vendor setup times.',
  },
  {
    label: '📋 Final Headcount Reminder',
    text: 'Reminder: Please confirm your final guest headcount and RSVP meal choices 14 days before your event.',
  },
  {
    label: '👋 Welcome & Next Steps',
    text: "Welcome to your Seven Paths Manor Couples Portal! We're here to help you design your dream space. Feel free to message us here anytime.",
  },
];

export function VenueChatPanel({
  user,
  isAdmin,
  onClose,
  inline = false,
  users = [],
}: VenueChatPanelProps) {
  const config = useBrandingConfig();
  const [coupleEvents, setCoupleEvents] = useState<CoupleEvent[]>(() => getCoupleEvents());
  const [activeTab, setActiveTab] = useState<'couples' | 'team'>('couples');
  const [selectedCoupleId, setSelectedCoupleId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [threadSearch, setThreadSearch] = useState('');
  const [threadFilter, setThreadFilter] = useState<'all' | 'unread' | 'approved' | 'pending'>('all');
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  // Internal Team DMs state
  const [selectedMasterUserId, setSelectedMasterUserId] = useState<string>('');

  const masterUsers = useMemo(() => {
    return (users || []).filter(
      (u) => u.role === 'basic' && (u.userRole === 'master' || u.isMasterUser)
    );
  }, [users]);

  useEffect(() => {
    return on('spm_data_changed', () => {
      setCoupleEvents(getCoupleEvents());
    });
  }, []);

  const unreadCounts = useMemo(() => {
    const ids = coupleEvents.map((c) => c.id);
    return getUnreadCoupleMessageCounts(ids, 'venue');
  }, [coupleEvents]);

  const totalUnreadCouples = useMemo(() => {
    return Object.values(unreadCounts).reduce((sum, n) => sum + (n || 0), 0);
  }, [unreadCounts]);

  // Set default selected couple
  useEffect(() => {
    if (!selectedCoupleId && coupleEvents.length > 0) {
      // Prefer couple with unread messages first
      const firstUnread = coupleEvents.find((c) => (unreadCounts[c.id] || 0) > 0);
      setSelectedCoupleId(firstUnread ? firstUnread.id : coupleEvents[0].id);
    }
  }, [coupleEvents, selectedCoupleId, unreadCounts]);

  // Filtered couples in the left thread list
  const filteredCouples = useMemo(() => {
    return coupleEvents.filter((c) => {
      if (threadFilter === 'unread' && !(unreadCounts[c.id] > 0)) return false;
      if (threadFilter === 'approved' && c.layoutStatus !== 'approved') return false;
      if (
        threadFilter === 'pending' &&
        c.layoutStatus !== 'pending' &&
        c.layoutStatus !== 'changes_requested'
      )
        return false;

      if (threadSearch.trim()) {
        const q = threadSearch.trim().toLowerCase();
        const nameMatch = c.coupleName.toLowerCase().includes(q);
        const dateMatch = (c.eventDate || '').includes(q);
        if (!nameMatch && !dateMatch) return false;
      }
      return true;
    });
  }, [coupleEvents, threadFilter, threadSearch, unreadCounts]);

  const selectedCouple = useMemo(() => {
    return coupleEvents.find((c) => c.id === selectedCoupleId) || null;
  }, [coupleEvents, selectedCoupleId]);

  const coupleMessages = useMemo(() => {
    if (!selectedCoupleId) return [];
    return getCoupleMessages(selectedCoupleId);
  }, [selectedCoupleId, coupleEvents]);

  const handleSelectCouple = (id: string) => {
    setSelectedCoupleId(id);
    markCoupleChatRead(id, 'venue');
    emitDataChanged('couple-chat');
  };

  const handleSendCoupleMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCouple || !messageText.trim()) return;
    sendCoupleMessage({
      coupleEventId: selectedCouple.id,
      senderId: user.id,
      senderName: user.name || 'Venue Coordinator',
      senderSide: 'venue',
      message: messageText.trim(),
    });
    setMessageText('');
    setShowQuickReplies(false);
    emitDataChanged('couple-chat');
  };

  const openPortalUrl = (token?: string) => {
    if (!token) return;
    const url = `${window.location.origin}${window.location.pathname}#/couples-portal?token=${token}`;
    window.open(url, '_blank');
  };

  return (
    <div
      className={
        inline
          ? 'w-full h-full bg-white flex flex-col'
          : 'fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50'
      }
    >
      <div
        className={
          inline
            ? 'w-full h-full flex flex-col overflow-hidden'
            : 'w-full max-w-6xl max-h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden'
        }
      >
        {/* Top Header */}
        <header
          className="no-print px-6 py-5 flex items-center justify-between shadow-md rounded-2xl mb-5 text-white shrink-0"
          style={{
            background: `linear-gradient(135deg, ${config.primaryColor || '#4A1942'}, ${config.primaryDark || '#3d1a45'})`,
            borderLeft: `6px solid color-mix(in srgb, ${config.primaryLight || '#6b2c5c'} 80%, white)`,
          }}
        >
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>💬</span>
              <span>Portal Chat &amp; Direct Messages</span>
            </h1>
            <p className="text-sm text-white/80 mt-1">
              Centralized communication tied to each couple, event, and internal venue staff
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onClose && (
              <>
                {!inline && (
                  <>
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                    >
                      <span>←</span>
                      <span>Dashboard Home</span>
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="p-2 hover:bg-white/20 rounded-lg transition-colors text-xl leading-none text-white"
                      aria-label="Close chat panel"
                    >
                      ✕
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-2.5 flex items-center justify-between gap-3 flex-wrap shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('couples')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
                activeTab === 'couples'
                  ? 'text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
              style={activeTab === 'couples' ? { backgroundColor: config.primaryColor || '#4A1942' } : undefined}
            >
              <span>💍</span>
              <span>Couples Portal Chat ({coupleEvents.length})</span>
              {totalUnreadCouples > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
                  {totalUnreadCouples}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
                activeTab === 'team'
                  ? 'text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
              style={activeTab === 'team' ? { backgroundColor: config.primaryColor || '#4A1942' } : undefined}
            >
              <span>👥</span>
              <span>Internal Team DMs ({masterUsers.length})</span>
            </button>
          </div>
          <div className="text-xs text-gray-500">
            {activeTab === 'couples'
              ? 'Real-time thread synced with Couples Portal'
              : 'Admin ↔ Master Basic User communications'}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'couples' ? (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Left Thread List */}
            <aside className="w-80 shrink-0 border-r border-gray-200 bg-gray-50/50 flex flex-col">
              {/* Filter & Search Bar */}
              <div className="p-3 border-b border-gray-200 bg-white space-y-2">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400 text-xs">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={threadSearch}
                    onChange={(e) => setThreadSearch(e.target.value)}
                    placeholder="Search couples or dates..."
                    className="w-full pl-7 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-[#4A1942]"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={threadFilter}
                    onChange={(e: any) => setThreadFilter(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-700"
                    aria-label="Filter couple conversations"
                  >
                    <option value="all">All Couples ({coupleEvents.length})</option>
                    <option value="unread">Unread Only ({totalUnreadCouples})</option>
                    <option value="approved">Approved Layouts</option>
                    <option value="pending">Pending Approval</option>
                  </select>
                </div>
              </div>

              {/* Thread Items List */}
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                {filteredCouples.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-xs">
                    No couples match your search or filter.
                  </div>
                ) : (
                  filteredCouples.map((c) => {
                    const unread = unreadCounts[c.id] || 0;
                    const isSelected = c.id === selectedCoupleId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCouple(c.id)}
                        className={`w-full p-3.5 text-left transition-colors flex flex-col gap-1.5 ${
                          isSelected
                            ? 'bg-purple-100/70 border-l-4 border-[#4A1942]'
                            : 'hover:bg-white bg-transparent'
                        }`}
                        style={
                          isSelected
                            ? { borderLeftColor: config.primaryColor || '#4A1942' }
                            : undefined
                        }
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-sm text-gray-900 truncate">
                            {c.coupleName}
                          </span>
                          {unread > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black shrink-0">
                              {unread} new
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>📅 {c.eventDate ? new Date(c.eventDate).toLocaleDateString() : 'No date'}</span>
                          <span>{c.guestCount || 0} guests</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              c.layoutStatus === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : c.layoutStatus === 'pending' || c.layoutStatus === 'changes_requested'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {c.layoutStatus}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Right Active Conversation Pane */}
            <main className="flex-1 flex flex-col min-w-0 bg-white">
              {selectedCouple ? (
                <>
                  {/* Couple Event Banner */}
                  <div className="px-6 py-3.5 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
                        style={{ backgroundColor: config.primaryColor || '#4A1942' }}
                      >
                        {selectedCouple.coupleName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-gray-900">
                            {selectedCouple.coupleName}
                          </h2>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              selectedCouple.layoutStatus === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {selectedCouple.layoutStatus}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                          <span>
                            📅 {selectedCouple.eventDate ? new Date(selectedCouple.eventDate).toLocaleDateString() : 'No date'}
                          </span>
                          <span>👥 {selectedCouple.guestCount || 0} guests</span>
                          <span>🔑 Token: <code>{selectedCouple.inviteToken}</code></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openPortalUrl(selectedCouple.inviteToken)}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-xs font-semibold text-gray-700 transition-colors shadow-sm"
                      >
                        💍 Open Couples Portal ↗
                      </button>
                      {(unreadCounts[selectedCouple.id] || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            markCoupleChatRead(selectedCouple.id, 'venue');
                            emitDataChanged('couple-chat');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                        >
                          ✓ Mark Read
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Messages Stream */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
                    {coupleMessages.length === 0 ? (
                      <div className="py-12 text-center text-gray-400 space-y-2">
                        <div className="text-4xl">💬</div>
                        <p className="text-sm font-semibold text-gray-600">
                          No messages yet with {selectedCouple.coupleName}.
                        </p>
                        <p className="text-xs text-gray-500">
                          Start the conversation below or select a quick reply template!
                        </p>
                      </div>
                    ) : (
                      coupleMessages.map((msg) => {
                        const isVenue = msg.senderSide === 'venue';
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${
                              isVenue ? 'items-end' : 'items-start'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1 px-1">
                              <span
                                className={`text-[11px] font-bold ${
                                  isVenue ? 'text-purple-900' : 'text-rose-900'
                                }`}
                              >
                                {msg.senderName}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                  isVenue
                                    ? 'bg-purple-200 text-purple-900'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {isVenue ? 'Venue Team' : 'Couple / Planner'}
                              </span>
                            </div>
                            <div
                              className={`max-w-xl rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                isVenue
                                  ? 'bg-[#4A1942] text-white rounded-br-none'
                                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                              }`}
                              style={
                                isVenue
                                  ? { backgroundColor: config.primaryColor || '#4A1942' }
                                  : undefined
                              }
                            >
                              <p className="whitespace-pre-wrap leading-relaxed">
                                {msg.message}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Message Composer & Quick Replies */}
                  <div className="p-4 border-t border-gray-200 bg-white space-y-2">
                    {/* Quick Reply Bar */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                          ⚡ Quick Replies:
                        </span>
                        {QUICK_REPLIES.map((rep, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setMessageText(rep.text);
                              showToast(`Loaded "${rep.label}" template`, 'info');
                            }}
                            className="px-2.5 py-1 rounded-full border border-purple-200 bg-purple-50/80 hover:bg-purple-100 text-purple-900 text-xs font-medium transition-colors"
                          >
                            {rep.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <form onSubmit={handleSendCoupleMessage} className="flex gap-2">
                      <textarea
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder={`Message ${selectedCouple.coupleName} (synced instantly with Couples Portal)...`}
                        rows={2}
                        className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#4A1942] focus:border-transparent resize-none"
                      />
                      <button
                        type="submit"
                        disabled={!messageText.trim()}
                        className="px-6 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm transition-all disabled:opacity-40 self-end shrink-0"
                        style={{
                          backgroundColor: config.primaryColor || '#4A1942',
                        }}
                      >
                        Send →
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-400">
                  <div>
                    <div className="text-5xl mb-3">💍</div>
                    <h3 className="text-base font-bold text-gray-700">
                      No Couple Selected
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Select a couple from the list on the left to start messaging.
                    </p>
                  </div>
                </div>
              )}
            </main>
          </div>
        ) : (
          /* Internal Team DMs Tab */
          <div className="flex-1 flex flex-col min-h-0 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap bg-purple-50 border border-purple-200 p-4 rounded-xl">
                <div>
                  <h3 className="text-base font-bold text-purple-900">
                    👥 Internal Venue Team &amp; Master User DMs
                  </h3>
                  <p className="text-xs text-purple-700 mt-0.5">
                    Communicate with internal operational staff and master basic users by department/event.
                  </p>
                </div>
                {masterUsers.length > 0 && (
                  <select
                    value={selectedMasterUserId || masterUsers[0]?.id || ''}
                    onChange={(e) => setSelectedMasterUserId(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold bg-white text-gray-800"
                    aria-label="Select master basic user thread"
                  >
                    {masterUsers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.eventName || m.department || 'General Event'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {masterUsers.length > 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  {(() => {
                    const selUser =
                      masterUsers.find((u) => u.id === selectedMasterUserId) ||
                      masterUsers[0];
                    const eventName = selUser.eventName || selUser.department || 'general';
                    const threadId = `dm_admin_${selUser.id}_${eventName}`;
                    return (
                      <DirectMessagePanel
                        title={`Internal DM with ${selUser.name}`}
                        threadId={threadId}
                        currentUserId={user.id}
                        currentUserName={user.name}
                        currentUserRole="admin"
                      />
                    );
                  })()}
                </div>
              ) : (
                <div className="p-8 text-center bg-gray-50 border border-dashed border-gray-300 rounded-xl text-gray-500 text-sm">
                  No internal master basic users available yet. Create a Basic User in User Management with User Role set to Master.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default VenueChatPanel;
