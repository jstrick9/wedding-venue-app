import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  User, StaffTask, StaffArea, StaffShift, StaffTaskPhase, StaffTaskStatus, 
  StaffTaskPriority, ChecklistItem, OperationsExport, Venue
} from '../types';
import { useBrandingConfig } from '../config';
import EmojiPicker from './EmojiPicker';
import { canAccessOperationsPanel, canManageOperationsData } from '../utils/permissions';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { emitDataChanged, on } from '../utils/appEvents';
import { showToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { toLocalDatetimeInput, fromLocalDatetimeInput } from '../utils/dateTime';
import { getCoupleEvents } from '../services/couples/coupleService';
import { findWeddingPackage } from '../services/couples/couplePackageService';
import { useTimeline } from '../hooks/useTimeline';
import { getOperationsChecklistDefaults, getOperationalZoneDefaults } from './admin/OperationsSettingsManagement';

interface Props {
  onClose: () => void;
  currentUser: User;
  isAdmin: boolean;
  venueId?: string;
  eventName?: string;
  users: User[];
  venues: Venue[];
  /** When true, renders inline (not a full-screen overlay) for dashboard embedding. */
  inline?: boolean;
}

const PHASES: StaffTaskPhase[] = ['pre-event', 'during-event', 'post-event'];
const STATUSES: StaffTaskStatus[] = ['not-started', 'in-progress', 'completed', 'blocked'];
const PRIORITIES: StaffTaskPriority[] = ['low', 'medium', 'high', 'critical'];

const normalizedPhase = (phase: string): StaffTaskPhase => {
  if (phase === 'setup') return 'pre-event';
  if (phase === 'teardown') return 'post-event';
  if (PHASES.includes(phase as any)) return phase as StaffTaskPhase;
  return 'pre-event';
};

const StaffOperationsPanel: React.FC<Props> = ({ 
  onClose, 
  currentUser, 
  isAdmin, 
  venueId, 
  eventName,
  users,
  venues,
  inline = false,
}) => {
  const config = useBrandingConfig();
  const canAccessPanel = canAccessOperationsPanel(currentUser);
  const canMutateOperations = canManageOperationsData(currentUser);
  const [activeTab, setActiveTab] = useState<'overview' | 'beo' | 'tasks' | 'areas' | 'shifts' | 'checklists' | 'export'>('overview');
  const [checklistSearch, setChecklistSearch] = useState('');
  const [beoCoupleId, setBeoCoupleId] = useState<string | null>(null);
  const { getTimelineForCouple } = useTimeline();

  if (!canAccessPanel) {
    return (
      <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl bg-white shadow-xl p-6">
          <h2 className="text-xl font-semibold text-red-700">Access denied</h2>
          <p className="mt-2 text-sm text-gray-600">
            You do not have permission to access staff operations.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white"
          >
            Close
          </button>
        </div>
      </div>
    );
  }
  
  // Data State
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [areas, setAreas] = useState<StaffArea[]>([]);
  const [shifts, setShifts] = useState<StaffShift[]>([]);
  
  // UI State
  const [taskView, setTaskView] = useState<'kanban' | 'list'>('kanban');
  const [taskSearch, setTaskSearch] = useState('');
  const [taskFilterStaff, setTaskFilterStaff] = useState<string>('all');
  const [hideCompletedChecklist, setHideCompletedChecklist] = useState(false);
  const [selectedTaskId, setSelectedId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [shiftView, setShiftView] = useState<'timeline' | 'list'>('timeline');
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'task' | 'area' | 'shift'; id: string } | null>(null);
  const [pendingImport, setPendingImport] = useState<{ tasks: any[]; areas: any[]; shifts: any[] } | null>(null);
  const [confirmResetChecklists, setConfirmResetChecklists] = useState(false);
  
  // Load Data
  useEffect(() => {
    const loadData = () => {
      const savedTasks = localStorage.getItem(STORAGE_KEYS.STAFF_TASKS);
      const savedAreas = localStorage.getItem(STORAGE_KEYS.STAFF_AREAS);
      const savedShifts = localStorage.getItem(STORAGE_KEYS.STAFF_SHIFTS);
      // Parse defensively: corrupted/unexpected data must not crash the panel.
      const safeParse = (raw: string | null, key: string) => {
        if (!raw) return null;
        try {
          const v = JSON.parse(raw);
          return Array.isArray(v) ? v : null;
        } catch {
          try {
            localStorage.setItem(`${key}_backup_${Date.now()}`, raw);
          } catch {}
          return null;
        }
      };
      const t = safeParse(savedTasks, STORAGE_KEYS.STAFF_TASKS);
      const a = safeParse(savedAreas, STORAGE_KEYS.STAFF_AREAS);
      const s = safeParse(savedShifts, STORAGE_KEYS.STAFF_SHIFTS);
      if (t) setTasks(t);
      if (a) setAreas(a);
      if (s) setShifts(s);
    };

    loadData();
    return on('spm_data_changed', loadData);
  }, []);

  // Save Helpers
  const saveTasks = (newTasks: StaffTask[]) => {
    setTasks(newTasks);
    localStorage.setItem(STORAGE_KEYS.STAFF_TASKS, JSON.stringify(newTasks));
    emitDataChanged();
  };

  const saveAreas = (newAreas: StaffArea[]) => {
    setAreas(newAreas);
    localStorage.setItem(STORAGE_KEYS.STAFF_AREAS, JSON.stringify(newAreas));
    emitDataChanged();
  };

  const saveShifts = (newShifts: StaffShift[]) => {
    setShifts(newShifts);
    localStorage.setItem(STORAGE_KEYS.STAFF_SHIFTS, JSON.stringify(newShifts));
    emitDataChanged();
  };

  const handleLoadAdminDefaults = () => {
    if (!canMutateOperations) return;
    const adminChecklists = getOperationsChecklistDefaults();
    const adminZones = getOperationalZoneDefaults();

    // Ensure all admin operational zones exist in areas
    const nextAreas = [...areas];
    adminZones.forEach((z) => {
      if (!nextAreas.some((a) => a.name.toLowerCase() === z.name.toLowerCase())) {
        nextAreas.push({
          id: z.id,
          name: z.name,
          description: z.description,
          venueId: venueId || venues[0]?.id || '',
          color: '#4A1942',
          icon: '📍',
          assignedStaff: [],
        });
      }
    });

    // Create or populate phase tasks with standard checklist items
    const nextTasks = [...tasks];
    adminChecklists.forEach((item) => {
      let phaseKey: StaffTaskPhase = 'pre-event';
      if (item.phase === 'setup' || item.phase === 'ceremony') phaseKey = 'during-event';
      if (item.phase === 'reception' || item.phase === 'takedown') phaseKey = 'post-event';

      const existingTask = nextTasks.find(
        (t) => normalizedPhase(t.phase) === phaseKey && t.title.toLowerCase().includes(item.phase)
      );

      if (existingTask) {
        if (!existingTask.checklist.some((ci) => ci.label === item.text)) {
          existingTask.checklist.push({
            id: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            label: item.text,
            completed: false,
          });
        }
      } else {
        nextTasks.push({
          id: `task-default-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: `${item.phase.toUpperCase()}: Operations Checklist`,
          description: `Standard operational workflow for ${item.phase} phase.`,
          phase: phaseKey,
          priority: 'high',
          status: 'not-started',
          assignedStaff: [],
          assignedAreas: nextAreas.length > 0 ? [nextAreas[0].id] : [],
          tags: [],
          checklist: [
            {
              id: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              label: item.text,
              completed: false,
            },
          ],
          createdAt: new Date().toISOString(),
          createdBy: currentUser.id,
        });
      }
    });

    saveAreas(nextAreas);
    saveTasks(nextTasks);
    showToast('Loaded standard operational areas and phase checklists from Admin Settings.', 'success');
  };

  // --- Handlers ---
  const handleAddTask = (phase: StaffTaskPhase) => {
    if (!canMutateOperations) return;
    const newTask: StaffTask = {
      id: `task-${Date.now()}`,
      title: 'New Task',
      phase,
      status: 'not-started',
      priority: 'medium',
      assignedStaff: [],
      assignedAreas: [],
      tags: [],
      checklist: [],
      createdAt: new Date().toISOString(),
      createdBy: currentUser.id,
    };
    saveTasks([newTask, ...tasks]);
    setSelectedId(newTask.id);
  };

  const handleUpdateTask = (id: string, updates: Partial<StaffTask>) => {
    if (!canMutateOperations) return;
    const newTasks = tasks.map(t => {
      if (t.id === id) {
        const updated = { ...t, ...updates, updatedAt: new Date().toISOString(), updatedBy: currentUser.id };
        if (updates.status === 'completed' && t.status !== 'completed') {
          updated.completedAt = new Date().toISOString();
          updated.completedBy = currentUser.id;
        }
        return updated;
      }
      return t;
    });
    saveTasks(newTasks);
  };

  const handleDeleteTask = (id: string) => {
    if (!canMutateOperations) return;
    setPendingDelete({ kind: 'task', id });
  };

  const handleAddArea = () => {
    if (!canMutateOperations) return;
    const newArea: StaffArea = {
      id: `area-${Date.now()}`,
      name: 'New Operational Area',
      color: config.primaryColor,
      icon: '📍',
      assignedStaff: [],
      venueId: venueId || (venues && venues.length > 0 ? venues[0].id : '')
    };
    saveAreas([...areas, newArea]);
    setSelectedAreaId(newArea.id);
  };

  const handleUpdateArea = (id: string, updates: Partial<StaffArea>) => {
    if (!canMutateOperations) return;
    saveAreas(areas.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const handleDeleteArea = (id: string) => {
    if (!canMutateOperations) return;
    setPendingDelete({ kind: 'area', id });
  };

  const handleAddShift = () => {
    if (!canMutateOperations) return;
    const now = new Date();
    const end = new Date(now.getTime() + 4 * 60 * 60 * 1000); // +4 hours
    const newShift: StaffShift = {
      id: `shift-${Date.now()}`,
      staffId: currentUser.id,
      role: 'coordinator',
      startTime: now.toISOString(),
      endTime: end.toISOString(),
      venueId: venueId || (venues && venues.length > 0 ? venues[0].id : ''),
      eventName: eventName || 'Current Event'
    };
    saveShifts([...shifts, newShift]);
    setSelectedShiftId(newShift.id);
  };

  const handleUpdateShift = (id: string, updates: Partial<StaffShift>) => {
    if (!canMutateOperations) return;
    saveShifts(shifts.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleDeleteShift = (id: string) => {
    if (!canMutateOperations) return;
    setPendingDelete({ kind: 'shift', id });
  };

  // --- Helpers ---
  const staffUsers = useMemo(() => users.filter(u => u.role === 'staff' || u.role === 'admin'), [users]);
  const getStaffName = (id: string) => users.find(u => u.id === id)?.name || 'Unknown';
  const getVenueName = (id: string) => venues.find(v => v.id === id)?.name || 'N/A';

  const isShiftConflicting = useCallback(
    (shift: StaffShift): boolean => {
      return shifts.some((other) => {
        if (other.id === shift.id || other.staffId !== shift.staffId) return false;
        const startA = new Date(shift.startTime).getTime();
        const endA = new Date(shift.endTime).getTime();
        const startB = new Date(other.startTime).getTime();
        const endB = new Date(other.endTime).getTime();
        return startA < endB && startB < endA;
      });
    },
    [shifts],
  );

  // --- Render Tabs ---
  
  const renderOverview = () => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const blocked = tasks.filter(t => t.status === 'blocked').length;
    const myTasks = tasks.filter(t => t.assignedStaff.includes(currentUser.id));
    const conflictingShifts = shifts.filter((s) => isShiftConflicting(s));

    return (
      <div className="space-y-6">
        {/* BEO & Conflict Quick Action Banners */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            className="text-white p-5 rounded-xl shadow-sm flex flex-col justify-between gap-3"
            style={{
              background: `linear-gradient(to right, ${config.primaryColor || '#4A1942'}, ${
                config.primaryDark || config.primaryColor || '#3d1a45'
              })`,
            }}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">📜</span>
                <h3 className="font-bold text-base">Master Banquet Event Order (BEO)</h3>
              </div>
              <p className="text-xs text-white/80 leading-relaxed">
                Generate, view, and print the single sheet that drives your wedding day: timeline, room layout, headcount, catering/bar menu, staff schedule, and checklists.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('beo')}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-colors self-start"
            >
              📜 Open BEO Sheet →
            </button>
          </div>

          {conflictingShifts.length > 0 ? (
            <div className="bg-amber-50 border border-amber-300 p-5 rounded-xl shadow-sm flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  <h3 className="font-bold text-base text-amber-900">
                    Schedule Conflict Detected
                  </h3>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  {conflictingShifts.length} staff shift(s) have overlapping hours or conflicting area assignments. Check the schedule to resolve double-bookings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('shifts')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors self-start"
              >
                🕒 View Shift Schedule →
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl shadow-sm flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">✅</span>
                  <h3 className="font-bold text-base text-emerald-900">
                    Staff Schedule Status: All Clear
                  </h3>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  All {shifts.length} scheduled staff shifts are clear of overlapping hours across {areas.length} operational zones.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('shifts')}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors self-start"
              >
                🕒 Manage Shifts →
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-gray-900">
          <StatCard label="Total Tasks" value={total} color="text-gray-900" onClick={() => setActiveTab('tasks')} />
          <StatCard label="Completed" value={completed} color="text-green-600" onClick={() => setActiveTab('tasks')} />
          <StatCard label="Blocked" value={blocked} color="text-red-600" onClick={() => setActiveTab('tasks')} />
          <StatCard label="My Tasks" value={myTasks.length} color="text-purple-600" onClick={() => setActiveTab('tasks')} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Phase Progress</h3>
            <div className="space-y-4">
              {PHASES.map(phase => {
                const phaseTasks = tasks.filter(t => t.phase === phase);
                const pct = phaseTasks.length > 0 ? Math.round((phaseTasks.filter(t => t.status === 'completed').length / phaseTasks.length) * 100) : 0;
                return (
                  <div key={phase}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize font-medium text-gray-700">{phase.replace('-', ' ')}</span>
                      <span className="text-gray-500">{pct}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 transition-all" style={{ width: `${pct}%`, backgroundColor: config.primaryColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">My Tasks</h3>
            <div className="space-y-3">
              {myTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500 italic">No tasks assigned to you.</div>
              ) : (
                myTasks.slice(0, 5).map(task => (
                  <div key={task.id} onClick={() => { setSelectedId(task.id); setActiveTab('tasks'); }} className="flex items-center p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                    <PriorityDot priority={task.priority} />
                    <div className="flex-1 min-w-0 ml-3">
                      <div className="text-sm font-bold truncate text-gray-900">{task.title}</div>
                      <div className="text-xs text-gray-500 capitalize">{task.dueTime || 'No time'} • {task.status.replace('-', ' ')}</div>
                    </div>
                    <span className="text-gray-400">➜</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBEOContent = (isPrintView: boolean) => {
    const coupleEvents = getCoupleEvents();
    const selectedCouple =
      coupleEvents.find((c) => c.id === beoCoupleId) || coupleEvents[0] || null;

    if (!selectedCouple) {
      return (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-500 space-y-4">
          <div className="text-5xl">📜</div>
          <h3 className="text-lg font-bold text-gray-800">No Booked Couple Event Available</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Banquet Event Orders (BEOs) require an active couple booking. Create a couple event in the Couples Portal or Admin settings to generate a BEO sheet.
          </p>
        </div>
      );
    }

    const pkg = findWeddingPackage(selectedCouple.packageId);
    const timeline = getTimelineForCouple(selectedCouple.id);
    const timelineEvents = timeline ? timeline.days.flatMap((d: any) => d.events) : [];
    const conflictingShiftsCount = shifts.filter((s) => isShiftConflicting(s)).length;

    const portalLink = `${window.location.origin}${window.location.pathname}#/couples-portal?token=${encodeURIComponent(selectedCouple.inviteToken)}`;

    return (
      <div className="space-y-6">
        {!isPrintView && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <label htmlFor="beo-couple-select" className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Select Couple Event:
              </label>
              <select
                id="beo-couple-select"
                value={selectedCouple.id}
                onChange={(e) => setBeoCoupleId(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 bg-white min-w-[240px]"
              >
                {coupleEvents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.coupleName} ({c.eventDate ? new Date(c.eventDate).toLocaleDateString() : 'No date'} • {c.guestCount || 0} guests)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => window.open(portalLink, '_blank')}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors shadow-sm"
              >
                💍 Open Couples Portal ↗
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(portalLink);
                  showToast('Couples Portal invitation link copied to clipboard', 'success');
                }}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors shadow-sm"
                title="Copy direct Couples Portal invite link"
              >
                📋 Copy Portal Link
              </button>
              <button
                type="button"
                onClick={() => {
                  const subject = `Your Wedding Planning Portal — ${selectedCouple.coupleName}`;
                  const body = `Hi ${selectedCouple.coupleName},\n\nWe're so excited to work with you on your wedding!\n\nHere is your private link to access your Couples Portal, where you can design your floor layouts, manage your guest list & RSVPs, view wedding packages, and chat directly with our venue team:\n\n${portalLink}\n\nWarm regards,\nThe Seven Paths Manor Team`;
                  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                  showToast('Opening default email app with couple invite', 'info');
                }}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors shadow-sm"
                title="Open default email client with pre-drafted Couples Portal invite link"
              >
                ✉️ Email Invite
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  showToast('Copied BEO page reference link to clipboard', 'success');
                }}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors shadow-sm"
              >
                📋 Copy BEO Link
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => { window.location.hash = '#/admin'; }}
                  className="px-3 py-1.5 rounded-lg bg-[#4A1942] hover:bg-[#3b1435] text-white text-xs font-bold transition-colors shadow-sm"
                  style={{ backgroundColor: config.primaryColor || '#4A1942' }}
                >
                  ⚙️ Configure BEO Default Wording in Admin
                </button>
              )}
            </div>
          </div>
        )}

        {/* Master BEO Sheet Card */}
        <div className="bg-white rounded-2xl border border-gray-300 shadow-lg p-8 space-y-8 text-gray-900">
          {/* Header Banner */}
          <div className="border-b-2 border-[#4A1942] pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ borderColor: config.primaryColor || '#4A1942' }}>
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-[#4A1942]" style={{ color: config.primaryColor || '#4A1942' }}>
                {config.venueName || 'Seven Paths Manor'} • Master Operational Document
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-1">
                BANQUET EVENT ORDER (BEO)
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                BEO Ref: <strong>BEO-2026-{selectedCouple.id.slice(0, 8).toUpperCase()}</strong> • Generated {new Date().toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-col items-start md:items-end gap-1">
              <span className="text-xs font-semibold text-gray-500">Layout Approval Status</span>
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                selectedCouple.layoutStatus === 'approved'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {selectedCouple.layoutStatus}
              </span>
            </div>
          </div>

          {/* Section 1: Event & Client Summary */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-[#4A1942] border-b pb-2 mb-4 flex items-center gap-2" style={{ color: config.primaryColor || '#4A1942', borderColor: config.primaryColor || '#4A1942' }}>
              <span>🏛️ Section 1: Event &amp; Client Summary</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="text-gray-500 font-semibold">Couple / Client Name</div>
                <div className="font-bold text-gray-900 text-sm mt-0.5">{selectedCouple.coupleName}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="text-gray-500 font-semibold">Event Date</div>
                <div className="font-bold text-gray-900 text-sm mt-0.5">
                  {selectedCouple.eventDate ? new Date(selectedCouple.eventDate).toLocaleDateString() : 'Not set'}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="text-gray-500 font-semibold">Expected Guest Count</div>
                <div className="font-bold text-gray-900 text-sm mt-0.5">{selectedCouple.guestCount || 0} Guests</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="text-gray-500 font-semibold">Portal Reference Token</div>
                <div className="font-mono font-bold text-gray-900 text-xs mt-0.5">{selectedCouple.inviteToken}</div>
              </div>
            </div>
          </div>

          {/* Section 2: Room & Layout Setup */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-[#4A1942] border-b pb-2 mb-4 flex items-center gap-2" style={{ color: config.primaryColor || '#4A1942', borderColor: config.primaryColor || '#4A1942' }}>
              <span>🪑 Section 2: Room, Layout &amp; Seating Setup</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200">
                <div className="text-gray-500 font-semibold">Configured Venue Spaces</div>
                <div className="font-bold text-gray-900 text-sm mt-0.5">
                  {selectedCouple.selectedSpaces && selectedCouple.selectedSpaces.length > 0
                    ? selectedCouple.selectedSpaces.join(', ')
                    : 'Main Manor & Great Hall, Ceremony Lawn'}
                </div>
              </div>
              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200">
                <div className="text-gray-500 font-semibold">Placed Tables &amp; Seating Capacity</div>
                <div className="font-bold text-gray-900 text-sm mt-0.5">
                  Standard Banquet Seating per Approved Layout
                </div>
              </div>
              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200">
                <div className="text-gray-500 font-semibold">Staging &amp; Special Fixtures</div>
                <div className="font-bold text-gray-900 text-sm mt-0.5">
                  DJ Table, Gift Table, Cake Foyer Stage
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Chronological Wedding Schedule */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-[#4A1942] border-b pb-2 mb-4 flex items-center justify-between" style={{ color: config.primaryColor || '#4A1942', borderColor: config.primaryColor || '#4A1942' }}>
              <span>⏱️ Section 3: Chronological Wedding Day Schedule &amp; Milestones</span>
              <span className="text-xs font-normal text-gray-500">
                {timelineEvents.length} scheduled milestone(s)
              </span>
            </h3>
            {timelineEvents.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-gray-300 rounded-xl text-gray-500 text-xs">
                No timeline milestones configured yet for this couple. Create a timeline in the Timeline Studio.
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden divide-y divide-gray-200 text-xs">
                <div className="bg-gray-100 font-bold text-gray-700 grid grid-cols-12 px-4 py-2.5">
                  <div className="col-span-3">Time Window</div>
                  <div className="col-span-5">Event Milestone</div>
                  <div className="col-span-4">Location / Zone</div>
                </div>
                {timelineEvents.map((ev: any) => (
                  <div key={ev.id} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-gray-50">
                    <div className="col-span-3 font-mono font-bold text-gray-900">
                      {ev.startTime} – {ev.endTime}
                    </div>
                    <div className="col-span-5 font-bold text-gray-900">
                      {ev.title}
                    </div>
                    <div className="col-span-4 text-gray-600">
                      {ev.location || 'Main Manor'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Catering, Bar & Dietary Notes */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-[#4A1942] border-b pb-2 mb-4 flex items-center gap-2" style={{ color: config.primaryColor || '#4A1942', borderColor: config.primaryColor || '#4A1942' }}>
              <span>🍽️ Section 4: Catering, Bar Service &amp; Dietary Requirements</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                <div className="font-bold text-gray-900 text-sm">Selected Wedding Package</div>
                <div className="text-gray-700">
                  {pkg ? pkg.name : 'Standard Manor Weekend Package'} • {selectedCouple.guestCount || 0} Guests
                </div>
                <div className="text-gray-500 text-xs pt-1 border-t border-gray-200">
                  Bar Service: Licensed bartending required; all ABC regulations and venue closing hours strictly enforced.
                </div>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-300 space-y-2">
                <div className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                  <span>⚠️</span> Dietary Notes &amp; Allergen Policy
                </div>
                <p className="text-amber-800 text-xs leading-relaxed">
                  Catering staff must confirm vegetarian, vegan, and allergen meal accommodations during RSVP check-in. Kitchen prep must maintain separate staging for peanut, tree nut, and shellfish allergies.
                </p>
              </div>
            </div>
          </div>

          {/* Section 5: Staff Shift Roster & Operational Zone Allocations */}
          <div>
            <div className="flex items-center justify-between border-b pb-2 mb-4" style={{ borderColor: config.primaryColor || '#4A1942' }}>
              <h3 className="text-sm font-black uppercase tracking-wider text-[#4A1942] flex items-center gap-2" style={{ color: config.primaryColor || '#4A1942' }}>
                <span>🕒 Section 5: Staff Shift Roster &amp; Operational Zone Allocations</span>
              </h3>
              {conflictingShiftsCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-xs">
                  ⚠️ {conflictingShiftsCount} Shift Conflict(s)
                </span>
              )}
            </div>
            {shifts.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-gray-300 rounded-xl text-gray-500 text-xs">
                No staff shifts scheduled yet. Add shifts in the Shifts tab.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {shifts.map((shift) => {
                  const u = users.find((usr) => usr.id === shift.staffId);
                  const a = areas.find((ar) => ar.id === shift.areaId);
                  const conflict = isShiftConflicting(shift);
                  return (
                    <div
                      key={shift.id}
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        conflict
                          ? 'bg-amber-50 border-amber-300'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-gray-900">
                          {u?.name || 'Unassigned Staff'} • <span className="uppercase text-[10px] text-purple-700">{shift.role}</span>
                        </div>
                        <div className="text-gray-500 mt-0.5">
                          📍 {a?.name || 'General Venue Area'}
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-gray-700">
                        {new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 6: Event-Day Operational Checklists by Phase */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-[#4A1942] border-b pb-2 mb-4 flex items-center gap-2" style={{ color: config.primaryColor || '#4A1942', borderColor: config.primaryColor || '#4A1942' }}>
              <span>📝 Section 6: Event-Day Operational Checklists by Phase</span>
            </h3>
            <div className="space-y-4 text-xs">
              {PHASES.map((phase) => {
                const phaseTasks = tasks.filter((t) => normalizedPhase(t.phase) === phase);
                const items = phaseTasks.flatMap((t) => t.checklist);
                if (items.length === 0) return null;
                return (
                  <div key={phase} className="border rounded-xl p-4 bg-gray-50/50 space-y-2">
                    <h4 className="font-bold text-gray-800 uppercase tracking-wide">
                      {phase.replace('-', ' ')} Phase Checklists ({items.filter((i) => i.completed).length}/{items.length} Complete)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {items.map((ci) => (
                        <div key={ci.id} className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-gray-200">
                          <span className={`w-4 h-4 rounded border flex items-center justify-center font-bold text-[10px] ${
                            ci.completed ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-gray-300 text-transparent'
                          }`}>
                            ✓
                          </span>
                          <span className={`flex-1 ${ci.completed ? 'line-through text-gray-400' : 'text-gray-800 font-medium'}`}>
                            {ci.label || (ci as any).text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 7: Formal Sign-Off & Authorization Block */}
          <div className="pt-6 border-t-2 border-gray-300">
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-700 mb-6">
              ✍️ Section 7: Formal BEO Sign-Off &amp; Operational Authorization
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
              <div className="space-y-6">
                <div className="border-b-2 border-gray-800 pb-1"></div>
                <div className="flex justify-between items-center text-gray-600">
                  <span className="font-bold">Venue Operations Manager Signature</span>
                  <span>Date: _______________</span>
                </div>
                <div className="text-gray-400 text-[11px]">
                  Seven Paths Manor — Wedding &amp; Event Operations Team
                </div>
              </div>

              <div className="space-y-6">
                <div className="border-b-2 border-gray-800 pb-1"></div>
                <div className="flex justify-between items-center text-gray-600">
                  <span className="font-bold">Couple / Client Authorization Signature</span>
                  <span>Date: _______________</span>
                </div>
                <div className="text-gray-400 text-[11px]">
                  {selectedCouple.coupleName} • I confirm that all BEO details above are correct.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBEO = () => renderBEOContent(false);

  const renderTasks = () => {
    const selectedTask = tasks.find(t => t.id === selectedTaskId);
    const filteredTasks = tasks.filter(t => {
      if (taskFilterStaff !== 'all' && !t.assignedStaff.includes(taskFilterStaff)) return false;
      if (
        taskSearch.trim() &&
        !t.title.toLowerCase().includes(taskSearch.toLowerCase()) &&
        !t.description?.toLowerCase().includes(taskSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <div className="flex gap-2">
            <button onClick={() => setTaskView('kanban')} className={`px-4 py-2 rounded-lg text-sm font-medium ${taskView === 'kanban' ? 'bg-purple-600 text-white' : 'bg-white border text-gray-600'}`} style={taskView === 'kanban' ? { backgroundColor: config.primaryColor } : {}}>Kanban</button>
            <button onClick={() => setTaskView('list')} className={`px-4 py-2 rounded-lg text-sm font-medium ${taskView === 'list' ? 'bg-purple-600 text-white' : 'bg-white border text-gray-600'}`} style={taskView === 'list' ? { backgroundColor: config.primaryColor } : {}}>List</button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadAdminDefaults}
              disabled={!canMutateOperations}
              className="px-3.5 py-2 rounded-lg border border-purple-200 bg-purple-50 text-purple-900 text-xs font-bold hover:bg-purple-100 transition-colors disabled:opacity-40"
            >
              ➕ Load Checklists from Admin
            </button>
            <button
              type="button"
              onClick={() => handleAddTask('pre-event')}
              disabled={!canMutateOperations}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: config.primaryColor }}
            >
              + Add Task
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mb-4 bg-white p-3 rounded-xl border border-gray-200 flex-wrap shadow-sm">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <span className="text-gray-400">🔍</span>
            <input
              type="text"
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              placeholder="Search tasks..."
              aria-label="Search tasks"
              className="text-sm bg-transparent outline-none flex-1 text-gray-800"
            />
            {taskSearch && (
              <button
                type="button"
                onClick={() => setTaskSearch('')}
                className="text-xs text-gray-400 hover:text-gray-600"
                aria-label="Clear task search"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="task-staff-filter" className="text-xs font-semibold text-gray-500">
              Staff:
            </label>
            <select
              id="task-staff-filter"
              value={taskFilterStaff}
              onChange={(e) => setTaskFilterStaff(e.target.value)}
              aria-label="Filter tasks by staff member"
              className="text-xs border rounded-lg px-2 py-1 bg-white text-gray-700"
            >
              <option value="all">All staff</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
              {filteredTasks.length} / {tasks.length}
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {taskView === 'kanban' ? (
            <div className="grid grid-cols-3 gap-6 h-full overflow-hidden">
              {PHASES.map(phase => (
                <div key={phase} className="flex flex-col h-full bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4 flex justify-between">
                    {phase.replace('-', ' ')}
                    <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs font-normal">
                      {filteredTasks.filter(t => normalizedPhase(t.phase) === phase).length}
                    </span>
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {filteredTasks.filter(t => normalizedPhase(t.phase) === phase).map(task => (
                      <div 
                        key={task.id} 
                        onClick={() => setSelectedId(task.id)}
                        className={`bg-white p-4 rounded-xl border shadow-sm cursor-pointer hover:border-purple-400 transition-all ${selectedTaskId === task.id ? 'ring-2 ring-purple-500 border-transparent' : 'border-gray-200'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <PriorityBadge priority={task.priority} />
                          <StatusBadge status={task.status} />
                        </div>
                        <div className="text-sm font-bold text-gray-900 mb-3 leading-snug">{task.title}</div>
                        <div className="flex items-center justify-between">
                          <div className="flex -space-x-2 overflow-hidden">
                            {task.assignedStaff.map(id => (
                              <div key={id} className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-purple-100 flex items-center justify-center text-[10px] font-bold text-purple-700" title={getStaffName(id)}>
                                {getStaffName(id).charAt(0)}
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center text-[10px] text-gray-400 font-medium">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-gray-200"></span>
                              {task.checklist.filter(i => i.completed).length}/{task.checklist.length}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-6 py-3">Title</th>
                    <th className="px-6 py-3">Phase</th>
                    <th className="px-6 py-3">Priority</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Assigned</th>
                    <th className="px-6 py-3">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTasks.map(task => (
                    <tr key={task.id} onClick={() => setSelectedId(task.id)} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-6 py-4 font-bold text-gray-900">{task.title}</td>
                      <td className="px-6 py-4 capitalize text-gray-600">{normalizedPhase(task.phase).replace('-', ' ')}</td>
                      <td className="px-6 py-4"><PriorityBadge priority={task.priority} /></td>
                      <td className="px-6 py-4"><StatusBadge status={task.status} /></td>
                      <td className="px-6 py-4 text-gray-600">{task.assignedStaff.length} staff</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${task.checklist.length > 0 ? (task.checklist.filter(i => i.completed).length / task.checklist.length) * 100 : 0}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400 font-bold">{task.checklist.filter(i => i.completed).length}/{task.checklist.length}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Task Detail Panel Overlay */}
        {selectedTask && (
          <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-end">
            <div className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <header className="p-6 border-b flex justify-between items-center bg-gray-50">
                <h2 className="text-xl font-bold text-gray-900">Task Details</h2>
                <button onClick={() => setSelectedId(null)} aria-label="Close task details" className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">✕</button>
              </header>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                  <input 
                    type="text" 
                    value={selectedTask.title} 
                    onChange={e => handleUpdateTask(selectedTask.id, { title: e.target.value })}
                    className="w-full text-lg font-bold border-b border-transparent focus:border-purple-500 outline-none py-1 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                  <textarea 
                    value={selectedTask.description || ''} 
                    onChange={e => handleUpdateTask(selectedTask.id, { description: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2 h-24 focus:ring-2 focus:ring-purple-500 outline-none text-gray-700"
                    placeholder="Add details about this task..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phase</label>
                    <select 
                      value={selectedTask.phase}
                      onChange={e => handleUpdateTask(selectedTask.id, { phase: e.target.value as any })}
                      className="w-full border rounded-lg p-2 text-sm text-gray-700 bg-white"
                    >
                      {PHASES.map(p => <option key={p} value={p}>{p.replace('-', ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Priority</label>
                    <select 
                      value={selectedTask.priority}
                      onChange={e => handleUpdateTask(selectedTask.id, { priority: e.target.value as any })}
                      className="w-full border rounded-lg p-2 text-sm text-gray-700 bg-white"
                    >
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                  <select 
                    value={selectedTask.status}
                    onChange={e => handleUpdateTask(selectedTask.id, { status: e.target.value as any })}
                    className="w-full border rounded-lg p-2 text-sm font-bold text-purple-700 bg-purple-50"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace('-', ' ')}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Assign Staff</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedTask.assignedStaff.map(id => (
                      <div key={id} className="flex items-center gap-2 px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold border border-purple-100">
                        {getStaffName(id)}
                        <button onClick={() => handleUpdateTask(selectedTask.id, { assignedStaff: selectedTask.assignedStaff.filter(sid => sid !== id) })} aria-label="Remove assigned staff" className="hover:text-red-500">✕</button>
                      </div>
                    ))}
                  </div>
                  <select 
                    onChange={e => {
                      if (e.target.value && !selectedTask.assignedStaff.includes(e.target.value)) {
                        handleUpdateTask(selectedTask.id, { assignedStaff: [...selectedTask.assignedStaff, e.target.value] });
                      }
                      e.target.value = '';
                    }}
                    className="w-full border rounded-lg p-2 text-sm text-gray-600 bg-white"
                  >
                    <option value="">+ Assign Staff member...</option>
                    {staffUsers.filter(u => !selectedTask.assignedStaff.includes(u.id)).map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Checklist</label>
                  <div className="space-y-2 mb-4">
                    {selectedTask.checklist.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg group">
                        <input 
                          type="checkbox" 
                          checked={item.completed} 
                          onChange={() => {
                            const newChecklist = selectedTask.checklist.map(i => 
                              i.id === item.id ? { ...i, completed: !i.completed, completedAt: !i.completed ? new Date().toISOString() : undefined, completedBy: !i.completed ? currentUser.id : undefined } : i
                            );
                            handleUpdateTask(selectedTask.id, { checklist: newChecklist });
                          }}
                          className="w-4 h-4 accent-purple-600 cursor-pointer"
                        />
                        <span className={`flex-1 text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.label}</span>
                        <button onClick={() => {
                          handleUpdateTask(selectedTask.id, { checklist: selectedTask.checklist.filter(i => i.id !== item.id) });
                        }} aria-label={`Remove checklist item ${item.label}`} className="text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Add checklist item..." 
                      className="flex-1 border rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-purple-500/20"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                          const newItem: ChecklistItem = { 
                            id: `item-${Date.now()}`, 
                            label: e.currentTarget.value.trim(), 
                            completed: false 
                          };
                          handleUpdateTask(selectedTask.id, { checklist: [...selectedTask.checklist, newItem] });
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
              <footer className="p-6 border-t bg-gray-50 flex justify-between gap-4">
                <button 
                  onClick={() => handleDeleteTask(selectedTask.id)} 
                  className="px-4 py-2 text-red-600 text-sm font-bold hover:bg-red-50 rounded-lg transition-colors"
                >
                  Delete Task
                </button>
                <button 
                  onClick={() => setSelectedId(null)} 
                  className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-purple-700 transition-all"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  Save & Close
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAreas = () => {
    const selectedArea = areas.find(a => a.id === selectedAreaId);

    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Operational Areas</h2>
          <button
  	    type="button"
  	    onClick={handleAddArea}
  	    disabled={!canMutateOperations}
  	    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
  	    style={{ backgroundColor: config.primaryColor }}
	  >
  	    + Add Area
	  </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {areas.map(area => (
            <div 
              key={area.id} 
              onClick={() => setSelectedAreaId(area.id)}
              className={`bg-white p-6 rounded-2xl border-2 transition-all cursor-pointer hover:shadow-md ${selectedAreaId === area.id ? 'border-purple-500 shadow-sm' : 'border-gray-100'}`}
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mr-4 shadow-sm" style={{ backgroundColor: `${area.color}20`, color: area.color }}>
                  {area.icon || '📍'}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{area.name}</h3>
                  <p className="text-xs text-gray-500">{getVenueName(area.venueId || '')}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-tighter">
                <span>👤 {area.assignedStaff.length} Staff</span>
                <span>✅ {tasks.filter(t => t.assignedAreas.includes(area.id)).length} Tasks</span>
              </div>
            </div>
          ))}
        </div>

        {selectedArea && (
          <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <header className="p-6 border-b flex justify-between items-center bg-gray-50">
                <h3 className="text-xl font-bold text-gray-900">Edit Area</h3>
                <button onClick={() => setSelectedAreaId(null)} aria-label="Close area editor" className="p-2 hover:bg-gray-200 rounded-full text-gray-500">✕</button>
              </header>
              <div className="p-8 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                  <input 
                    type="text" 
                    value={selectedArea.name} 
                    onChange={e => handleUpdateArea(selectedArea.id, { name: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm text-gray-900 bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Icon</label>
                    <div className="relative">
                      <EmojiPicker 
                        value={selectedArea.icon} 
                        onChange={icon => handleUpdateArea(selectedArea.id, { icon })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Color</label>
                    <input 
                      type="color" 
                      value={selectedArea.color} 
                      onChange={e => handleUpdateArea(selectedArea.id, { color: e.target.value })}
                      className="w-full h-9 border rounded-lg p-1 cursor-pointer bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Venue</label>
                  <select 
                    value={selectedArea.venueId}
                    onChange={e => handleUpdateArea(selectedArea.id, { venueId: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm text-gray-700 bg-white"
                  >
                    {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              </div>
              <footer className="p-6 border-t bg-gray-50 flex justify-between items-center">
                <button onClick={() => handleDeleteArea(selectedArea.id)} className="text-red-600 text-sm font-bold hover:underline">Delete Area</button>
                <button onClick={() => setSelectedAreaId(null)} className="px-8 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold shadow-sm" style={{ backgroundColor: config.primaryColor }}>Close</button>
              </footer>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderShifts = () => {
    const selectedShift = shifts.find(s => s.id === selectedShiftId);
    const hours = Array.from({ length: 20 }, (_, i) => i + 5); // 5 AM to Midnight (20 hours)
    const conflictingShiftsCount = shifts.filter(isShiftConflicting).length;

    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            <button onClick={() => setShiftView('timeline')} className={`px-4 py-2 rounded-lg text-sm font-medium ${shiftView === 'timeline' ? 'bg-purple-600 text-white' : 'bg-white border text-gray-600'}`} style={shiftView === 'timeline' ? { backgroundColor: config.primaryColor } : {}}>Timeline</button>
            <button onClick={() => setShiftView('list')} className={`px-4 py-2 rounded-lg text-sm font-medium ${shiftView === 'list' ? 'bg-purple-600 text-white' : 'bg-white border text-gray-600'}`} style={shiftView === 'list' ? { backgroundColor: config.primaryColor } : {}}>List</button>
          </div>
          <button
  	    type="button"
  	    onClick={handleAddShift}
  	    disabled={!canMutateOperations}
  	    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
  	    style={{ backgroundColor: config.primaryColor }}
	  >
  	    + Add Shift
	  </button>
        </div>

        {conflictingShiftsCount > 0 && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 flex items-center justify-between text-xs text-amber-800 font-medium shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-base animate-pulse" aria-hidden="true">⚠️</span>
              <span>
                <strong>Schedule Conflict Detected:</strong> {conflictingShiftsCount} shift{conflictingShiftsCount === 1 ? '' : 's'} overlap in time for the same staff member.
              </span>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0">
          {shiftView === 'timeline' ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto h-full flex flex-col">
              <div className="flex border-b bg-gray-50 h-12 flex-shrink-0 sticky top-0 z-10">
                <div className="w-48 flex-shrink-0 border-r p-3 font-bold text-gray-500 uppercase text-[10px] bg-gray-50">Staff Member</div>
                <div className="flex flex-1 overflow-x-auto">
                  {hours.map(h => (
                    <div key={h} className="w-20 flex-shrink-0 border-r p-3 text-[10px] font-bold text-gray-400 text-center">
                      {h > 12 ? `${h-12} PM` : h === 12 ? '12 PM' : `${h} AM`}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {staffUsers.map(user => {
                  const staffShifts = shifts.filter(s => s.staffId === user.id);
                  return (
                    <div key={user.id} className="flex border-b last:border-b-0 hover:bg-gray-50/50 min-h-[60px]">
                      <div className="w-48 flex-shrink-0 border-r p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700">{user.name.charAt(0)}</div>
                        <span className="text-sm font-bold truncate text-gray-900">{user.name}</span>
                      </div>
                      <div className="flex flex-1 relative bg-gray-50/30">
                        {hours.map(h => <div key={h} className="w-20 flex-shrink-0 border-r last:border-r-0 h-full" />)}
                        {staffShifts.map(shift => {
                          const start = new Date(shift.startTime);
                          const end = new Date(shift.endTime);
                          const startHour = start.getHours() + start.getMinutes() / 60;
                          const clampedHour = Math.max(5, Math.min(24, startHour));
                          const startPos = Math.max(0, (clampedHour - 5) * 80);
                          const rawDuration = Math.max(0.5, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
                          const duration = Number.isNaN(rawDuration) ? 1 : rawDuration;
                          const width = Math.max(40, duration * 80);
                          const isConflicting = isShiftConflicting(shift);
                          
                          return (
                            <div 
                              key={shift.id}
                              onClick={() => setSelectedShiftId(shift.id)}
                              className={`absolute top-2 h-10 rounded-lg shadow-sm cursor-pointer border flex items-center px-3 text-[10px] font-bold transition-all hover:brightness-95 overflow-hidden ${
                                shift.role === 'coordinator' ? 'bg-purple-500 text-white border-purple-600' :
                                shift.role === 'setup' ? 'bg-blue-500 text-white border-blue-600' :
                                shift.role === 'cleaning' ? 'bg-green-500 text-white border-green-600' :
                                'bg-orange-500 text-white border-orange-600'
                              } ${isConflicting ? 'ring-2 ring-amber-300 border-amber-300' : ''}`}
                              style={{ left: `${startPos}px`, width: `${width}px` }}
                            >
                              {isConflicting && (
                                <span
                                  className="mr-1 inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[11px] font-extrabold px-1 animate-pulse shrink-0"
                                  title="Schedule Conflict: Overlaps with another shift for this staff member"
                                  aria-label="Schedule conflict warning"
                                >
                                  ⚠️
                                </span>
                              )}
                              <span className="truncate">{shift.role} • {shift.notes || 'No notes'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-6 py-3">Staff Member</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Start</th>
                    <th className="px-6 py-3">End</th>
                    <th className="px-6 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shifts.map(shift => (
                    <tr key={shift.id} onClick={() => setSelectedShiftId(shift.id)} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-6 py-4 font-bold text-gray-900 flex items-center gap-1.5">
                        {isShiftConflicting(shift) && (
                          <span
                            className="inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[11px] font-extrabold px-1 animate-pulse"
                            title="Schedule Conflict: Overlaps with another shift for this staff member"
                            aria-label="Schedule conflict warning"
                          >
                            ⚠️
                          </span>
                        )}
                        <span>{getStaffName(shift.staffId)}</span>
                      </td>
                      <td className="px-6 py-4 capitalize text-gray-600">{shift.role}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">{new Date(shift.startTime).toLocaleString()}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">{new Date(shift.endTime).toLocaleString()}</td>
                      <td className="px-6 py-4 truncate max-w-xs text-gray-600">{shift.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedShift && (
          <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <header className="p-6 border-b flex justify-between items-center bg-gray-50">
                <h3 className="text-xl font-bold text-gray-900">Edit Shift</h3>
                <button onClick={() => setSelectedShiftId(null)} aria-label="Close shift editor" className="p-2 hover:bg-gray-200 rounded-full text-gray-500">✕</button>
              </header>
              <div className="p-8 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Staff Member</label>
                  <select 
                    value={selectedShift.staffId}
                    onChange={e => handleUpdateShift(selectedShift.id, { staffId: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm text-gray-700 bg-white"
                  >
                    {staffUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Role</label>
                  <select 
                    value={selectedShift.role}
                    onChange={e => handleUpdateShift(selectedShift.id, { role: e.target.value as any })}
                    className="w-full border rounded-lg p-2 text-sm text-gray-700 bg-white"
                  >
                    <option value="coordinator">Coordinator</option>
                    <option value="setup">Setup</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="parking">Parking</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="shift-start-time" className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Time</label>
                    <input 
                      id="shift-start-time"
                      type="datetime-local" 
                      value={toLocalDatetimeInput(selectedShift.startTime)}
                      onChange={e => handleUpdateShift(selectedShift.id, { startTime: fromLocalDatetimeInput(e.target.value) })}
                      className="w-full border rounded-lg p-2 text-sm text-gray-700 bg-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="shift-end-time" className="block text-xs font-bold text-gray-500 uppercase mb-1">End Time</label>
                    <input 
                      id="shift-end-time"
                      type="datetime-local" 
                      value={toLocalDatetimeInput(selectedShift.endTime)}
                      onChange={e => handleUpdateShift(selectedShift.id, { endTime: fromLocalDatetimeInput(e.target.value) })}
                      className="w-full border rounded-lg p-2 text-sm text-gray-700 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notes</label>
                  <textarea 
                    value={selectedShift.notes || ''}
                    onChange={e => handleUpdateShift(selectedShift.id, { notes: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm h-20 text-gray-700 outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
              </div>
              <footer className="p-6 border-t bg-gray-50 flex justify-between items-center">
                <button onClick={() => handleDeleteShift(selectedShift.id)} className="text-red-600 text-sm font-bold hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">Delete Shift</button>
                <button onClick={() => setSelectedShiftId(null)} className="px-8 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold shadow-sm" style={{ backgroundColor: config.primaryColor }}>Close</button>
              </footer>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  const renderChecklists = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm flex-wrap gap-3">
          <h2 className="text-xl font-bold text-gray-900">Operational Checklists</h2>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={hideCompletedChecklist}
                onChange={(e) => setHideCompletedChecklist(e.target.checked)}
                className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
              />
              <span>Show incomplete items only</span>
            </label>
            <button
              type="button"
              onClick={handleLoadAdminDefaults}
              disabled={!canMutateOperations}
              className="px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-900 text-xs font-bold hover:bg-purple-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <span aria-hidden="true">➕</span>
              <span>Load Checklists from Admin</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => { window.location.hash = '#/admin'; }}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-colors flex items-center gap-1"
              >
                <span>⚙️</span>
                <span>Admin Operations Settings</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmResetChecklists(true)}
              disabled={!canMutateOperations || tasks.flatMap(t => t.checklist).filter(i => i.completed).length === 0}
              className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <span aria-hidden="true">🔄</span>
              <span>Reset for Next Event</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm flex items-center gap-2">
          <span className="text-sm">🔍</span>
          <input
            type="search"
            value={checklistSearch}
            onChange={(e) => setChecklistSearch(e.target.value)}
            placeholder="Quick search checklist item by task or keyword…"
            aria-label="Search operational checklists"
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          />
          {checklistSearch && (
            <button
              type="button"
              onClick={() => setChecklistSearch('')}
              className="text-xs font-semibold hover:underline"
              style={{ color: config.primaryColor || '#4A1942' }}
            >
              Clear search
            </button>
          )}
        </div>

        <div className="space-y-8">
          {PHASES.map((phase) => {
            const phaseTasks = tasks.filter((t) => normalizedPhase(t.phase) === phase);
            const allItems = phaseTasks.flatMap((t) =>
              t.checklist.map((item) => ({ ...item, taskTitle: t.title, taskId: t.id })),
            );
            const displayItems = allItems.filter((i) => {
              if (hideCompletedChecklist && i.completed) return false;
              const q = checklistSearch.trim().toLowerCase();
              if (q && !`${i.label} ${i.taskTitle} ${i.completedBy || ''}`.toLowerCase().includes(q)) return false;
              return true;
            });

            if (displayItems.length === 0) return null;

            return (
              <div key={phase}>
                <h3 className="text-lg font-bold text-gray-900 mb-4 capitalize border-b pb-2 flex justify-between items-center">
                  <span>{phase.replace('-', ' ')}</span>
                  <span className="text-[10px] font-black uppercase text-gray-400 bg-gray-50 px-2 py-1 rounded tracking-widest">
                    {allItems.filter((i) => i.completed).length}/{allItems.length} complete
                  </span>
                </h3>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y shadow-sm">
                  {displayItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center p-4 hover:bg-gray-50 transition-colors group"
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => {
                          const task = tasks.find((t) => t.id === item.taskId);
                          if (task) {
                            const newChecklist = task.checklist.map((i) =>
                              i.id === item.id ? { ...i, completed: !i.completed } : i,
                            );
                            handleUpdateTask(task.id, { checklist: newChecklist });
                          }
                        }}
                        className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
                      />
                      <div className="flex-1 ml-4 min-w-0">
                        <div
                          className={`text-sm font-medium ${item.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}
                        >
                          {item.label}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Task: <span className="font-bold text-gray-500">{item.taskTitle}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.taskId)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] uppercase font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100"
                      >
                        View Task
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {tasks.flatMap((t) => t.checklist).length > 0 &&
            PHASES.every((phase) => {
              const phaseTasks = tasks.filter((t) => normalizedPhase(t.phase) === phase);
              const allItems = phaseTasks.flatMap((t) =>
                t.checklist.map((item) => ({ ...item, taskTitle: t.title, taskId: t.id })),
              );
              return allItems.filter((i) => {
                if (hideCompletedChecklist && i.completed) return false;
                const q = checklistSearch.trim().toLowerCase();
                if (q && !`${i.label} ${i.taskTitle} ${i.completedBy || ''}`.toLowerCase().includes(q)) return false;
                return true;
              }).length === 0;
            }) && (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-500">
                <p>No checklist items match &ldquo;{checklistSearch}&rdquo;.</p>
                <button
                  type="button"
                  onClick={() => setChecklistSearch('')}
                  className="mt-2 text-xs hover:underline font-semibold"
                  style={{ color: config.primaryColor || '#4A1942' }}
                >
                  Clear search
                </button>
              </div>
            )}
          {tasks.flatMap((t) => t.checklist).length === 0 && (
            <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 italic text-gray-500">
              No checklist items found in any tasks.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderExport = () => {
    const handleExport = () => {
      const data: OperationsExport = {
        tasks,
        areas,
        shifts,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `operations-${eventName || 'event'}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    };

    return (
      <div className="max-w-2xl mx-auto space-y-8 py-10 text-center">
        <div className="bg-white p-10 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">📤</div>
          <h2 className="text-2xl font-bold text-gray-900">Operations Data Management</h2>
          <p className="text-gray-500">Download your tasks, areas, and schedule as a JSON file or import existing configurations.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <button onClick={handleExport} className="px-8 py-3 bg-purple-600 text-white rounded-xl font-bold shadow-lg hover:bg-purple-700 transition-all flex items-center justify-center" style={{ backgroundColor: config.primaryColor }}>
              <span className="mr-2">💾</span> Export JSON
            </button>
            <label className="px-8 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-xl font-bold hover:bg-purple-50 transition-all cursor-pointer flex items-center justify-center" style={{ borderColor: config.primaryColor, color: config.primaryColor }}>
              <span className="mr-2">📂</span> Import JSON
              <input 
                type="file" 
                accept=".json" 
                className="hidden" 
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const data = JSON.parse(event.target?.result as string);
                      if (data.tasks) {
                        setPendingImport({ tasks: data.tasks || [], areas: data.areas || [], shifts: data.shifts || [] });
                      }
                    } catch (err) {
                      showToast('Invalid JSON file.', 'warning');
                    }
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
        </div>
        <button onClick={() => window.print()} className="no-print w-full py-4 border-2 border-gray-300 rounded-2xl text-gray-600 font-bold hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors">
          <span>🖨️</span> Print Operations Summary
        </button>
      </div>
    );
  };

  return (
    <div className={inline ? "h-full flex flex-col bg-gray-100" : "fixed inset-0 z-[10000] bg-gray-100/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-300"}>
      <header
        className="no-print px-6 py-4 flex items-center justify-between border-b shadow-sm shrink-0 text-white"
        style={{
          background: `linear-gradient(135deg, ${config.primaryColor}, ${config.primaryDark})`,
          borderColor: `color-mix(in srgb, ${config.primaryDark || '#3d1a45'} 40%, transparent)`,
        }}
      >
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>📋</span>
            <span>Staff &amp; Operations</span>
          </h1>
          <p className="text-sm text-white/80 mt-1">{eventName || 'Event Operations & Shift Roster'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="no-print bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors"
            type="button"
          >
            <span>🖨️</span>
            <span>{activeTab === 'beo' ? 'Print BEO' : 'Print Sheet'}</span>
          </button>
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
          <button onClick={onClose} aria-label="Close Staff Operations" className="no-print p-2 hover:bg-white/10 rounded-lg text-white transition-colors text-xl font-bold">✕</button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="no-print w-64 bg-white border-r border-gray-200 flex flex-col shadow-[4px_0_15px_rgba(0,0,0,0.02)]">
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {[
              { id: 'overview', icon: '📊', label: 'Overview' },
              { id: 'beo', icon: '📜', label: 'BEO Sheet' },
              { id: 'tasks', icon: '✅', label: 'Tasks' },
              { id: 'areas', icon: '📍', label: 'Areas' },
              { id: 'shifts', icon: '🕒', label: 'Shifts' },
              { id: 'checklists', icon: '📝', label: 'Checklists' },
              { id: 'export', icon: '💾', label: 'Export / Import' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                  activeTab === item.id 
                    ? 'bg-purple-50 text-purple-700 shadow-sm border border-purple-100' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
                style={activeTab === item.id ? { color: config.primaryColor, backgroundColor: `${config.primaryColor}10`, borderColor: `${config.primaryColor}20` } : {}}
              >
                <span className="text-xl mr-3">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold mr-3 border-2 border-white shadow-sm overflow-hidden" style={{ color: config.primaryColor, backgroundColor: `${config.primaryColor}20` }}>
                {currentUser.imageUrl ? (
                  <img src={currentUser.imageUrl} alt={currentUser.name || 'User'} className="w-full h-full object-cover" />
                ) : (
                  (currentUser.name || currentUser.username || 'U').split(' ').map(n => n[0]).join('').toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900 truncate tracking-tight">{currentUser.name || currentUser.username || 'Staff User'}</div>
                <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mt-1">{currentUser.role}</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="no-print print:hidden flex-1 overflow-auto bg-gray-50/30">
          <div className="max-w-6xl mx-auto p-8 h-full">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'beo' && renderBEO()}
            {activeTab === 'tasks' && renderTasks()}
            {activeTab === 'areas' && renderAreas()}
            {activeTab === 'shifts' && renderShifts()}
            {activeTab === 'checklists' && renderChecklists()}
            {activeTab === 'export' && renderExport()}
          </div>
        </main>

        {/* Printable Section: When activeTab === 'beo', print the BEO Sheet; otherwise print the Daily Operations Report */}
        {activeTab === 'beo' ? (
          <div className="hidden print:block p-8 bg-white text-gray-900 space-y-8 w-full ops-print-beo">
            {renderBEOContent(true)}
          </div>
        ) : (
          <div className="hidden print:block p-8 bg-white text-gray-900 space-y-8 w-full ops-print-report">
          <div className="border-b pb-4">
            <h1 className="text-3xl font-bold text-gray-900">Daily Operations Report</h1>
            <p className="text-sm text-gray-600 mt-1">
              {eventName || 'Event Operations'} • {getVenueName(venueId || '')} • Generated {new Date().toLocaleDateString()}
            </p>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-4 gap-4 border-b pb-6">
            <div className="border rounded-lg p-3 bg-gray-50">
              <div className="text-xl font-bold text-gray-900">{tasks.length}</div>
              <div className="text-xs text-gray-500">Total Tasks</div>
            </div>
            <div className="border rounded-lg p-3 bg-gray-50">
              <div className="text-xl font-bold text-gray-900">{tasks.filter(t => t.status === 'completed').length}</div>
              <div className="text-xs text-gray-500">Completed Tasks</div>
            </div>
            <div className="border rounded-lg p-3 bg-gray-50">
              <div className="text-xl font-bold text-gray-900">{shifts.length}</div>
              <div className="text-xs text-gray-500">Scheduled Shifts</div>
            </div>
            <div className="border rounded-lg p-3 bg-gray-50">
              <div className="text-xl font-bold text-gray-900">{areas.length}</div>
              <div className="text-xs text-gray-500">Operational Areas</div>
            </div>
          </div>

          {/* Tasks by Phase */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Tasks by Event Phase</h2>
            {PHASES.map((phase) => {
              const phaseTasks = tasks.filter((t) => normalizedPhase(t.phase) === phase);
              if (phaseTasks.length === 0) return null;
              return (
                <div key={phase} className="border rounded-xl p-4 space-y-2">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-gray-600 border-b pb-1">
                    {phase.replace('-', ' ')} ({phaseTasks.length})
                  </h3>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>
                        <th className="py-2 px-3">Title</th>
                        <th className="py-2 px-3">Priority</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Assignees</th>
                        <th className="py-2 px-3">Checklist</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {phaseTasks.map((task) => (
                        <tr key={task.id}>
                          <td className="py-2 px-3 font-bold">{task.title}</td>
                          <td className="py-2 px-3 uppercase">{task.priority}</td>
                          <td className="py-2 px-3 capitalize">{task.status.replace('-', ' ')}</td>
                          <td className="py-2 px-3">
                            {task.assignedStaff.map((id) => getStaffName(id)).join(', ') || '—'}
                          </td>
                          <td className="py-2 px-3">
                            {task.checklist.filter((i) => i.completed).length}/{task.checklist.length} done
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* Shifts Schedule */}
          <div className="space-y-4 page-break">
            <h2 className="text-xl font-bold text-gray-900">Staff Shift Schedule</h2>
            {shifts.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No shifts scheduled.</p>
            ) : (
              <table className="w-full text-xs text-left border rounded-xl overflow-hidden">
                <thead className="bg-gray-50 text-gray-500 uppercase">
                  <tr>
                    <th className="py-2 px-3">Staff Member</th>
                    <th className="py-2 px-3">Role</th>
                    <th className="py-2 px-3">Start Time</th>
                    <th className="py-2 px-3">End Time</th>
                    <th className="py-2 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {shifts.map((shift) => (
                    <tr key={shift.id}>
                      <td className="py-2 px-3 font-bold">{getStaffName(shift.staffId)}</td>
                      <td className="py-2 px-3 capitalize">{shift.role}</td>
                      <td className="py-2 px-3">{new Date(shift.startTime).toLocaleString()}</td>
                      <td className="py-2 px-3">{new Date(shift.endTime).toLocaleString()}</td>
                      <td className="py-2 px-3">{shift.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Operational Checklists (with checkable boxes) */}
          <div className="space-y-4 page-break">
            <h2 className="text-xl font-bold text-gray-900">Event-Day Checklists</h2>
            {tasks.flatMap((t) => t.checklist).length === 0 ? (
              <p className="text-sm text-gray-500 italic">No checklist items configured.</p>
            ) : (
              <div className="space-y-4">
                {PHASES.map((phase) => {
                  const phaseTasks = tasks.filter((t) => normalizedPhase(t.phase) === phase);
                  const allItems = phaseTasks.flatMap((t) =>
                    t.checklist.map((item) => ({ ...item, taskTitle: t.title })),
                  );
                  if (allItems.length === 0) return null;
                  return (
                    <div key={phase} className="border rounded-xl p-4">
                      <h3 className="font-bold text-sm uppercase tracking-wider text-gray-600 border-b pb-2 mb-3">
                        {phase.replace('-', ' ')} Checklists
                      </h3>
                      <div className="space-y-2">
                        {allItems.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 text-sm">
                            <span className="w-4 h-4 border border-gray-400 inline-block shrink-0 rounded" />
                            <span className="font-medium text-gray-800">{item.label}</span>
                            <span className="text-xs text-gray-500">({item.taskTitle})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title={`Delete ${pendingDelete?.kind ?? 'item'}`}
        message={`Are you sure you want to delete this ${pendingDelete?.kind ?? 'item'}? This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => {
          if (!pendingDelete) return;
          if (pendingDelete.kind === 'task') {
            saveTasks(tasks.filter(t => t.id !== pendingDelete.id));
            setSelectedId(null);
          } else if (pendingDelete.kind === 'area') {
            saveAreas(areas.filter(a => a.id !== pendingDelete.id));
            saveTasks(
              tasks.map(t => ({
                ...t,
                assignedAreas: t.assignedAreas.filter(id => id !== pendingDelete.id),
              })),
            );
            setSelectedAreaId(null);
          } else if (pendingDelete.kind === 'shift') {
            saveShifts(shifts.filter(s => s.id !== pendingDelete.id));
            setSelectedShiftId(null);
          }
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={!!pendingImport}
        title="Import operations data"
        message="Import will merge with your existing tasks, areas, and shifts. Continue?"
        confirmLabel="Import"
        onConfirm={() => {
          if (!pendingImport) return;
          saveTasks([...pendingImport.tasks, ...tasks]);
          if (pendingImport.areas.length) saveAreas([...pendingImport.areas, ...areas]);
          if (pendingImport.shifts.length) saveShifts([...pendingImport.shifts, ...shifts]);
          setPendingImport(null);
          showToast('Operations data imported successfully.', 'success');
        }}
        onCancel={() => setPendingImport(null)}
      />

      <ConfirmDialog
        open={confirmResetChecklists}
        title="Reset Checklists for Next Event?"
        message="This will uncheck all completed checklist items across every task so your operational checklists are ready for the next wedding. Continue?"
        confirmLabel="Reset Checklists"
        tone="danger"
        onConfirm={() => {
          setConfirmResetChecklists(false);
          const nextTasks = tasks.map((t) => ({
            ...t,
            checklist: t.checklist.map((item) => ({
              ...item,
              completed: false,
              completedAt: undefined,
              completedBy: undefined,
            })),
            status: t.status === 'completed' ? ('not-started' as const) : t.status,
          }));
          saveTasks(nextTasks);
          showToast('All operational checklists reset for next event.', 'success');
        }}
        onCancel={() => setConfirmResetChecklists(false)}
      />
    </div>
  );
};

// --- Sub-components ---

const StatCard = ({ label, value, color, onClick }: { label: string, value: number, color: string, onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md duration-200 text-left w-full focus:outline-none focus:ring-2"
    title={`Click to view ${label.toLowerCase()}`}
  >
    <div className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{label}</div>
    <div className={`text-3xl font-black mt-1 ${color}`}>{value}</div>
  </button>
);

const PriorityDot = ({ priority }: { priority: StaffTaskPriority }) => (
  <div className={`w-3 h-3 rounded-full shadow-sm ${
    priority === 'critical' ? 'bg-red-500' : 
    priority === 'high' ? 'bg-orange-500' : 
    priority === 'medium' ? 'bg-blue-500' : 'bg-gray-400'
  }`} />
);

const PriorityBadge = ({ priority }: { priority: StaffTaskPriority }) => (
  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
    priority === 'critical' ? 'bg-red-100 text-red-700' : 
    priority === 'high' ? 'bg-orange-100 text-orange-700' : 
    priority === 'medium' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
  }`}>
    {priority}
  </span>
);

const StatusBadge = ({ status }: { status: StaffTaskStatus }) => (
  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
    status === 'completed' ? 'bg-green-100 text-green-700' : 
    status === 'in-progress' ? 'bg-blue-100 text-blue-700' : 
    status === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
  }`}>
    {status.replace('-', ' ')}
  </span>
);

export default StaffOperationsPanel;
