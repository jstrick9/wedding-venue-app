// @ts-nocheck
import { useMemo, useState, useEffect } from 'react';
import { VenueCalendar } from './VenueCalendar';
import { getCoupleEvents } from '../services/couples/coupleService';
import { getCoupleSetupTasks } from '../services/couples/coupleSetupService';
import { getCoupleGuestEvents, getAssignedGuestCount } from '../services/couples/coupleGuestEventService';
import { getVenueCalendarEvents, recurringDatesForEvent } from '../services/calendar/venueCalendarService';
import { getUnreadCoupleMessageCounts } from '../services/couples/coupleChatService';
import { findWeddingPackage } from '../services/couples/couplePackageService';
import { getVenues } from '../hooks/useLayoutState';
import { getConfig, useBrandingConfig } from '../config';
import { Card, Button, EmptyState } from './ui';
import { on, emit } from '../utils/appEvents';
import { VenueChatPanel } from './VenueChatPanel';

type Section = 'home' | 'calendar' | 'couples' | 'vendors' | 'timeline' | 'admin' | 'ops' | 'chat';

type InlineNode = React.ReactNode | undefined;

type ReactNodeish = import('react').ReactNode;

interface Props {
  user: { id?: string; name?: string; username?: string };
  isAdmin: boolean;
  isStaff: boolean;
  canAdmin: boolean;
  canOps: boolean;
  users?: any[];
  onOpenAdmin: () => void;
  onOpenOperations: () => void;
  onOpenVendors: () => void;
  onOpenTimeline: () => void;
  onOpenStudio: () => void;
  onLogout: () => void;
  /** Pre-rendered inline Operations panel node (rendered in the Ops section). */
  opsNode?: ReactNodeish;
  /** Pre-rendered inline Vendors panel node. */
  vendorsNode?: ReactNodeish;
  /** Pre-rendered inline Timeline panel node. */
  timelineNode?: ReactNodeish;
  /** Pre-rendered inline Chat panel node. */
  chatNode?: ReactNodeish;
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
  // Mobile drawer toggle for the left sidebar.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const offHome = on('spm_dashboard_go_home', () => setSection('home'));
    const offSection = on('spm_dashboard_open_section', (detail) => {
      if (detail) setSection(detail as Section);
    });
    return () => {
      offHome();
      offSection();
    };
  }, []);
  const venues = useMemo(() => getVenues(), []);
  const config = useBrandingConfig();

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
    // Unread couple->venue messages (venue side unread = messages from the couple).
    const unread = Object.values(getUnreadCoupleMessageCounts(coupleEvents.map((e) => e.id), 'venue')).reduce((a, b) => a + b, 0);
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
    return { active: active.length, pending, unread, setupDone, setupTotal, overnightTotal, overnightCap, blocked: calendarEvents.filter((e) => e.category === 'blocked').length };
  }, [coupleEvents, calendarEvents]);

  const today = dayKey(new Date());
  const in30 = dayKey(new Date(Date.now() + 30 * 86400000));
  const in60 = dayKey(new Date(Date.now() + 60 * 86400000));

  // Upcoming events (couple events + venue calendar) within 60 days. Multi-day
  // couple events are expanded to every booked day so non-primary days (e.g. the
  // rehearsal dinner before the ceremony day) show in the pipeline too.
  const upcoming = useMemo(() => {
    const list = [];
    coupleEvents.forEach((e) => {
      const days = e.days && e.days.length > 0 ? e.days.map((d) => d.date).filter(Boolean) : [e.eventDate];
      days.forEach((d) => {
        if (d && d >= today && d <= in60) {
          list.push({ date: d, title: e.coupleName, category: 'couple', id: e.id });
        }
      });
    });
    calendarEvents.forEach((e) => {
      if (e.recurrence) {
        // Recurring events (weekly/monthly/yearly open houses, etc.) should show up
        // on every occurrence within the window, not just the seed date.
        recurringDatesForEvent(e, today, in60).forEach((d) => {
          if (d && d >= today && d <= in60) {
            list.push({ date: d, title: e.title, category: e.category, id: `${e.id}-${d}`, venueEv: e });
          }
        });
        return;
      }
      if (e.date >= today && e.date <= in60) {
        list.push({ date: e.date, title: e.title, category: e.category, id: e.id, venueEv: e });
      }
    });
    return list.sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 12);
  }, [coupleEvents, calendarEvents, today, in60]);

  // Next 7 days for the mini agenda widget (labeled "This week"). Previously this
  // used a 30-day window, so it silently showed events up to a month out.
  const next7 = upcoming.filter((e) => e.date <= dayKey(new Date(Date.now() + 7 * 86400000))).slice(0, 6);

  const items: { id: string; label: string; icon: string; action: () => void }[] = [
    { id: 'home', label: 'Home', icon: '🏠', action: () => setSection('home') },
    { id: 'calendar', label: 'Calendar', icon: '📅', action: () => setSection('calendar') },
    { id: 'couples', label: 'Couples Portal', icon: '💍', action: () => setSection('couples') },
    { id: 'chat', label: 'Portal Chat', icon: '💬', action: () => setSection('chat'), badgeCount: stats.unread > 0 ? stats.unread : 0 },
    { id: 'vendors', label: 'Vendors', icon: '🧰', action: () => setSection('vendors') },
    { id: 'timeline', label: 'Timeline', icon: '⏱️', action: () => setSection('timeline') },
    { id: 'ops', label: 'Operations', icon: '🛠️', action: () => setSection('ops') },
    { id: 'admin', label: 'Admin & System Settings', icon: '🔐', action: () => props.onOpenAdmin() },
    { id: 'studio', label: 'Design Studio', icon: '🎨', action: () => { props.onOpenStudio(); } },
  ];
  const sidebarItems = items
    .filter((i) => {
      if (i.id === 'admin') return props.canAdmin;
      if (i.id === 'ops') return props.canOps;
      return true;
    })
    .map((i) => ({
      ...i,
      action: () => {
        setSidebarOpen(false); // close the mobile drawer on navigation
        i.action();
      },
    }));

  const catChip = (cat: string) => {
    const map = { couple: 'bg-[#4A1942]/10 text-[#4A1942]', 'open-house': 'bg-emerald-100 text-emerald-700', staffing: 'bg-amber-100 text-amber-700', blocked: 'bg-red-100 text-red-700', other: 'bg-slate-100 text-slate-700' };
    return map[cat] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: config.backgroundColor || '#f3f4f6' }}>
      {/* Mobile hamburger (top-left) */}
      <button
        type="button"
        onClick={() => setSidebarOpen((v) => !v)}
        className="lg:hidden fixed top-3 left-3 z-30 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 shadow-sm"
        aria-expanded={sidebarOpen}
        aria-label="Toggle navigation menu"
      >
        ☰ <span className="hidden sm:inline">Menu</span>
      </button>

      {/* Persistent left sidebar — off-canvas on mobile, static on lg+ */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-20 w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ color: config.textColor }}
      >
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="font-bold" style={{ color: config.primaryColor }}>{config.venueName || 'Venue'}</div>
          <div className="text-xs text-gray-500 mt-0.5">Workspace</div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {sidebarItems.map((item) => {
            const active = item.id === section;
            const divider = item.id === 'ops' || item.id === 'studio';
            return (
              <div key={item.id}>
                {divider && <div className="my-2 border-t border-gray-100" />}
                <button
                  type="button"
                  onClick={item.action}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active ? 'text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  style={active ? { backgroundColor: config.primaryColor || '#4A1942' } : undefined}
                >
                  <span className="flex items-center gap-2">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  {(item as any).badgeCount > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                        active ? 'bg-white text-rose-600' : 'bg-rose-500 text-white'
                      }`}
                    >
                      {(item as any).badgeCount}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
          <div className="truncate">{user?.name || user?.username}</div>
          <button type="button" onClick={props.onLogout} className="mt-1 text-[#4A1942] hover:underline">Sign out</button>
        </div>
      </aside>

      {/* Mobile overlay to dismiss the drawer */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-10 lg:hidden bg-black/30"
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-5 lg:pl-5 pl-16">
        {section === 'home' && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: config.textColor }}>Welcome back</h1>
              <p className="text-sm text-gray-500 mt-0.5">Here's what's happening at {config.venueName || 'your venue'}.</p>
            </div>

            {/* Live Couple Messages Alert Banner */}
            {stats.unread > 0 && (
              <div className="rounded-xl border border-purple-300 bg-purple-50 p-4 mb-2 flex items-center justify-between gap-3 flex-wrap shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">💬</span>
                  <div>
                    <div className="text-sm font-bold text-purple-900">
                      {stats.unread} Unread Message{stats.unread === 1 ? '' : 's'} from Couples
                    </div>
                    <p className="text-xs text-purple-700 mt-0.5">
                      Couples have sent messages in the Couples Portal Chat requiring your review or response.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSection('chat')}
                  className="btn-primary text-xs font-bold text-white bg-[#4A1942] hover:bg-[#3b1435] px-3.5 py-2 rounded-lg transition-colors shrink-0 shadow-sm"
                  style={{ backgroundColor: config.primaryColor || '#4A1942' }}
                >
                  Open Portal Chat &amp; Reply →
                </button>
              </div>
            )}

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
              <Card className="p-4">
                <div className="text-2xl font-bold">{stats.active}</div>
                <div className="text-xs text-gray-500 mt-0.5">Active couples</div>
              </Card>
              <button
                type="button"
                onClick={() => setSection('couples')}
                className="rounded-xl bg-white border border-gray-200 shadow-sm p-4 text-left hover:border-[#4A1942] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A1942]"
                title="Open Couples Portal to review layouts"
                aria-label={`${stats.pending} awaiting layout review`}
              >
                <div className={`text-2xl font-bold ${stats.pending > 0 ? 'text-amber-600' : ''}`}>{stats.pending}</div>
                <div className="text-xs text-gray-500 mt-0.5">Awaiting layout review</div>
              </button>
              <Card className="p-4">
                <div className="text-2xl font-bold text-sky-700">{stats.setupTotal > 0 ? `${Math.round((stats.setupDone / stats.setupTotal) * 100)}%` : '—'}</div>
                <div className="text-xs text-gray-500 mt-0.5">Setup ({stats.setupDone}/{stats.setupTotal})</div>
              </Card>
              <Card className="p-4">
                <div className={`text-2xl font-bold ${stats.overnightTotal > stats.overnightCap ? 'text-red-600' : 'text-[#4A1942]'}`}>{stats.overnightTotal}<span className="text-sm text-gray-400">/{stats.overnightCap}</span></div>
                <div className="text-xs text-gray-500 mt-0.5">Overnight guests</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-emerald-600">{calendarEvents.filter((e) => e.category === 'open-house').length}</div>
                <div className="text-xs text-gray-500 mt-0.5">Open houses</div>
              </Card>
              <button
                type="button"
                onClick={() => setSection('chat')}
                className="rounded-xl bg-white border border-gray-200 shadow-sm p-4 text-left hover:border-[#4A1942] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A1942]"
                title="Open Portal Chat to view unread messages"
                aria-label={`${stats.unread} unread couple messages`}
              >
                <div className={`text-2xl font-bold ${stats.unread > 0 ? 'text-rose-600' : 'text-gray-700'}`}>{stats.unread}</div>
                <div className="text-xs text-gray-500 mt-0.5">Unread couple msgs</div>
              </button>
              <button
                type="button"
                onClick={() => setSection('calendar')}
                className="rounded-xl bg-white border border-gray-200 shadow-sm p-4 text-left hover:border-[#4A1942] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A1942]"
                title="Open the calendar to manage availability"
                aria-label={`${stats.blocked} blocked dates`}
              >
                <div className={`text-2xl font-bold ${stats.blocked > 0 ? 'text-red-600' : 'text-gray-400'}`}>{stats.blocked}</div>
                <div className="text-xs text-gray-500 mt-0.5">Blocked dates</div>
              </button>
            </div>

            {/* Onboarding empty-state for first-time venues */}
            {needsOnboarding && (
              <div
                className="rounded-2xl border-2 border-dashed p-5"
                style={{
                  borderColor: `${config.primaryColor || '#4A1942'}33`,
                  backgroundColor: `${config.primaryColor || '#4A1942'}0B`,
                }}
              >
                <h2
                  className="font-semibold"
                  style={{ color: config.primaryColor || '#4A1942' }}
                >
                  Let&apos;s set up {config.venueName || 'your venue'} 🎉
                </h2>
                <p
                  className="text-sm mt-1"
                  style={{ color: `${config.primaryColor || '#4A1942'}CC` }}
                >
                  A few quick steps to get everything running.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <button
                    type="button"
                    onClick={props.onOpenAdmin}
                    className="rounded-xl bg-white border p-4 text-left transition-colors hover:shadow-sm"
                    style={{ borderColor: `${config.primaryColor || '#4A1942'}33` }}
                  >
                    <div className="text-2xl">🏛️</div>
                    <div className="font-medium mt-1 text-gray-800">{venuesCount === 0 ? 'Add your venue spaces' : 'Manage venue spaces'}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Set up your ceremony, reception, and lodging spaces.</div>
                  </button>
                  <button
                    type="button"
                    onClick={props.onOpenAdmin}
                    className="rounded-xl bg-white border p-4 text-left transition-colors hover:shadow-sm"
                    style={{ borderColor: `${config.primaryColor || '#4A1942'}33` }}
                  >
                    <div className="text-2xl">🎁</div>
                    <div className="font-medium mt-1 text-gray-800">Review packages & add-ons</div>
                    <div className="text-xs text-gray-500 mt-0.5">Confirm your wedding packages and add-on pricing.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection('couples')}
                    className="rounded-xl bg-white border p-4 text-left transition-colors hover:shadow-sm"
                    style={{ borderColor: `${config.primaryColor || '#4A1942'}33` }}
                  >
                    <div className="text-2xl">💍</div>
                    <div className="font-medium mt-1 text-gray-800">{couplesCount === 0 ? 'Create your first couple event' : 'Open Couples Portal'}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Add a booked couple to start planning with them.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection('calendar')}
                    className="rounded-xl bg-white border p-4 text-left transition-colors hover:shadow-sm"
                    style={{ borderColor: `${config.primaryColor || '#4A1942'}33` }}
                  >
                    <div className="text-2xl">📅</div>
                    <div className="font-medium mt-1 text-gray-800">{openHouses === 0 ? 'Schedule an open house' : 'Open the calendar'}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Add monthly open houses, staffing, and venue events.</div>
                  </button>
                </div>
              </div>
            )}

            {/* Today strip */}
            {(() => {
              const todayCouples = coupleEvents.filter((e) => {
                if (e.eventDate === today) return true;
                return (e.days || []).some((d) => d.date === today);
              }).map((e) => ({ id: e.id, title: e.coupleName, category: 'couple' }));
              const todayEvents = [
                ...todayCouples,
                ...calendarEvents.filter((e) => e.date === today || (e.recurrence && recurringDatesForEvent(e, today, today).length > 0)),
              ];
              if (todayEvents.length === 0) return null;
              return (
                <Card className="px-4 py-3 flex items-center gap-3">
                  <span className="text-lg">📌</span>
                  <span className="text-sm font-semibold text-gray-700">Today</span>
                  <div className="flex flex-wrap gap-2">
                    {todayEvents.map((e, i) => (
                      <span
                        key={`${e.id}-${i}`}
                        className="text-xs rounded-full px-2.5 py-1 font-medium"
                        style={{
                          backgroundColor: `${config.primaryColor || '#4A1942'}18`,
                          color: config.primaryColor || '#4A1942',
                        }}
                      >
                        {e.title}
                      </span>
                    ))}
                  </div>
                </Card>
              );
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Upcoming events */}
              <div className="lg:col-span-2 rounded-xl bg-white border border-gray-200 shadow-sm">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold">Upcoming events</h2>
                  <button
                    type="button"
                    onClick={() => setSection('calendar')}
                    className="text-xs hover:underline"
                    style={{ color: config.primaryColor || '#4A1942' }}
                  >
                    Open calendar →
                  </button>
                </div>
                {upcoming.length === 0 ? (
                  <EmptyState
                    icon="📅"
                    title="No upcoming events in the next 60 days"
                    hint="Add open houses, staffing, or venue events to see them here."
                    action={<Button tone="primary" onClick={() => setSection('calendar')}>Schedule an event or open house</Button>}
                  />
                ) : (
                  (() => {
                    const weekEnd = dayKey(new Date(Date.now() + 7 * 86400000));
                    const thisWeek = upcoming.filter((e) => e.date <= weekEnd);
                    const later = upcoming.filter((e) => e.date > weekEnd);
                    const row = (e: any, i: number) => (
                      <div key={`${e.id}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${catChip(e.category)}`}>{e.category === 'couple' ? '💍' : e.category === 'open-house' ? '🏠' : e.category === 'staffing' ? '🛠️' : '📌'}</span>
                        <span className="text-gray-500 w-24">{new Date(e.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        <span className="flex-1 font-medium text-gray-800 truncate">{e.title}</span>
                        {e.id.startsWith('couple-') || e.category === 'couple' ? (
                          <button
                            type="button"
                            onClick={() => openCouplePortal(e.id.replace('couple-', ''))}
                            className="text-xs hover:underline"
                            style={{ color: config.primaryColor || '#4A1942' }}
                          >
                            Open
                          </button>
                        ) : null}
                      </div>
                    );
                    const section = (label: string, items: any[], base: number) => (
                      <div key={label}>
                        <div className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
                        {items.map((e, i) => row(e, base + i))}
                      </div>
                    );
                    return (
                      <div className="divide-y divide-gray-50">
                        {thisWeek.length > 0 && section('This week', thisWeek, 0)}
                        {later.length > 0 && section('Later', later, thisWeek.length)}
                      </div>
                    );
                  })()
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
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              e.category === 'couple'
                                ? 'bg-[#4A1942]/100'
                                : e.category === 'open-house'
                                ? 'bg-emerald-500'
                                : e.category === 'staffing'
                                ? 'bg-amber-500'
                                : 'bg-slate-500'
                            }`}
                            style={
                              e.category === 'couple'
                                ? { backgroundColor: config.primaryColor || '#4A1942' }
                                : undefined
                            }
                          />
                          <span className="text-gray-500 text-xs w-14">{new Date(e.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })}</span>
                          <span className="flex-1 text-gray-700 truncate">{e.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-4">
                  <h2 className="font-semibold mb-3">Quick actions</h2>
                  <div className="space-y-2">
                    <button type="button" onClick={props.onOpenAdmin} className="btn-primary w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#4A1942] text-white text-sm font-medium hover:bg-[#3b1435]" style={{ backgroundColor: config.primaryColor || '#4A1942' }}>
                      <span>🔐</span><span>Admin &amp; System Settings</span>
                    </button>
                    <button type="button" onClick={props.onOpenStudio} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
                      <span>🎨</span><span>Design Studio</span>
                    </button>
                    <button type="button" onClick={() => setSection('calendar')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
                      <span>📅</span><span>Calendar</span>
                    </button>
                    <button type="button" onClick={() => setSection('ops')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
                      <span>🛠️</span><span>Operations Studio</span>
                    </button>
                    <button type="button" onClick={() => setSection('vendors')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
                      <span>🧰</span><span>Vendor Showcase</span>
                    </button>
                    <button type="button" onClick={() => setSection('timeline')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
                      <span>⏱️</span><span>Timeline Studio</span>
                    </button>
                    <button type="button" onClick={() => setSection('chat')} className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
                      <span className="flex items-center gap-2"><span>💬</span><span>Portal Chat &amp; DMs</span></span>
                      {stats.unread > 0 && <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">{stats.unread}</span>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {section === 'calendar' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSection('home')}
                  className="inline-flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                >
                  <span>←</span>
                  <span>Dashboard Home</span>
                </button>
                <h1 className="text-xl font-bold text-gray-800">📅 Venue Calendar</h1>
              </div>
            </div>
            <VenueCalendar venues={venues} onOpenCouple={(id) => openCouplePortal(id)} />
          </div>
        )}

        {section === 'couples' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSection('home')}
                  className="inline-flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                >
                  <span>←</span>
                  <span>Dashboard Home</span>
                </button>
                <h1 className="text-2xl font-bold">💍 Couples Portal</h1>
              </div>
              {coupleEvents.some((e) => e.layoutStatus === 'pending' || e.layoutStatus === 'changes_requested') && (
                <Button tone="primary" size="sm" onClick={props.onOpenAdmin}>
                  Review &amp; approve layouts in Admin
                </Button>
              )}
            </div>
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
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => openCouplePortal(e.id)}
                      className="text-xs hover:underline font-semibold"
                      style={{ color: config.primaryColor || '#4A1942' }}
                    >
                      Open couple portal →
                    </button>
                    {(e.layoutStatus === 'pending' || e.layoutStatus === 'changes_requested') && (
                      <button type="button" onClick={props.onOpenAdmin} className="text-xs text-amber-700 hover:underline">Review →</button>
                    )}
                  </div>
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

        {section === 'chat' && (
          <div className="h-[calc(100vh-2rem)] overflow-hidden">
            {props.chatNode || (
              <VenueChatPanel
                user={props.user}
                isAdmin={props.isAdmin}
                inline
                onClose={() => setSection('home')}
                users={props.users}
              />
            )}
          </div>
        )}

      </main>
    </div>
  );
}
