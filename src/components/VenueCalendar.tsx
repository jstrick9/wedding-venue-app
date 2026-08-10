// @ts-nocheck
import { useMemo, useState } from 'react';
import {
  VenueCalendarEvent,
  VenueCalendarCategory,
  CoupleEvent,
  Venue,
} from '../types';
import {
  getVenueCalendarEvents,
  getVenueCalendarEventsInRange,
  addVenueCalendarEvent,
  updateVenueCalendarEvent,
  removeVenueCalendarEvent,
  moveVenueCalendarEvent,
  recurringDatesForEvent,
  CALENDAR_CATEGORY_LABELS,
} from '../services/calendar/venueCalendarService';
import { getCoupleEvents } from '../services/couples/coupleService';
import { getUsers } from '../hooks/useLayoutState';
import { showToast } from './Toast';
import { syncShiftsForCalendarEvent, getShiftsForCalendarEvent } from '../services/calendar/venueShiftService';
import { Button, Badge, EmptyState } from './ui';
import { useConfirm } from './useConfirm';
import { findBlockedBookedConflicts } from '../utils/calendarConflicts';
import { useBrandingConfig } from '../config';

type View = 'month' | 'week' | 'day' | 'agenda';

const getCatStyle = (cat: VenueCalendarCategory, primaryColor: string) => {
  if (cat === 'couple') {
    return {
      dotClass: '',
      dotStyle: { backgroundColor: primaryColor },
      chipClass: 'font-medium',
      chipStyle: { backgroundColor: `${primaryColor}20`, color: primaryColor },
    };
  }
  const map: Record<string, { dotClass: string; dotStyle?: React.CSSProperties; chipClass: string; chipStyle?: React.CSSProperties }> = {
    'open-house': { dotClass: 'bg-emerald-500', chipClass: 'bg-emerald-100 text-emerald-700 font-medium' },
    staffing: { dotClass: 'bg-amber-500', chipClass: 'bg-amber-100 text-amber-700 font-medium' },
    blocked: { dotClass: 'bg-red-500', chipClass: 'bg-red-100 text-red-700 font-medium' },
    other: { dotClass: 'bg-slate-500', chipClass: 'bg-slate-100 text-slate-700 font-medium' },
  };
  return map[cat] || map.other;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const toDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface EventItem {
  id: string;
  title: string;
  category: VenueCalendarCategory;
  date: string;
  startTime?: string;
  coupleEventId?: string;
  venue?: VenueCalendarEvent | null;
  /** Additional dates this item spans (e.g. multi-day couple events). */
  extraDates?: string[];
}

const staffName = (id: string) => getUsers().find((u) => u.id === id)?.name || id;

export function VenueCalendar({
  venues,
  onOpenCouple,
}: {
  venues: Venue[];
  onOpenCouple?: (coupleId: string) => void;
}) {
  const config = useBrandingConfig();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string>(toDateKey(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [editEv, setEditEv] = useState<VenueCalendarEvent | null>(null);
  const [detail, setDetail] = useState<EventItem | null>(null);
  const [, force] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const refresh = () => force((n) => n + 1);

  const handleDeleteEvent = async (e: EventItem) => {
    const ok = await confirm({
      title: 'Delete this event?',
      message: `Delete "${e.title}"? This also removes its linked staff shifts and cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok || !e.venue) return;
    removeVenueCalendarEvent(e.venue.id);
    setDetail(null);
    refresh();
    showToast('Event deleted.', 'success');
  };

  // Couple events as read-only calendar entries.
  const coupleEntries: EventItem[] = useMemo(() => {
    return getCoupleEvents()
      .filter((c) => c.eventDate)
      .map((c) => ({
        id: `couple-${c.id}`,
        title: c.coupleName + (c.guestCount ? ` (${c.guestCount})` : ''),
        category: 'couple' as VenueCalendarCategory,
        date: c.eventDate!,
        // Multi-day events: surface the couple's event on every booked day.
        extraDates: (c.days || [])
          .map((d) => d.date)
          .filter((d) => d && d !== c.eventDate),
        coupleEventId: c.id,
        venue: null,
      }));
  }, [cursor]);

  const venueEvents = getVenueCalendarEvents();
  const venueItems: EventItem[] = venueEvents.map((e) => ({
    id: e.id,
    title: e.title,
    category: e.category,
    date: e.date,
    startTime: e.startTime,
    coupleEventId: e.category === 'couple' ? e.coupleEventId : undefined,
    venue: e,
  }));

  const allItems: EventItem[] = [...coupleEntries, ...venueItems];

  // Days that are both marked "Blocked / Unavailable" AND hold a confirmed couple
  // event — a contradiction worth flagging so the venue doesn't block a booked day.
  const conflictDates: string[] = findBlockedBookedConflicts(allItems);

  const itemsByDate = (dateKey: string) =>
    allItems.filter((e) => {
      if (e.date === dateKey) return true;
      if (e.extraDates?.includes(dateKey)) return true;
      if (e.venue?.recurrence) {
        return recurringDatesForEvent(e.venue, dateKey, dateKey).length > 0;
      }
      return false;
    });

  const monthEvents = useMemo(
    () =>
      allItems.filter((e) => {
        const monthPrefix = toDateKey(cursor).slice(0, 7);
        if (e.date.startsWith(monthPrefix)) return true;
        return (e.extraDates || []).some((d) => d.startsWith(monthPrefix));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allItems, cursor, showForm, detail, editEv],
  );

  // Month grid
  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(toDateKey(new Date(year, month, d)));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  // Week days
  const weekStart = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    const dow = d.getDay();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
  }, [selectedDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => toDateKey(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i))),
    [weekStart],
  );

  const shiftPeriod = (dir: number) => {
    if (view === 'month') setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1));
    else if (view === 'week') {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + dir * 7);
      setSelectedDate(toDateKey(d));
    } else if (view === 'day' || view === 'agenda') {
      const d = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() + dir);
      setSelectedDate(toDateKey(d));
    }
  };

  const today = toDateKey(new Date());
  const isToday = (k: string) => k === today;

  const openCreate = (date?: string) => {
    setEditEv(null);
    setSelectedDate(date || selectedDate);
    setShowForm(true);
  };

  const saveForm = (input: { title: string; category: VenueCalendarCategory; date: string; startTime?: string; endTime?: string; spaceId?: string; assignees?: string[]; notes?: string; recurrence?: 'weekly' | 'monthly' | 'yearly' }) => {
    const saved = editEv
      ? (updateVenueCalendarEvent(editEv.id, input), getVenueCalendarEvents().find((e) => e.id === editEv.id) || null)
      : addVenueCalendarEvent({ ...input, createdBy: undefined });
    // Always reconcile shifts (syncShiftsForCalendarEvent removes dropped assignees,
    // so editing an event to unassign everyone clears its stale shifts too).
    if (saved) syncShiftsForCalendarEvent(saved);
    setShowForm(false);
    setEditEv(null);
    refresh();
  };

  const renderChip = (e: EventItem) => {
    const s = getCatStyle(e.category, config.primaryColor || '#4A1942');
    const draggable = !!e.venue; // venue-created events can be rescheduled by drag
    return (
      <button
        key={e.id}
        type="button"
        draggable={draggable}
        onDragStart={(ev) => { setDragId(e.id); ev.dataTransfer?.setData('text/plain', e.id); ev.dataTransfer!.effectAllowed = 'move'; }}
        onDragEnd={() => setDragId(null)}
        onClick={(ev) => { ev.stopPropagation(); if (e.coupleEventId && onOpenCouple) onOpenCouple(e.coupleEventId); else setDetail(e); }}
        className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] leading-tight truncate ${s.chipClass} ${dragId === e.id ? 'opacity-50' : ''} ${draggable ? 'cursor-grab' : 'cursor-pointer'}`}
        style={s.chipStyle}
        title={e.title}
      >
        {e.startTime ? `${e.startTime} ` : ''}{e.title}
      </button>
    );
  };

  const onCellDrop = (dateKey: string) => {
    setDragOver(null);
    if (!dragId) return;
    const ok = moveVenueCalendarEvent(dragId, dateKey);
    if (ok) {
      const moved = getVenueCalendarEvents().find((e) => e.id === dragId);
      if (moved) {
        // Dragging a recurring event moves just this occurrence: turn it into a one-off.
        if (moved.recurrence) updateVenueCalendarEvent(moved.id, { recurrence: undefined });
        syncShiftsForCalendarEvent(moved);
      }
    }
    setDragId(null);
    refresh();
    if (ok) showToast('Event moved.', 'success');
  };
  const cellDragProps = (dateKey: string) => ({
    onDragOver: (ev: React.DragEvent) => { ev.preventDefault(); ev.dataTransfer!.dropEffect = 'move'; setDragOver(dateKey); },
    onDragLeave: () => setDragOver((d) => (d === dateKey ? null : d)),
    onDrop: () => onCellDrop(dateKey),
  });

  const periodLabel =
    view === 'month'
      ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
      : view === 'week'
        ? `${weekDays[0]} – ${weekDays[6]}`
        : new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(['month', 'week', 'day', 'agenda'] as View[]).map((v) => (
              <Button
                key={v}
                type="button"
                size="sm"
                tone={view === v ? 'primary' : 'default'}
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className="capitalize"
              >
                {v}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button type="button" onClick={() => shiftPeriod(-1)} className="px-2 py-1 rounded border border-gray-300 text-gray-600">◀</button>
            <button type="button" onClick={() => setSelectedDate(today)} className="px-3 py-1 rounded border border-gray-300 text-sm text-gray-600">Today</button>
            <button type="button" onClick={() => shiftPeriod(1)} className="px-2 py-1 rounded border border-gray-300 text-gray-600">▶</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">{periodLabel}</span>
          <Button type="button" tone="success" size="sm" onClick={() => openCreate()}>+ Add event</Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        {(['couple', 'open-house', 'staffing', 'blocked', 'other'] as VenueCalendarCategory[]).map((c) => {
          const s = getCatStyle(c, config.primaryColor || '#4A1942');
          return (
            <Badge key={c} tone={c === 'blocked' ? 'danger' : c === 'staffing' ? 'warning' : c === 'couple' ? 'primary' : 'default'}>
              <span className={`w-2 h-2 rounded-full ${s.dotClass}`} style={s.dotStyle} />
              {CALENDAR_CATEGORY_LABELS[c]}
            </Badge>
          );
        })}
      </div>

      {/* Blocked-vs-booked conflict warning */}
      {conflictDates.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <div className="font-semibold mb-1">
            ⚠️ {conflictDates.length} date{conflictDates.length === 1 ? '' : 's'} are both blocked and booked
          </div>
          <div className="text-xs text-amber-800">
            {conflictDates
              .sort()
              .map((d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }))
              .join(' · ')}
            . Remove the “Blocked / Unavailable” entry if the couple's event is confirmed.
          </div>
        </div>
      )}

      {/* Month view */}
      {view === 'month' && (
        <div className="rounded-xl bg-white border border-gray-200 overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 bg-gray-50 text-xs font-medium text-gray-500">
            {DAYS.map((d) => <div key={d} className="px-2 py-2 text-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 border-t border-gray-100">
            {grid.map((k, i) => (
              <div
                key={i}
                onClick={() => { setSelectedDate(k || today); setView('day'); }}
                className={`min-h-[72px] border border-gray-100 p-1 cursor-pointer ${!k ? 'bg-gray-50' : 'hover:bg-gray-50'} ${dragOver === k ? 'ring-2' : ''}`}
                style={{
                  backgroundColor: k && isToday(k) ? `${config.primaryColor || '#4A1942'}15` : undefined,
                  borderColor: dragOver === k ? config.primaryColor || '#4A1942' : undefined,
                }}
                {...(k ? cellDragProps(k) : {})}
              >
                {k && (
                  <>
                    <div className="text-[10px] text-gray-500 mb-0.5">{Number(k.slice(8))}</div>
                    <div className="space-y-0.5">
                      {itemsByDate(k).slice(0, 3).map(renderChip)}
                      {itemsByDate(k).length > 3 && (
                        <div className="text-[10px] text-gray-400 pl-1">+{itemsByDate(k).length - 3} more</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week view */}
      {view === 'week' && (
        <div className="rounded-xl bg-white border border-gray-200 overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 bg-gray-50 text-xs font-medium text-gray-500">
            {weekDays.map((k) => (
              <div
                key={k}
                className="px-2 py-2 text-center cursor-pointer hover:bg-gray-100"
                onClick={() => { setSelectedDate(k); setView('day'); }}
              >
                <div>{DAYS[new Date(k + 'T00:00:00').getDay()]}</div>
                <div
                  className="font-bold"
                  style={isToday(k) ? { color: config.primaryColor || '#4A1942' } : undefined}
                >
                  {Number(k.slice(8))}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 border-t border-gray-100">
            {weekDays.map((k) => (
              <div
                key={k}
                className={`min-h-[160px] border border-gray-100 p-1 cursor-pointer hover:bg-gray-50 ${dragOver === k ? 'ring-2' : ''}`}
                style={dragOver === k ? { borderColor: config.primaryColor || '#4A1942' } : undefined}
                onClick={() => { setSelectedDate(k); setView('day'); }}
                {...cellDragProps(k)}
              >
                <div className="space-y-0.5">
                  {itemsByDate(k).map(renderChip)}
                  <button type="button" onClick={(e) => { e.stopPropagation(); openCreate(k); }} className="text-[10px] text-emerald-600 hover:underline pl-1">+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day view */}
      {view === 'day' && (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 text-sm font-semibold text-gray-700 border-b">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            <button type="button" onClick={() => openCreate(selectedDate)} className="ml-3 text-xs text-emerald-600 hover:underline">+ Add</button>
          </div>
          <div className="divide-y divide-gray-100">
            {itemsByDate(selectedDate).length === 0 && (
              <EmptyState icon="🗓️" title="No events on this day." hint="Use “+ Add event” to schedule an open house, setup, or blocked date." />
            )}
            {itemsByDate(selectedDate).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')).map((e) => {
              const s = getCatStyle(e.category, config.primaryColor || '#4A1942');
              return (
                <div key={e.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.dotClass}`} style={s.dotStyle} />
                  <span className="text-gray-500 w-20">{e.startTime || '—'}</span>
                  <span className="flex-1 text-gray-800 font-medium">{e.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.chipClass}`} style={s.chipStyle}>{CALENDAR_CATEGORY_LABELS[e.category]}</span>
                  {e.venue && e.venue.assignees && e.venue.assignees.length > 0 && (
                    <span className="text-xs text-sky-700">👤 {e.venue.assignees.length}</span>
                  )}
                  {e.coupleEventId && onOpenCouple ? (
                    <button type="button" onClick={() => onOpenCouple(e.coupleEventId!)} className="text-xs hover:underline font-semibold" style={{ color: config.primaryColor || '#4A1942' }}>Open</button>
                  ) : e.venue ? (
                    <button type="button" onClick={() => setEditEv(e.venue)} className="text-xs text-gray-600 hover:underline">Edit</button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agenda view */}
      {view === 'agenda' && (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 text-sm font-semibold text-gray-700 border-b">Agenda</div>
          {allItems.length === 0 && (
            <EmptyState icon="🗓️" title="No events scheduled." hint="Add an open house, staffing, or blocked date to start using your calendar." />
          )}
          <div className="divide-y divide-gray-100">
            {allItems
              .slice()
              .sort((a, b) => (a.date < b.date ? -1 : 1) || (a.startTime || '').localeCompare(b.startTime || ''))
              .map((e) => {
                const s = getCatStyle(e.category, config.primaryColor || '#4A1942');
                return (
                  <div key={e.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                    <span className={`w-2.5 h-2.5 rounded-full ${s.dotClass}`} style={s.dotStyle} />
                    <span className="text-gray-500 w-24">{new Date(e.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    <span className="text-gray-500 w-14">{e.startTime || ''}</span>
                    <span className="flex-1 text-gray-800">{e.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.chipClass}`} style={s.chipStyle}>{CALENDAR_CATEGORY_LABELS[e.category]}</span>
                    {e.venue?.recurrence && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${config.primaryColor || '#4A1942'}1A`, color: config.primaryColor || '#4A1942' }}>↻ {e.venue.recurrence}</span>
                    )}
                    {e.coupleEventId && onOpenCouple ? (
                      <button type="button" onClick={() => onOpenCouple(e.coupleEventId!)} className="text-xs hover:underline font-semibold" style={{ color: config.primaryColor || '#4A1942' }}>Open</button>
                    ) : e.venue ? (
                      <button type="button" onClick={() => setEditEv(e.venue)} className="text-xs text-gray-600 hover:underline">Edit</button>
                    ) : null}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[12000] p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              {(() => { const s = getCatStyle(detail.category, config.primaryColor || '#4A1942'); return <span className={`w-3 h-3 rounded-full ${s.dotClass}`} style={s.dotStyle} />; })()}
              <h3 className="font-semibold">{detail.title}</h3>
            </div>
            <p className="text-sm text-gray-600">
              {new Date(detail.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              {detail.startTime ? ` · ${detail.startTime}` : ''}
              {detail.endTime ? ` – ${detail.endTime}` : ''}
            </p>
            {detail.venue?.spaceId && (() => {
              const space = venues.find((v) => v.id === detail.venue!.spaceId);
              return space ? (
                <p className="text-sm text-gray-600">🏛️ {space.name}</p>
              ) : null;
            })()}
            {detail.venue?.notes && (
              <p className="text-sm text-gray-600 whitespace-pre-line"><span className="font-medium">Notes:</span> {detail.venue.notes}</p>
            )}
            {detail.venue?.recurrence && (
              <p className="text-sm text-gray-500">↻ Repeats {detail.venue.recurrence}</p>
            )}
            {detail.venue && detail.venue.assignees && detail.venue.assignees.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {detail.venue.assignees.map((id) => (
                  <span key={id} className="text-xs bg-sky-100 text-sky-700 rounded-full px-2 py-0.5">👤 {staffName(id)}</span>
                ))}
              </div>
            )}
            {detail.venue && getShiftsForCalendarEvent(detail.venue.id).length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Staff shifts</div>
                <div className="space-y-1">
                  {getShiftsForCalendarEvent(detail.venue.id).map((s) => (
                    <div key={s.id} className="text-xs text-gray-600 flex items-center gap-1.5">
                      <span>🕒</span>
                      <span>{staffName(s.staffId)}</span>
                      <span className="text-gray-400">· {s.startTime?.slice(11, 16) || '—'}{s.endTime ? ` – ${s.endTime.slice(11, 16)}` : ''} · {s.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              {detail.venue && (
                <>
                  <button type="button" onClick={() => { void handleDeleteEvent(detail!); }} className="px-3 py-1.5 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50">Delete</button>
                  <button type="button" onClick={() => { setEditEv(detail.venue!); setDetail(null); }} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600">Edit</button>
                </>
              )}
              <button type="button" onClick={() => setDetail(null)} className="btn-primary px-3 py-1.5 rounded-lg bg-[#4A1942] text-white text-sm" style={{ backgroundColor: config.primaryColor || '#4A1942' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {(showForm || editEv) && (
        <CalendarEventForm
          initial={editEv}
          defaultDate={selectedDate}
          venues={venues}
          onCancel={() => { setShowForm(false); setEditEv(null); }}
          onSave={saveForm}
        />
      )}
      {confirmDialog}
    </div>
  );
}

function CalendarEventForm({
  initial,
  defaultDate,
  venues,
  onCancel,
  onSave,
}: {
  initial: VenueCalendarEvent | null;
  defaultDate: string;
  venues: Venue[];
  onCancel: () => void;
  onSave: (input: { title: string; category: VenueCalendarCategory; date: string; startTime?: string; endTime?: string; spaceId?: string; assignees?: string[]; notes?: string; recurrence?: 'weekly' | 'monthly' | 'yearly' }) => void;
}) {
  const staff = getUsers();
  const [f, setF] = useState({
    title: initial?.title || '',
    category: initial?.category || ('open-house' as VenueCalendarCategory),
    date: initial?.date || defaultDate,
    startTime: initial?.startTime || '',
    endTime: initial?.endTime || '',
    spaceId: initial?.spaceId || '',
    assignees: initial?.assignees || [] as string[],
    notes: initial?.notes || '',
    recurrence: initial?.recurrence || ('' as '' | 'weekly' | 'monthly' | 'yearly'),
  });
  const [formError, setFormError] = useState('');
  const toggleAssignee = (id: string) =>
    setF((p) => ({ ...p, assignees: p.assignees.includes(id) ? p.assignees.filter((x) => x !== id) : [...p.assignees, id] }));
  const handleSave = () => {
    if (!f.title.trim()) {
      setFormError('Please enter an event title.');
      return;
    }
    if (!f.date) {
      setFormError('Please pick a date.');
      return;
    }
    if (f.startTime && f.endTime && f.endTime <= f.startTime) {
      setFormError('The end time must be after the start time.');
      return;
    }
    setFormError('');
    onSave({ title: f.title, category: f.category, date: f.date, startTime: f.startTime, endTime: f.endTime, spaceId: f.spaceId, assignees: f.assignees, notes: f.notes, recurrence: f.recurrence || undefined });
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[12000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-3">
        <h3 className="font-semibold">{initial ? 'Edit event' : 'Add event'}</h3>
        <input
          type="text"
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          placeholder="Event title"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          aria-label="Event title"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={f.category}
            onChange={(e) => setF({ ...f, category: e.target.value as VenueCalendarCategory })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            aria-label="Category"
          >
            {(['open-house', 'staffing', 'blocked', 'other'] as VenueCalendarCategory[]).map((c) => (
              <option key={c} value={c}>{CALENDAR_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          <input
            type="date"
            value={f.date}
            onChange={(e) => setF({ ...f, date: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            aria-label="Date"
          />
          <input
            type="time"
            value={f.startTime}
            onChange={(e) => setF({ ...f, startTime: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            aria-label="Start time"
          />
          <input
            type="time"
            value={f.endTime}
            onChange={(e) => setF({ ...f, endTime: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            aria-label="End time"
          />
            <select
              value={f.spaceId}
              onChange={(e) => setF({ ...f, spaceId: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              aria-label="Space"
            >
              <option value="">No specific space</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <select
              value={f.recurrence}
              onChange={(e) => setF({ ...f, recurrence: e.target.value as '' | 'weekly' | 'monthly' | 'yearly' })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              aria-label="Recurrence"
            >
              <option value="">Does not repeat</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        <textarea
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
          placeholder="Notes"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          rows={2}
          aria-label="Notes"
        />
        <div>
          <label className="block text-xs text-gray-600 mb-1">Assign staff</label>
          {staff.length === 0 ? (
            <p className="text-xs text-gray-400">No staff/users configured yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {staff.map((u) => {
                const on = f.assignees.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleAssignee(u.id)}
                    className={`text-xs px-2 py-1 rounded-full border ${on ? 'btn-primary bg-[#4A1942] text-white border-[#4A1942]' : 'bg-white text-gray-600 border-gray-300'}`}
                    style={on ? { backgroundColor: config.primaryColor || '#4A1942', borderColor: config.primaryColor || '#4A1942' } : undefined}
                  >
                    {on ? '✓ ' : ''}{u.name || u.username}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {formError && (
          <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            ⚠️ {formError}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600">Cancel</button>
          <button
            type="button"
            onClick={handleSave}
            className="btn-primary px-4 py-2 rounded-lg bg-[#4A1942] text-white text-sm font-medium"
            style={{ backgroundColor: config.primaryColor || '#4A1942' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
