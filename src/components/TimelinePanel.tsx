import { useState, useEffect, useMemo } from 'react';
import { useTimeline } from '../hooks/useTimeline';
import { TimelineEvent, TIMELINE_CATEGORIES, TimelineCategory } from '../types/timeline';
import { ConfirmDialog } from './ConfirmDialog';
import {
  getCoupleEvents,
  updateCoupleEvent,
  hasVenueCoordination,
} from '../services/couples/coupleService';
import { CoupleEvent } from '../types';
import { on } from '../utils/appEvents';
import { showToast } from './Toast';
import { useBrandingConfig } from '../config';

interface TimelinePanelProps {
  onClose: () => void;
  /** When true, renders inline (not a full-screen overlay) for dashboard embedding. */
  inline?: boolean;
}

// Format a date-only (YYYY-MM-DD) value as the intended local day, avoiding the
// UTC-midnight off-by-one when using new Date("2026-09-01") directly.
function fmtDay(dateStr: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(dateStr + 'T00:00:00') : new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
}

function portalUrl(token: string): string {
  return `${window.location.origin}${window.location.pathname}#/couples-portal?token=${encodeURIComponent(token)}`;
}

export function TimelinePanel({ onClose, inline = false }: TimelinePanelProps) {
  const config = useBrandingConfig();
  const {
    timelines,
    activeTimeline,
    activeTimelineId,
    setActiveTimelineId,
    createTimeline,
    getTimelineForCouple,
    addDay,
    removeDay,
    addEvent,
    updateEvent,
    removeEvent,
    toggleEventComplete,
    deleteTimeline,
  } = useTimeline();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newTimelineName, setNewTimelineName] = useState('');
  const [newTimelineDate, setNewTimelineDate] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [eventCategoryFilter, setEventCategoryFilter] = useState<string>('all');
  const [hideCompletedEvents, setHideCompletedEvents] = useState<boolean>(false);
  const [coupleEvents, setCoupleEvents] = useState<CoupleEvent[]>(() => getCoupleEvents());
  const [selectedCoupleId, setSelectedCoupleId] = useState<string | null>(null);
  const [showAddCoordinationConfirm, setShowAddCoordinationConfirm] = useState(false);

  useEffect(() => {
    return on('spm_data_changed', () => {
      setCoupleEvents(getCoupleEvents());
    });
  }, []);

  const selectedCouple = useMemo(() => {
    return coupleEvents.find((c) => c.id === selectedCoupleId) || null;
  }, [coupleEvents, selectedCoupleId]);

  const isCoordinationBooked = selectedCouple ? hasVenueCoordination(selectedCouple) : false;
  const canEdit = selectedCouple ? isCoordinationBooked : true;

  const existingCoupleTimeline = useMemo(() => {
    if (!selectedCouple) return null;
    return getTimelineForCouple(selectedCouple.id);
  }, [selectedCouple, getTimelineForCouple]);

  useEffect(() => {
    if (selectedCouple) {
      if (existingCoupleTimeline) {
        if (activeTimelineId !== existingCoupleTimeline.id) {
          setActiveTimelineId(existingCoupleTimeline.id);
        }
      } else {
        createTimeline(
          `${selectedCouple.coupleName} Wedding Timeline`,
          selectedCouple.eventDate || new Date().toISOString().split('T')[0],
          selectedCouple.id,
        );
      }
    }
  }, [selectedCouple, existingCoupleTimeline, activeTimelineId, createTimeline, setActiveTimelineId]);
  const [showAddEvent, setShowAddEvent] = useState<string | null>(null);
  const [showAddDay, setShowAddDay] = useState(false);
  const [newDay, setNewDay] = useState({ date: '', label: '' });
  const [newEvent, setNewEvent] = useState({
    title: '',
    startTime: '09:00',
    endTime: '10:00',
    category: 'other' as TimelineCategory,
    location: '',
    notes: '',
  });

  const [editingEvent, setEditingEvent] = useState<{ dayId: string; event: TimelineEvent } | null>(null);
  const [editEventForm, setEditEventForm] = useState({
    title: '',
    startTime: '09:00',
    endTime: '10:00',
    category: 'other' as TimelineCategory,
    location: '',
    notes: '',
  });

  const handleStartEditEvent = (dayId: string, event: TimelineEvent) => {
    setEditEventForm({
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      category: event.category,
      location: event.location || '',
      notes: event.notes || '',
    });
    setEditingEvent({ dayId, event });
  };

  const handleSaveAddDay = () => {
    if (!activeTimelineId || !newDay.date.trim() || !newDay.label.trim()) return;
    addDay(activeTimelineId, newDay.date.trim(), newDay.label.trim());
    setNewDay({ date: '', label: '' });
    setShowAddDay(false);
  };

  const handleSaveEditEvent = () => {
    if (!activeTimelineId || !editingEvent || !editEventForm.title.trim()) return;
    updateEvent(activeTimelineId, editingEvent.dayId, editingEvent.event.id, {
      title: editEventForm.title.trim(),
      startTime: editEventForm.startTime,
      endTime: editEventForm.endTime,
      category: editEventForm.category,
      location: editEventForm.location || undefined,
      notes: editEventForm.notes || undefined,
    });
    setEditingEvent(null);
  };

  const handleCreateTimeline = () => {
    if (!newTimelineName.trim() || !newTimelineDate) return;
    createTimeline(
      newTimelineName.trim(),
      newTimelineDate,
      selectedCoupleId || undefined,
    );
    setNewTimelineName('');
    setNewTimelineDate('');
    setShowCreateModal(false);
  };

  const handleAddEvent = (dayId: string) => {
    if (!activeTimelineId || !newEvent.title.trim()) return;
    
    addEvent(activeTimelineId, dayId, {
      title: newEvent.title.trim(),
      startTime: newEvent.startTime,
      endTime: newEvent.endTime,
      date: activeTimeline?.days.find(d => d.id === dayId)?.date || '',
      category: newEvent.category,
      location: newEvent.location || undefined,
      notes: newEvent.notes || undefined,
    });

    setNewEvent({
      title: '',
      startTime: '09:00',
      endTime: '10:00',
      category: 'other',
      location: '',
      notes: '',
    });
    setShowAddEvent(null);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const getCategoryInfo = (category: TimelineCategory) => {
    return TIMELINE_CATEGORIES.find(c => c.id === category) || TIMELINE_CATEGORIES[TIMELINE_CATEGORIES.length - 1];
  };

  return (
    <div className={inline ? "w-full h-full bg-white flex flex-col" : "fixed inset-0 bg-black/50 flex items-center justify-center p-4"} style={inline ? undefined : { zIndex: 10000 }}>
      <div className={inline ? "w-full h-full flex flex-col" : "w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"}>
        {/* Header */}
        <header
          className="no-print px-6 py-4 flex items-center justify-between border-b shadow-sm shrink-0 text-white"
          style={{
            background: `linear-gradient(135deg, ${config.primaryColor || '#4A1942'}, ${
              config.primaryDark || config.primaryColor || '#3d1a45'
            })`,
            borderColor: `color-mix(in srgb, ${config.primaryDark || '#3d1a45'} 40%, transparent)`,
          }}
        >
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>📅</span>
              <span>Wedding Timeline</span>
            </h1>
            <p className="text-sm text-white/80 mt-1">
              {activeTimeline ? activeTimeline.name : 'Plan your wedding day schedule'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTimeline && (
              <button
                type="button"
                onClick={() => window.print()}
                className="no-print inline-flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                title="Print timeline sheet"
              >
                <span>🖨️</span>
                <span>Print</span>
              </button>
            )}
            {!inline && (
              <button
                type="button"
                onClick={onClose}
                className="no-print inline-flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
              >
                <span>←</span>
                <span>Dashboard</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="no-print p-2 hover:bg-white/20 rounded-lg transition-colors text-xl leading-none"
              aria-label="Close timeline panel"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Couple Event Selector / Filter Bar */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <label
              htmlFor="venue-timeline-couple-select"
              className="text-xs font-bold text-gray-700 uppercase tracking-wider"
            >
              Couple Event:
            </label>
            <select
              id="venue-timeline-couple-select"
              value={selectedCoupleId || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCoupleId(val || null);
                if (!val) {
                  setActiveTimelineId(null);
                }
              }}
              aria-label="Select couple event timeline or venue templates"
              className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-gray-800 min-w-[240px]"
            >
              <option value="">📁 General / Venue Template Timelines ({timelines.filter(t => !t.coupleId).length})</option>
              <optgroup label="★ Day of Coordination Booked (Venue Managed)">
                {coupleEvents
                  .filter((c) => hasVenueCoordination(c))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      ★ {c.coupleName} ({c.eventDate || 'No date'})
                    </option>
                  ))}
              </optgroup>
              <optgroup label="🔒 Planner / Self-Managed (Read-Only to Venue)">
                {coupleEvents
                  .filter((c) => !hasVenueCoordination(c))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      🔒 {c.coupleName} ({c.eventDate || 'No date'})
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>
          {selectedCouple && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                Token: <code className="bg-gray-200 px-1 rounded">{selectedCouple.inviteToken}</code>
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {selectedCouple && isCoordinationBooked && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">💒</span>
                <div>
                  <div className="font-bold text-sm text-purple-900">
                    ★ Venue Coordination Service Booked — {selectedCouple.coupleName}
                  </div>
                  <p className="text-xs text-purple-700 mt-0.5">
                    The couple has booked Seven Paths Manor's Day of Coordination service ($1,000). You have full permission to create, edit, and manage this wedding timeline. Changes sync instantly with the Couples Portal.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => window.open(portalUrl(selectedCouple.inviteToken), '_blank')}
                className="text-xs font-bold text-purple-800 bg-purple-200 hover:bg-purple-300 px-3 py-1.5 rounded-lg transition-colors shrink-0"
              >
                Open Couples Portal →
              </button>
            </div>
          )}

          {selectedCouple && !isCoordinationBooked && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 mb-6 space-y-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5" aria-hidden="true">🔒</span>
                  <div>
                    <div className="font-bold text-sm text-amber-900">
                      Day of Coordination Not Booked — {selectedCouple.coupleName}
                    </div>
                    <p className="text-xs text-amber-800 mt-1 max-w-2xl">
                      This couple has not booked Seven Paths Manor's Day of Coordination service. By venue policy, the couple and their hired planner / day-of coordinator vendor create and manage this timeline in the Couples Portal.
                    </p>
                    <p className="text-xs text-amber-700 mt-1 font-medium">
                      You are viewing a <strong>read-only preview</strong> of the couple's schedule for venue operational prep.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowAddCoordinationConfirm(true)}
                    className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <span aria-hidden="true">＋</span>
                    <span>Add Day of Coordination ($1,000)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(portalUrl(selectedCouple.inviteToken), '_blank')}
                    className="px-3 py-2 rounded-lg border border-amber-400 bg-white hover:bg-amber-100 text-amber-900 text-xs font-bold transition-colors"
                  >
                    Open Couples Portal →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* No timeline selected */}
          {!activeTimelineId && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Timeline Selected</h3>
              <p className="text-gray-500 mb-6">Create a new timeline or select an existing one to get started.</p>
              
              <div className="flex flex-col gap-3 items-center">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary px-6 py-3 bg-[#4A1942] text-white rounded-lg font-medium hover:bg-[#3b1435] transition-colors"
                  style={{ backgroundColor: config.primaryColor || '#4A1942' }}
                >
                  ➕ Create New Timeline
                </button>

                {timelines.length > 0 && (
                  <div className="mt-6 w-full max-w-md">
                    <h4 className="text-sm font-medium text-gray-600 mb-3">Existing Timelines:</h4>
                    <div className="space-y-2">
                      {timelines.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setActiveTimelineId(t.id)}
                          className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium">{t.name}</div>
                            <div className="text-xs text-gray-500">
                              {fmtDay(t.weddingDate)} • {t.days.length} day(s)
                            </div>
                          </div>
                          <span className="text-gray-400">→</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active timeline */}
          {activeTimeline && (
            <div className="space-y-6">
              {/* Timeline header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{activeTimeline.name}</h3>
                  <p className="text-sm text-gray-500">
                    Wedding Date: {fmtDay(activeTimeline.weddingDate)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {canEdit && (
                    <button
                      onClick={() => setShowAddDay(true)}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                    >
                      ➕ Add Day
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTimelineId(null)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                  >
                    ← Back
                  </button>
                </div>
              </div>

              {(() => {
                const allEvents = activeTimeline.days.flatMap(d => d.events);
                const completedCount = allEvents.filter(e => e.isCompleted).length;
                const progressPct = allEvents.length > 0 ? Math.round((completedCount / allEvents.length) * 100) : 0;
                const hasActiveFilter = eventSearch.trim() || eventCategoryFilter !== 'all' || hideCompletedEvents;
                return (
                  <>
                    {/* KPI Stats Bar */}
                    <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-3 bg-purple-50/60 border border-purple-200 rounded-xl p-3">
                      <div className="flex flex-col">
                        <span className="text-xs text-purple-700 font-medium">Total Events</span>
                        <span className="text-lg font-bold text-purple-900">{allEvents.length} event{allEvents.length === 1 ? '' : 's'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-purple-700 font-medium">Completed</span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-purple-900">{completedCount} / {allEvents.length}</span>
                          <span className="text-xs text-purple-600 font-semibold">({progressPct}%)</span>
                        </div>
                      </div>
                      <div className="flex flex-col justify-center">
                        <div className="w-full bg-purple-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-[#4A1942] h-2.5 rounded-full transition-all duration-300"
                            style={{
                              width: `${progressPct}%`,
                              backgroundColor: config.primaryColor || '#4A1942',
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Filter Bar */}
                    {allEvents.length > 0 && (
                      <div className="no-print bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap shadow-sm">
                        <div className="flex items-center gap-2 flex-wrap flex-1">
                          <div className="relative flex-1 min-w-[180px]">
                            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400 text-xs">🔍</span>
                            <input
                              type="text"
                              value={eventSearch}
                              onChange={(e) => setEventSearch(e.target.value)}
                              placeholder="Search timeline events..."
                              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs"
                            />
                          </div>
                          <select
                            value={eventCategoryFilter}
                            onChange={(e) => setEventCategoryFilter(e.target.value)}
                            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 bg-white"
                            aria-label="Filter events by category"
                          >
                            <option value="all">All Categories ({allEvents.length})</option>
                            {TIMELINE_CATEGORIES.map((c) => {
                              const count = allEvents.filter(ev => ev.category === c.id).length;
                              if (count === 0) return null;
                              return (
                                <option key={c.id} value={c.id}>
                                  {c.icon} {c.label} ({count})
                                </option>
                              );
                            })}
                          </select>
                          <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={hideCompletedEvents}
                              onChange={(e) => setHideCompletedEvents(e.target.checked)}
                              className="rounded border-gray-300 text-[#4A1942] focus:ring-[#4A1942]"
                              style={{ accentColor: config.primaryColor || '#4A1942' }}
                            />
                            <span>Show incomplete only</span>
                          </label>
                        </div>
                        {hasActiveFilter && (
                          <button
                            type="button"
                            onClick={() => { setEventSearch(''); setEventCategoryFilter('all'); setHideCompletedEvents(false); }}
                            className="text-xs text-[#4A1942] hover:underline font-semibold whitespace-nowrap"
                            style={{ color: config.primaryColor || '#4A1942' }}
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Days */}
              {activeTimeline.days.map(day => (
                <div key={day.id} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-gray-800">{day.label}</h4>
                      <p className="text-sm text-gray-500">
                        {fmtDay(day.date)}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowAddEvent(day.id)}
                          className="btn-primary px-3 py-1.5 bg-[#4A1942] text-white rounded-lg text-sm hover:bg-[#3b1435] transition-colors"
                          style={{ backgroundColor: config.primaryColor || '#4A1942' }}
                        >
                          + Add Event
                        </button>
                        {activeTimeline.days.length > 1 && (
                          <button
                            onClick={() => activeTimelineId && removeDay(activeTimelineId, day.id)}
                            className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200 transition-colors"
                            title="Remove day"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Add event form */}
                  {showAddEvent === day.id && (
                    <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Event Title</label>
                          <input
                            type="text"
                            value={newEvent.title}
                            onChange={e => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="e.g., Hair & Makeup"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Start Time</label>
                          <input
                            type="time"
                            value={newEvent.startTime}
                            onChange={e => setNewEvent(prev => ({ ...prev, startTime: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">End Time</label>
                          <input
                            type="time"
                            value={newEvent.endTime}
                            onChange={e => setNewEvent(prev => ({ ...prev, endTime: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                          <select
                            value={newEvent.category}
                            onChange={e => setNewEvent(prev => ({ ...prev, category: e.target.value as TimelineCategory }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            {TIMELINE_CATEGORIES.map(cat => (
                              <option key={cat.id} value={cat.id}>
                                {cat.icon} {cat.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                          <input
                            type="text"
                            value={newEvent.location}
                            onChange={e => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                            placeholder="Optional"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setShowAddEvent(null)}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleAddEvent(day.id)}
                          disabled={!newEvent.title.trim()}
                          className="btn-primary px-4 py-2 bg-[#4A1942] text-white rounded-lg text-sm hover:bg-[#3b1435] disabled:opacity-50"
                          style={{ backgroundColor: config.primaryColor || '#4A1942' }}
                        >
                          Add Event
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Events list */}
                  {(() => {
                    const filteredEvents = day.events.filter((event) => {
                      if (eventCategoryFilter !== 'all' && event.category !== eventCategoryFilter) return false;
                      if (hideCompletedEvents && event.isCompleted) return false;
                      if (eventSearch.trim()) {
                        const q = eventSearch.trim().toLowerCase();
                        const matchTitle = event.title.toLowerCase().includes(q);
                        const matchLoc = (event.location || '').toLowerCase().includes(q);
                        const matchCat = (getCategoryInfo(event.category).label || '').toLowerCase().includes(q);
                        if (!matchTitle && !matchLoc && !matchCat) return false;
                      }
                      return true;
                    });
                    const hasActiveFilter = eventSearch.trim() || eventCategoryFilter !== 'all' || hideCompletedEvents;
                    if (day.events.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-400">
                          <p>No events scheduled for this day</p>
                        </div>
                      );
                    }
                    if (filteredEvents.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-400 space-y-2">
                          <p>No events match your search/filter ({day.events.length} event{day.events.length === 1 ? '' : 's'} hidden)</p>
                          {hasActiveFilter && (
                            <button
                              type="button"
                              onClick={() => { setEventSearch(''); setEventCategoryFilter('all'); setHideCompletedEvents(false); }}
                              className="text-xs text-[#4A1942] hover:underline font-semibold"
                              style={{ color: config.primaryColor || '#4A1942' }}
                            >
                              Clear filters
                            </button>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        {filteredEvents.map(event => {
                          const categoryInfo = getCategoryInfo(event.category);
                          return (
                            <div
                              key={event.id}
                              className={`flex items-center gap-3 p-3 bg-white rounded-lg border-l-4 transition-all ${
                                event.isCompleted ? 'opacity-60' : ''
                              }`}
                              style={{ borderLeftColor: categoryInfo.color }}
                            >
                              <button
                                onClick={() => canEdit && activeTimelineId && toggleEventComplete(activeTimelineId, day.id, event.id)}
                                disabled={!canEdit}
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                  event.isCompleted
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : 'border-gray-300 hover:border-green-400'
                                } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {event.isCompleted && '✓'}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{categoryInfo.icon}</span>
                                  <span className={`font-medium ${event.isCompleted ? 'line-through text-gray-400' : ''}`}>
                                    {event.title}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                  <span>🕐 {formatTime(event.startTime)} - {formatTime(event.endTime)}</span>
                                  {event.location && <span>📍 {event.location}</span>}
                                </div>
                              </div>
                              {canEdit && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleStartEditEvent(day.id, event)}
                                    className="p-1.5 text-gray-400 hover:text-[#4A1942] hover:bg-gray-100 rounded transition-colors"
                                    title="Edit event"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => activeTimelineId && removeEvent(activeTimelineId, day.id, event.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                    title="Delete event"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              ))}

              {/* Delete timeline */}
              {canEdit && (
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    🗑️ Delete this timeline
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create Timeline Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 10001 }}>
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-lg font-semibold mb-4">Create New Timeline</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timeline Name</label>
                  <input
                    type="text"
                    value={newTimelineName}
                    onChange={e => setNewTimelineName(e.target.value)}
                    placeholder="e.g., Sarah & John's Wedding"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wedding Date</label>
                  <input
                    type="date"
                    value={newTimelineDate}
                    onChange={e => setNewTimelineDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTimeline}
                  disabled={!newTimelineName.trim() || !newTimelineDate}
                  className="btn-primary flex-1 px-4 py-2 bg-[#4A1942] text-white rounded-lg hover:bg-[#3b1435] disabled:opacity-50"
                  style={{ backgroundColor: config.primaryColor || '#4A1942' }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Event modal */}
        {editingEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditingEvent(null)}>
            <div
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">✏️ Edit Event</h3>
                <button onClick={() => setEditingEvent(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label="Close">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Title *</label>
                  <input
                    type="text"
                    value={editEventForm.title}
                    onChange={e => setEditEventForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                    <input type="time" value={editEventForm.startTime} onChange={e => setEditEventForm(prev => ({ ...prev, startTime: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
                    <input type="time" value={editEventForm.endTime} onChange={e => setEditEventForm(prev => ({ ...prev, endTime: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={editEventForm.category} onChange={e => setEditEventForm(prev => ({ ...prev, category: e.target.value as TimelineCategory }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    {TIMELINE_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input type="text" value={editEventForm.location} onChange={e => setEditEventForm(prev => ({ ...prev, location: e.target.value }))} placeholder="Optional" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={editEventForm.notes} onChange={e => setEditEventForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Optional notes..." rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={handleSaveEditEvent} disabled={!editEventForm.title.trim()} className="btn-primary flex-1 py-2.5 bg-[#4A1942] text-white rounded-lg font-medium hover:bg-[#3b1435] disabled:opacity-50 transition-colors" style={{ backgroundColor: config.primaryColor || '#4A1942' }}>
                    Save Changes
                  </button>
                  <button onClick={() => setEditingEvent(null)} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Day modal (replaces the two sequential native prompt() dialogs) */}
        {showAddDay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAddDay(false)}>
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">➕ Add Day</h3>
                <button onClick={() => setShowAddDay(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label="Close">✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={newDay.date}
                    onChange={(e) => setNewDay((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day Label *</label>
                  <input
                    type="text"
                    value={newDay.label}
                    onChange={(e) => setNewDay((prev) => ({ ...prev, label: e.target.value }))}
                    placeholder="e.g., Day Before"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={handleSaveAddDay} disabled={!newDay.date.trim() || !newDay.label.trim()} className="btn-primary flex-1 py-2.5 bg-[#4A1942] text-white rounded-lg font-medium hover:bg-[#3b1435] disabled:opacity-50 transition-colors" style={{ backgroundColor: config.primaryColor || '#4A1942' }}>
                    Add Day
                  </button>
                  <button onClick={() => setShowAddDay(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={showDeleteConfirm}
          title="Delete timeline"
          message={`Delete "${activeTimeline?.name ?? 'this timeline'}" and all of its events? This cannot be undone.`}
          confirmLabel="Delete"
          tone="danger"
          onConfirm={() => {
            if (activeTimelineId) deleteTimeline(activeTimelineId);
            setShowDeleteConfirm(false);
            setActiveTimelineId(null);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />

        <ConfirmDialog
          open={showAddCoordinationConfirm}
          title="Add Day of Coordination Service?"
          message={`Add the Day of Coordination service ($1,000) to ${selectedCouple?.coupleName}'s booking? This will immediately unlock collaborative timeline editing for the venue team and sync with the Couples Portal.`}
          confirmLabel="Add Coordination & Unlock"
          tone="default"
          onConfirm={() => {
            if (!selectedCouple) return;
            updateCoupleEvent(selectedCouple.id, {
              venueCoordinationBooked: true,
            });
            setCoupleEvents(getCoupleEvents());
            setShowAddCoordinationConfirm(false);
            showToast(
              `Day of Coordination service added for ${selectedCouple.coupleName}. Timeline editing unlocked.`,
              'success',
            );
          }}
          onCancel={() => setShowAddCoordinationConfirm(false)}
        />
      </div>
    </div>
  );
}

export default TimelinePanel;