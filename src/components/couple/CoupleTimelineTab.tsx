import React, { useState, useEffect } from 'react';
import { CoupleEvent } from '../../types';
import { TIMELINE_CATEGORIES, TimelineCategory, TimelineEvent } from '../../types/timeline';
import { useTimeline } from '../../hooks/useTimeline';
import { hasVenueCoordination } from '../../services/couples/coupleService';
import { useBrandingConfig } from '../../config';

interface Props {
  event: CoupleEvent;
  canEdit?: boolean;
  onNavigateToPackage?: () => void;
}

export const CoupleTimelineTab: React.FC<Props> = ({
  event,
  canEdit = true,
  onNavigateToPackage,
}) => {
  const config = useBrandingConfig();
  const {
    getTimelineForCouple,
    createTimeline,
    addDay,
    removeDay,
    addEvent,
    updateEvent,
    removeEvent,
    toggleEventComplete,
  } = useTimeline();

  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [showAddDay, setShowAddDay] = useState(false);
  const [newDayLabel, setNewDayLabel] = useState('');
  const [newDayDate, setNewDayDate] = useState('');

  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState<{
    title: string;
    startTime: string;
    endTime: string;
    category: TimelineCategory;
    location: string;
    notes: string;
  }>({
    title: '',
    startTime: '10:00',
    endTime: '11:00',
    category: 'ceremony',
    location: '',
    notes: '',
  });

  const existingTimeline = getTimelineForCouple(event.id);

  useEffect(() => {
    if (!existingTimeline) {
      createTimeline(
        `${event.coupleName} Wedding Timeline`,
        event.eventDate || new Date().toISOString().split('T')[0],
        event.id,
      );
    }
  }, [existingTimeline, event.id, event.coupleName, event.eventDate, createTimeline]);

  const timeline = existingTimeline;
  const coordinationBooked = hasVenueCoordination(event);

  // Set default active day
  useEffect(() => {
    if (timeline && timeline.days.length > 0 && !activeDayId) {
      setActiveDayId(timeline.days[0].id);
    }
  }, [timeline, activeDayId]);

  const activeDay = timeline?.days.find((d) => d.id === activeDayId) || timeline?.days[0] || null;

  const handleCreateDay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!timeline || !newDayLabel.trim() || !canEdit) return;
    const dateToUse = newDayDate || event.eventDate || new Date().toISOString().split('T')[0];
    const created = addDay(timeline.id, dateToUse, newDayLabel.trim());
    setNewDayLabel('');
    setNewDayDate('');
    setShowAddDay(false);
    setActiveDayId(created.id);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!timeline || !activeDay || !eventForm.title.trim() || !canEdit) return;

    if (editingEventId) {
      updateEvent(timeline.id, activeDay.id, editingEventId, {
        title: eventForm.title.trim(),
        startTime: eventForm.startTime,
        endTime: eventForm.endTime,
        category: eventForm.category,
        location: eventForm.location || undefined,
        notes: eventForm.notes || undefined,
      });
      setEditingEventId(null);
    } else {
      addEvent(timeline.id, activeDay.id, {
        title: eventForm.title.trim(),
        startTime: eventForm.startTime,
        endTime: eventForm.endTime,
        date: activeDay.date,
        category: eventForm.category,
        location: eventForm.location || undefined,
        notes: eventForm.notes || undefined,
      });
      setShowAddEvent(false);
    }

    setEventForm({
      title: '',
      startTime: '10:00',
      endTime: '11:00',
      category: 'ceremony',
      location: '',
      notes: '',
    });
  };

  const startEditing = (ev: TimelineEvent) => {
    setEditingEventId(ev.id);
    setEventForm({
      title: ev.title,
      startTime: ev.startTime,
      endTime: ev.endTime,
      category: ev.category,
      location: ev.location || '',
      notes: ev.notes || '',
    });
    setShowAddEvent(true);
  };

  const getCategoryMeta = (cat: TimelineCategory) => {
    return (
      TIMELINE_CATEGORIES.find((c) => c.id === cat) || {
        id: cat,
        label: cat,
        icon: '📋',
        color: '#808080',
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between bg-white px-5 py-4 rounded-xl border border-gray-200 shadow-sm flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {event.coupleName} — Wedding Timeline
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Event Date: {event.eventDate || 'TBD'} • {timeline?.days.length || 0} event day(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <span>🖨️</span>
            <span>Print Timeline</span>
          </button>
        </div>
      </div>

      {/* Coordination Service / Planner Banner */}
      {coordinationBooked ? (
        <div
          className="rounded-xl border p-4 flex items-center justify-between gap-3 flex-wrap"
          style={{
            backgroundColor: `color-mix(in srgb, ${config.primaryColor || '#4A1942'} 6%, transparent)`,
            borderColor: `color-mix(in srgb, ${config.primaryColor || '#4A1942'} 20%, transparent)`,
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">💒</span>
            <div>
              <div
                className="text-sm font-bold"
                style={{ color: config.primaryDark || '#3d1a45' }}
              >
                ★ Venue Coordinated Event
              </div>
              <p
                className="text-xs mt-0.5"
                style={{ color: config.primaryColor || '#4A1942' }}
              >
                You have booked Seven Paths Manor's Day of Coordination service ($1,000). Your venue coordination team is actively collaborating with you on this timeline.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">📋</span>
            <div>
              <div className="text-sm font-bold text-amber-900">
                Self-Managed / Planner Timeline
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                You can build and manage your wedding timeline here with your hired planner or day-of coordinator. (Need Seven Paths Manor to coordinate your wedding day? Add Day of Coordination in Packages &amp; Add-ons.)
              </p>
            </div>
          </div>
          {onNavigateToPackage && (
            <button
              type="button"
              onClick={onNavigateToPackage}
              className="text-xs font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 px-3 py-1.5 rounded-lg shrink-0 transition-colors"
            >
              View Packages &amp; Add-ons →
            </button>
          )}
        </div>
      )}

      {/* Day Switcher & Actions */}
      {timeline && (
        <div className="flex items-center justify-between border-b border-gray-200 pb-2 flex-wrap gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {timeline.days.map((day) => {
              const isActive = activeDay?.id === day.id;
              return (
                <div key={day.id} className="inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => setActiveDayId(day.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                      isActive
                        ? 'btn-primary bg-[#4A1942] text-white shadow-sm'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                    style={isActive ? { backgroundColor: config.primaryColor || '#4A1942' } : undefined}
                  >
                    <span>{day.label}</span>
                    <span className="ml-1.5 opacity-80">({day.events.length})</span>
                  </button>
                  {canEdit && timeline.days.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDay(timeline.id, day.id)}
                      className="ml-1 text-gray-400 hover:text-red-600 text-xs px-1"
                      title="Remove day"
                      aria-label={`Remove day ${day.label}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}

            {canEdit && !showAddDay && (
              <button
                type="button"
                onClick={() => setShowAddDay(true)}
                className="px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-600 text-xs font-semibold hover:border-[#4A1942] hover:text-[#4A1942] transition-colors"
              >
                ＋ Add Day
              </button>
            )}
          </div>

          {canEdit && activeDay && !showAddEvent && (
            <button
              type="button"
              onClick={() => {
                setEditingEventId(null);
                setEventForm({
                  title: '',
                  startTime: '10:00',
                  endTime: '11:00',
                  category: 'ceremony',
                  location: '',
                  notes: '',
                });
                setShowAddEvent(true);
              }}
              className="btn-primary px-4 py-2 rounded-lg bg-[#4A1942] text-white text-xs font-bold shadow-sm hover:bg-[#3d1536] transition-colors"
              style={{ backgroundColor: config.primaryColor || '#4A1942' }}
            >
              ＋ Add Timeline Event
            </button>
          )}
        </div>
      )}

      {/* Add Day Inline Form */}
      {showAddDay && (
        <form
          onSubmit={handleCreateDay}
          className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-end gap-3 flex-wrap"
        >
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Day Label
            </label>
            <input
              type="text"
              value={newDayLabel}
              onChange={(e) => setNewDayLabel(e.target.value)}
              placeholder="e.g. Rehearsal Dinner"
              className="text-xs border rounded-lg px-2.5 py-1.5 bg-white w-48"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={newDayDate}
              onChange={(e) => setNewDayDate(e.target.value)}
              className="text-xs border rounded-lg px-2.5 py-1.5 bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="btn-primary px-3 py-1.5 bg-[#4A1942] text-white rounded-lg text-xs font-bold"
              style={{ backgroundColor: config.primaryColor || '#4A1942' }}
            >
              Save Day
            </button>
            <button
              type="button"
              onClick={() => setShowAddDay(false)}
              className="px-3 py-1.5 border rounded-lg text-xs font-bold bg-white"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Add / Edit Event Inline Modal */}
      {showAddEvent && activeDay && (
        <form
          onSubmit={handleSaveEvent}
          className="bg-white border-2 border-[#4A1942]/20 rounded-xl p-5 shadow-md space-y-4"
        >
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-bold text-sm text-gray-900">
              {editingEventId ? 'Edit Timeline Event' : 'Add Timeline Event'} — {activeDay.label}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowAddEvent(false);
                setEditingEventId(null);
              }}
              className="text-gray-400 hover:text-gray-600 font-bold"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Event Title *
              </label>
              <input
                type="text"
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                placeholder="e.g. Ceremony Begins"
                className="w-full text-xs border rounded-lg px-2.5 py-1.5"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Category
              </label>
              <select
                value={eventForm.category}
                onChange={(e) =>
                  setEventForm({ ...eventForm, category: e.target.value as TimelineCategory })
                }
                className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
              >
                {TIMELINE_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Location (optional)
              </label>
              <input
                type="text"
                value={eventForm.location}
                onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                placeholder="e.g. Grove Chapel"
                className="w-full text-xs border rounded-lg px-2.5 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={eventForm.startTime}
                onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })}
                className="w-full text-xs border rounded-lg px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                value={eventForm.endTime}
                onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })}
                className="w-full text-xs border rounded-lg px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Notes (optional)
              </label>
              <input
                type="text"
                value={eventForm.notes}
                onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
                placeholder="Vendor or setup notes..."
                className="w-full text-xs border rounded-lg px-2.5 py-1.5"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => {
                setShowAddEvent(false);
                setEditingEventId(null);
              }}
              className="px-3 py-1.5 border rounded-lg text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary px-4 py-1.5 bg-[#4A1942] text-white rounded-lg text-xs font-bold"
              style={{ backgroundColor: config.primaryColor || '#4A1942' }}
            >
              {editingEventId ? 'Save Changes' : 'Add Event'}
            </button>
          </div>
        </form>
      )}

      {/* Events List */}
      {activeDay && (
        <div className="space-y-3">
          {activeDay.events.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-xl border border-dashed border-gray-200">
              <p className="text-sm font-semibold text-gray-600">
                No events scheduled for {activeDay.label}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Click <strong>+ Add Timeline Event</strong> above to start building this day's schedule.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100 shadow-sm">
              {activeDay.events.map((ev) => {
                const meta = getCategoryMeta(ev.category);
                const isCompleted = !!ev.isCompleted;

                return (
                  <div
                    key={ev.id}
                    className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                      isCompleted ? 'bg-gray-50/70 opacity-75' : 'hover:bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        onChange={() => {
                          if (!timeline) return;
                          toggleEventComplete(timeline.id, activeDay.id, ev.id);
                        }}
                        className="w-4 h-4 rounded mt-1 accent-[#4A1942] cursor-pointer"
                        style={{ accentColor: config.primaryColor || '#4A1942' }}
                        title="Mark milestone complete"
                        aria-label={`Mark milestone ${ev.title} complete`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-900">
                            {ev.title}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider"
                            style={{
                              backgroundColor: `${meta.color}15`,
                              color: meta.color,
                            }}
                          >
                            <span>{meta.icon}</span>
                            <span>{meta.label}</span>
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                          <span className="font-semibold text-gray-700">
                            🕒 {ev.startTime} – {ev.endTime}
                          </span>
                          {ev.location && (
                            <span>
                              📍 <strong>{ev.location}</strong>
                            </span>
                          )}
                          {ev.notes && (
                            <span className="text-gray-400 italic">
                              — {ev.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditing(ev)}
                          className="px-2.5 py-1 text-xs border rounded hover:bg-gray-100 text-gray-700 font-medium"
                          title="Edit event"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!timeline) return;
                            removeEvent(timeline.id, activeDay.id, ev.id);
                          }}
                          className="px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded font-bold"
                          title="Delete event"
                          aria-label={`Delete event ${ev.title}`}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
