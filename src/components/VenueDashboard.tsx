// @ts-nocheck
import { useMemo, useState } from 'react';
import { VenueCalendar } from './VenueCalendar';
import { getCoupleEvents } from '../services/couples/coupleService';
import { getCoupleRsvpSubmissions } from '../services/couples/coupleRsvpService';
import { getCoupleSetupTasks } from '../services/couples/coupleSetupService';
import { getCoupleGuestEvents, getAssignedGuestCount } from '../services/couples/coupleGuestEventService';
import { getVenueCalendarEvents } from '../services/calendar/venueCalendarService';
import { findWeddingPackage } from '../services/couples/couplePackageService';
import { getVenues } from '../hooks/useLayoutState';
import { getConfig } from '../config';

type Section = 'home' | 'calendar' | 'couples' | 'vendors' | 'timeline' | 'admin' | 'ops';

type InlineNode = React.ReactNode | undefined;

type ReactNodeish = import('react').ReactNode;

interface Props {
  user: { id?: string; name?: string; username?: string };
  isAdmin: boolean;
  isStaff: boolean;
  canAdmin: boolean;
  canOps: boolean;
  onOpenAdmin: () => void;
  onOpenOperations: () => void;
  onOpenVendors: () => void;
  onOpenTimeline: () => void;
  onOpenStudio: () => void;
  onLogout: () => void;
  /** Pre-rendered inline Admin panel node (rendered in the Admin section). */
  adminNode?: ReactNodeish;
  /** Pre-rendered inline Operations panel node (rendered in the Ops section). */
  opsNode?: ReactNodeish;
  /** Pre-rendered inline Vendors panel node. */
  vendorsNode?: ReactNodeish;
  /** Pre-rendered inline Timeline panel node. */
  timelineNode?: ReactNodeish;
}

const openCouplePortal = (id: string) => {
  const ev = getCoupleEvents().find((e) => e.id === id);
  if (!ev) return;
  const url = `${window.location.origin}${window.location.pathname}#/couples-portal?token=${encodeURIComponent(ev.inviteToken)}`;
  window.open(url, '_blank');
};

const dayKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export function VenueDashboard(props: Props) {
  const { isAdmin, isStaff, user } = props;
  const [section, setSection] = useState<Section>('home');
  const venues = useMemo(() => getVenues(), []);
  const config = getConfig();

  const coupleEvents = useMemo(() => getCoupleEvents(), []);
  const calendarEvents = useMemo(() => getVenueCalendarEvents(), []);

  // First-time-venue onboarding empty states.
  const venuesCount = venues.length;
  const couplesCount = coupleEvents.length;
  const openHouses = calendarEvents.filter((e) => e.category === 'open-house').length;
  const needsOnboarding = venuesCount === 0 || couplesCount === 0;

  const stats = useMemo(() => {
    const active = coupleEvents.filter((e) => e.status !== 'completed');
    const pending = coupleEvents.filter((e) => e.layoutStatus === 'pending' || e.layoutStatus === 'changes_requested').length;
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
    return { active: active.length, pending, setupDone, setupTotal, overnightTotal, overnightCap };
  }, [coupleEvents]);

  const today = dayKey(new Date());
  const in30 = dayKey(new Date(Date.now() + 30 * 86400000));
  const in60 = dayKey(new Date(Date.now() + 60 * 86400000));

  // Upcoming events (couple events + venue calendar) within 60 days.
  const upcoming = useMemo(() => {
    const list = [];
    coupleEvents.filter((e) => e.eventDate && e.eventDate >= today && e.eventDate <= in60).forEach((e) => {
      list.push({ date: e.eventDate, title: e.coupleName, category: 'couple', id: e.id });
    });
    calendarEvents.filter((e) => e.date >= today && e.date <= in60).forEach((e) => {
      list.push({ date: e.date, title: e.title, category: e.category, id: e.id, venueEv: e });
    });
    return list.sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 12);
  }, [coupleEvents, calendarEvents, today, in60]);

  // Next 7 days for the mini agenda widget.
  const next7 = upcoming.filter((e) => e.date <= in30).slice(0, 6);

  const items: { id: string; label: string; icon: string; action: () => void }[] = [
    { id: 'home', label: 'Home', icon: '🏠', action: () => setSection('home') },
    { id: 'calendar', label: 'Calendar', icon: '📅', action: () => setSection('calendar') },
    { id: 'couples', label: 'Couples & Events', icon: '💍', action: () => setSection('couples') },
    { id: 'vendors', label: 'Vendors', icon: '🧰', action: () => setSection('vendors') },
    { id: 'timeline', label: 'Timeline', icon: '⏱️', action: () => setSection('timeline') },
    { id: 'ops', label: 'Operations', icon: '🛠️', action: () => setSection('ops') },
    { id: 'admin', label: 'Admin', icon: '🔐', action: () => setSection('admin') },
    { id: 'studio', label: 'Design Studio', icon: '🎨', action: () => { props.onOpenStudio(); } },
  ];
  const sidebarItems = items.filter((i) => {
    if (i.id === 'admin') return props.canAdmin;
    if (i.id === 'ops') return props.canOps;
    return true;
  });

  const catChip = (cat: string) => {
    const map = { couple: 'bg-indigo-100 text-indigo-700', 'open-house': 'bg-emerald-100 text-emerald-700', staffing: 'bg-amber-100 text-amber-700', other: 'bg-slate-100 text-slate-700' };
    return map[cat] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: config.backgroundColor || '#f3f4f6' }}>
      {/* Persistent left sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col" style={{ color: config.textColor }}>
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="font-bold" style={{ color: config.primaryColor }}>{config.venueName || 'Venue'}</div>
          <div className="text-xs text-gray-500 mt-0.5">Workspace</div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {sidebarItems.map((item) => {
            const active = item.id === section && ['home', 'calendar', 'couples'].includes(item.id);
            const divider = item.id === 'ops' || item.id === 'studio';
            return (
              <div key={item.id}>
                {divider && <div className="my-2 border-t border-gray-100" />}
                <button
                  type="button"
                  onClick={item.action}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active ? 'text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  style={active ? { backgroundColor: config.primaryColor } : undefined}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              </div>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
          <div className="truncate">{user?.name || user?.username}</div>
          <button type="button" onClick={props.onLogout} className="mt-1 text-indigo-600 hover:underline">Sign out</button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-5">
        {section === 'home' && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: config.textColor }}>Welcome back</h1>
              <p className="text-sm text-gray-500 mt-0.5">Here's what's happening at {config.venueName || 'your venue'}.</p>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <div className="text-2xl font-bold">{stats.active}</div>
                <div className="text-xs text-gray-500 mt-0.5">Active couples</div>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <div className={`text-2xl font-bold ${stats.pending > 0 ? 'text-amber-600' : ''}`}>{stats.pending}</div>
                <div className="text-xs text-gray-500 mt-0.5">Awaiting layout review</div>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <div className="text-2xl font-bold text-sky-700">{stats.setupTotal > 0 ? `${Math.round((stats.setupDone / stats.setupTotal) * 100)}%` : '—'}</div>
                <div className="text-xs text-gray-500 mt-0.5">Setup ({stats.setupDone}/{stats.setupTotal})</div>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <div className={`text-2xl font-bold ${stats.overnightTotal > stats.overnightCap ? 'text-red-600' : 'text-indigo-700'}`}>{stats.overnightTotal}<span className="text-sm text-gray-400">/{stats.overnightCap}</span></div>
                <div className="text-xs text-gray-500 mt-0.5">Overnight guests</div>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <div className="text-2xl font-bold text-emerald-600">{calendarEvents.filter((e) => e.category === 'open-house').length}</div>
                <div className="text-xs text-gray-500 mt-0.5">Open houses</div>
              </div>
            </div>

            {/* Onboarding empty-state for first-time venues */}
            {needsOnboarding && (
              <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/60 p-5">
                <h2 className="font-semibold text-indigo-900">Let's set up {config.venueName || 'your venue'} 🎉</h2>
                <p className="text-sm text-indigo-800/80 mt-1">A few quick steps to get everything running.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <button
                    type="button"
                    onClick={props.onOpenAdmin}
                    className="rounded-xl bg-white border border-indigo-200 p-4 text-left hover:border-indigo-400"
                  >
                    <div className="text-2xl">🏛️</div>
                    <div className="font-medium mt-1 text-gray-800">{venuesCount === 0 ? 'Add your venue spaces' : 'Manage venue spaces'}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Set up your ceremony, reception, and lodging spaces.</div>
                  </button>
                  <button
                    type="button"
                    onClick={props.onOpenAdmin}
                    className="rounded-xl bg-white border border-indigo-200 p-4 text-left hover:border-indigo-400"
                  >
                    <div className="text-2xl">🎁</div>
                    <div className="font-medium mt-1 text-gray-800">Review packages & add-ons</div>
                    <div className="text-xs text-gray-500 mt-0.5">Confirm your wedding packages and add-on pricing.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection('couples')}
                    className="rounded-xl bg-white border border-indigo-200 p-4 text-left hover:border-indigo-400"
                  >
                    <div className="text-2xl">💍</div>
                    <div className="font-medium mt-1 text-gray-800">{couplesCount === 0 ? 'Create your first couple event' : 'Open Couples & Events'}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Add a booked couple to start planning with them.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection('calendar')}
                    className="rounded-xl bg-white border border-indigo-200 p-4 text-left hover:border-indigo-400"
                  >
                    <div className="text-2xl">📅</div>
                    <div className="font-medium mt-1 text-gray-800">{openHouses === 0 ? 'Schedule an open house' : 'Open the calendar'}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Add monthly open houses, staffing, and venue events.</div>
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Upcoming events */}
              <div className="lg:col-span-2 rounded-xl bg-white border border-gray-200 shadow-sm">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold">Upcoming events</h2>
                  <button type="button" onClick={() => setSection('calendar')} className="text-xs text-indigo-600 hover:underline">Open calendar →</button>
                </div>
                {upcoming.length === 0 ? (
                  <div className="px-4 py-8 text-center space-y-2">
                    <p className="text-3xl">📅</p>
                    <p className="text-sm text-gray-500">No upcoming events in the next 60 days.</p>
                    <button type="button" onClick={() => setSection('calendar')} className="text-xs text-indigo-600 hover:underline">Schedule an event or open house</button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {upcoming.map((e, i) => (
                      <div key={`${e.id}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${catChip(e.category)}`}>{e.category === 'couple' ? '💍' : e.category === 'open-house' ? '🏠' : e.category === 'staffing' ? '🛠️' : '📌'}</span>
                        <span className="text-gray-500 w-24">{new Date(e.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        <span className="flex-1 font-medium text-gray-800 truncate">{e.title}</span>
                        {e.id.startsWith('couple-') || e.category === 'couple' ? (
                          <button type="button" onClick={() => openCouplePortal(e.id.replace('couple-', ''))} className="text-xs text-indigo-600 hover:underline">Open</button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right widgets */}
              <div className="space-y-5">
                <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-4">
                  <h2 className="font-semibold mb-3">This week</h2>
                  {next7.length === 0 ? (
                    <p className="text-sm text-gray-400">Nothing scheduled this week.</p>
                  ) : (
                    <div className="space-y-2">
                      {next7.map((e, i) => (
                        <div key={`${e.id}-${i}`} className="flex items-center gap-2 text-sm">
                          <span className={`w-2.5 h-2.5 rounded-full ${e.category === 'couple' ? 'bg-indigo-500' : e.category === 'open-house' ? 'bg-emerald-500' : e.category === 'staffing' ? 'bg-amber-500' : 'bg-slate-500'}`} />
                          <span className="text-gray-500 text-xs w-14">{new Date(e.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })}</span>
                          <span className="flex-1 text-gray-700 truncate">{e.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-4">
                  <h2 className="font-semibold mb-3">Quick actions</h2>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={props.onOpenOperations} className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">🛠️ Ops</button>
                    <button type="button" onClick={props.onOpenAdmin} className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">🔐 Admin</button>
                    <button type="button" onClick={() => setSection('calendar')} className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">📅 Calendar</button>
                    <button type="button" onClick={props.onOpenStudio} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">🎨 Design Studio</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {section === 'calendar' && (
          <VenueCalendar venues={venues} onOpenCouple={(id) => openCouplePortal(id)} />
        )}

        {section === 'couples' && (
          <div className="space-y-3">
            <h1 className="text-2xl font-bold">Couples &amp; Events</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {coupleEvents.length === 0 && <p className="text-sm text-gray-400">No couple events yet.</p>}
              {coupleEvents.map((e) => (
                <div key={e.id} className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                  <div className="font-semibold text-gray-800">{e.coupleName}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {e.eventDate ? new Date(e.eventDate).toLocaleDateString() : 'No date'}
                    {e.eventEndDate && e.eventEndDate !== e.eventDate ? ` – ${new Date(e.eventEndDate).toLocaleDateString()}` : ''}
                    {e.guestCount ? ` · ${e.guestCount} guests` : ''}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${e.layoutStatus === 'approved' ? 'bg-green-100 text-green-700' : e.layoutStatus === 'pending' || e.layoutStatus === 'changes_requested' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                      {e.layoutStatus}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{e.status}</span>
                  </div>
                  <button type="button" onClick={() => openCouplePortal(e.id)} className="mt-3 text-xs text-indigo-600 hover:underline">Open couple portal →</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'ops' && (
          <div className="h-[calc(100vh-2rem)]">
            {props.opsNode || <p className="text-sm text-gray-400">Operations panel is not available.</p>}
          </div>
        )}

        {section === 'admin' && (
          <div className="h-[calc(100vh-2rem)] overflow-hidden">
            {props.adminNode || <p className="text-sm text-gray-400">Admin panel is not available.</p>}
          </div>
        )}

        {section === 'vendors' && (
          <div className="h-[calc(100vh-2rem)] overflow-hidden">
            {props.vendorsNode || <p className="text-sm text-gray-400">Vendors panel is not available.</p>}
          </div>
        )}

        {section === 'timeline' && (
          <div className="h-[calc(100vh-2rem)] overflow-hidden">
            {props.timelineNode || <p className="text-sm text-gray-400">Timeline panel is not available.</p>}
          </div>
        )}

      </main>
    </div>
  );
}
