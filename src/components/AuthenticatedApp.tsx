import { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { useLayoutState, getSavedLayouts, setSavedLayouts, getTemplates, getTableSpecs, getFixtureTypes } from '../hooks/useLayoutState';
import { useLayoutBackendSync } from '../hooks/useLayoutBackendSync';
import { useEntityBackendSync } from '../hooks/useEntityBackendSync';
import { EventAnswer, EventQuestion } from '../types';
import { layoutCategories } from '../data/venueData';
import { useAuth } from '../contexts/AuthContext';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { FloorPlanCanvas } from './FloorPlanCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { WelcomeModal } from './WelcomeModal';
import { showToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import AppStatusBar, { StatusBarItem } from './AppStatusBar';
import { CenteredModal } from './CenteredModal';
import { buildMessageThreadId } from '../models/DirectMessage';
import { useSubmissionWorkflow } from '../hooks/useSubmissionWorkflow';
import { getConfig } from '../config';
import { checkTableCollision, checkFixtureCollision } from '../utils/collisionDetection';
import { subscribeToCollaborationEvents } from '../utils/collaborationChannel';
import {
  buildProjectHealthReport,
  createEmergencyRecoverySnapshot,
  recoverCorruptDomains,
  type ProjectHealthReport,
} from '../utils/recovery';
import { STORAGE_KEYS } from '../constants/storageKeys';
import {
  canAccessAdminPanel,
  canAccessOperationsPanel,
  canEditLayout,
  canManageGuests,
  canMoveFixture,
  canPrintLayouts,
} from '../utils/permissions';
import { UndoRedoProvider } from '../contexts/UndoRedoContext';
import { UndoRedoToolbar } from './UndoRedoToolbar';
import { VenueDashboard } from './VenueDashboard';
import { emit, emitDataChanged, on, type UndoSnapshot } from '../utils/appEvents';
import { useModals } from '../contexts/ModalContext';

// ─── Lazy-loaded modal / portal components ───────────────────────────────────
const DecorDesigner = lazy(() => import('./DecorDesigner').then((m) => ({ default: m.DecorDesigner })));
const GuestPanel = lazy(() => import('./GuestPanel').then((m) => ({ default: m.GuestPanel })));
const EventOverview = lazy(() => import('./EventOverview').then((m) => ({ default: m.EventOverview })));
const WorkspaceHelp = lazy(() => import('./WorkspaceHelp').then((m) => ({ default: m.WorkspaceHelp })));
const StaffOperationsPanel = lazy(() => import('./StaffOperationsPanel'));
const AdminPanel = lazy(() => import('./AdminPanel').then((m) => ({ default: m.AdminPanel })));
const PrintView = lazy(() => import('./PrintView').then((m) => ({ default: m.PrintView })));
const TemplateSelector = lazy(() => import('./TemplateSelector').then((m) => ({ default: m.TemplateSelector })));
const DirectMessagePanel = lazy(() => import('./DirectMessagePanel').then((m) => ({ default: m.DirectMessagePanel })));
const SubmissionStatusPanel = lazy(() => import('./SubmissionStatusPanel').then((m) => ({ default: m.SubmissionStatusPanel })));
const EventQuestionsWizard = lazy(() => import('./EventQuestionsWizard').then((m) => ({ default: m.EventQuestionsWizard })));
const VendorPanel = lazy(() => import('./VendorPanel').then((m) => ({ default: m.VendorPanel })));
const TimelinePanel = lazy(() => import('./TimelinePanel').then((m) => ({ default: m.TimelinePanel })));

interface Position { x: number; y: number; }
interface DragItem { type: 'table' | 'fixture' | 'arrangement'; specId: string; isExterior?: boolean; }

export default function AuthenticatedApp() {
  const { user: authUser, organizationId, isAdmin, isGuest, logout, getAllUsers } = useAuth();
  const user = authUser!;
  const allUsers = getAllUsers();
  const isStaff = user?.role === 'staff';
  const layoutState = useLayoutState();

  const [view, setView] = useState<'dashboard' | 'studio'>('dashboard');

  const canOpenAdminPanel = canAccessAdminPanel(user);
  const canOpenOperationsPanel = canAccessOperationsPanel(user);
  const canOpenGuestPanel = canManageGuests(user);
  const canPrintCurrentLayout = canPrintLayouts(user);
  const canEditCurrentLayout = canEditLayout(user);
  
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const floorPlanSvgRef = useRef<SVGSVGElement>(null);
  const [brandingConfig, setBrandingConfig] = useState(() => getConfig());
  const [projectHealth, setProjectHealth] = useState<ProjectHealthReport | null>(null);
  // Lets a user dismiss the layout-warning banner; it reappears if the set of
  // warnings changes (a fresh collision/overlap the user hasn't acknowledged).
  const [dismissedWarningsKey, setDismissedWarningsKey] = useState<string | null>(null);
  const [safeMode, setSafeMode] = useState(false);

  const { modals, editingArrangementId, setEditingArrangementId, open, close, closeAll } = useModals();

  const showVendors = modals.vendors;
  const showTimeline = modals.timeline;
  const showGuests = modals.guests;
  const showAdmin = modals.admin;
  const showTemplates = modals.templates;
  const showPrint = modals.print;
  const showOperations = modals.operations;
  const showMessages = modals.messages;
  const showSubmission = modals.submission;
  const showEventQuestions = modals.eventQuestions;
  const showDecorDesigner = modals.decorDesigner;
  const showOverview = modals.overview;

  // Local UI state
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(5);
  const [gridContrast, setGridContrast] = useState(0.45);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Persist lightweight UI preferences (sidebar width/collapsed, grid & snap)
  // so a returning user's workspace layout is remembered across sessions.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.UI_PREFS);
      if (!raw) return;
      const prefs = JSON.parse(raw) as {
        sidebarWidth?: number;
        sidebarCollapsed?: boolean;
        showGrid?: boolean;
        gridSize?: number;
        gridContrast?: number;
        snapToGrid?: boolean;
      };
      if (typeof prefs.sidebarWidth === 'number') setSidebarWidth(prefs.sidebarWidth);
      if (typeof prefs.sidebarCollapsed === 'boolean') setSidebarCollapsed(prefs.sidebarCollapsed);
      if (typeof prefs.showGrid === 'boolean') setShowGrid(prefs.showGrid);
      if (typeof prefs.gridSize === 'number') setGridSize(prefs.gridSize);
      if (typeof prefs.gridContrast === 'number') setGridContrast(prefs.gridContrast);
      if (typeof prefs.snapToGrid === 'boolean') setSnapToGrid(prefs.snapToGrid);
    } catch {
      // ignore corrupt prefs
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.UI_PREFS,
        JSON.stringify({ sidebarWidth, sidebarCollapsed, showGrid, gridSize, gridContrast, snapToGrid }),
      );
    } catch {
      // ignore storage quota errors
    }
  }, [sidebarWidth, sidebarCollapsed, showGrid, gridSize, gridContrast, snapToGrid]);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [savedLayouts, setSavedLayoutsState] = useState(() => getSavedLayouts());
  const [imagePreview, setImagePreview] = useState<{ url: string; title: string } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedVenueCategories, setSelectedVenueCategories] = useState<string[]>([]);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const [showWorkspaceHelp, setShowWorkspaceHelp] = useState(false);
  const [pendingOverwrite, setPendingOverwrite] = useState<(() => void) | null>(null);
  const [pendingVenueChange, setPendingVenueChange] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(() => {
    const config = getConfig();
    return config.showWelcomeByDefault !== false;
  });

  useEffect(() => {
    const report = buildProjectHealthReport();
    setProjectHealth(report);
    if (report.overallStatus === 'corrupt') setSafeMode(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (isAdmin) { setShowWelcome(false); return; }
    if (isGuest) {
      const config = getConfig();
      if (config.showWelcomeByDefault !== false) setShowWelcome(true);
      return;
    }
    const permanentlyHidden = localStorage.getItem(STORAGE_KEYS.WELCOME_HIDDEN) === 'true';
    if (permanentlyHidden) setShowWelcome(false);
  }, [user, isGuest, isAdmin]);

  const selectableVenues = (isAdmin ? layoutState.venues : layoutState.venues.filter(v => v.isMaster !== false))
    .filter(v => selectedVenueCategories.length === 0 || selectedVenueCategories.includes(v.category));

  const isMasterBasicUser = user.role === 'basic' && (user.userRole === 'master' || user.isMasterUser === true);
  const currentEventName = user.eventName || user.department || 'general';
  const masterThreadId = buildMessageThreadId(currentEventName, user.id);
  const submissionWorkflow = useSubmissionWorkflow();

  const readEventAnswers = useCallback((): EventAnswer[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EVENT_ANSWERS);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as EventAnswer[];
      return Array.isArray(parsed) ? parsed.filter((a) => a.userId === user.id && a.eventId === currentEventName) : [];
    } catch { return []; }
  }, [user.id, currentEventName]);

  const [currentEventAnswers, setCurrentEventAnswers] = useState<EventAnswer[]>(readEventAnswers);

  useEffect(() => {
    setCurrentEventAnswers(readEventAnswers());
    return on('spm_data_changed', () => setCurrentEventAnswers(readEventAnswers()));
  }, [readEventAnswers]);

  const eventQuestions = useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EVENT_QUESTIONS);
      if (!raw) return [] as EventQuestion[];
      const parsed = JSON.parse(raw) as EventQuestion[];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return [] as EventQuestion[]; }
  }, [showAdmin]);

  const saveEventAnswers = useCallback((answers: EventAnswer[]) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EVENT_ANSWERS);
      const existing = raw ? (JSON.parse(raw) as EventAnswer[]) : [];
      const filtered = (Array.isArray(existing) ? existing : []).filter((a) => !(a.userId === user.id && a.eventId === currentEventName));
      localStorage.setItem(STORAGE_KEYS.EVENT_ANSWERS, JSON.stringify([...filtered, ...answers]));
    } catch {}
  }, [user.id, currentEventName]);

  const currentSubmission = submissionWorkflow.getByMasterAndEvent(user.id, currentEventName);

  const statusItems = useMemo<StatusBarItem[]>(() => {
    const items: StatusBarItem[] = [];
    if (safeMode) {
      items.push({
        id: 'safe-mode', kind: 'warning', title: 'Safe Mode is active',
        description: 'Some local project data appears damaged.',
        actions: [{ label: 'Attempt Auto-Repair', onClick: () => void handleAutoRepair() }, { label: 'Reload App', onClick: () => window.location.reload() }],
      });
    } else if (projectHealth?.overallStatus === 'warning') {
      items.push({
        id: 'health-warning', kind: 'warning', title: 'Project health warning',
        description: 'Some local project data may be incomplete.',
        actions: [{ label: 'Reload App', onClick: () => window.location.reload() }],
      });
    }
    return items;
  }, [safeMode, projectHealth]);

  useEffect(() => {
    if (selectableVenues.length === 0) return;
    if (!selectableVenues.some(v => v.id === layoutState.currentVenue.id)) {
      layoutState.changeVenue(selectableVenues[0].id);
    }
  }, [selectableVenues, layoutState.currentVenue.id, layoutState]);

  const fitAndCenterVenue = useCallback(() => {
    if (!canvasContainerRef.current) return;
    const container = canvasContainerRef.current;
    const venue = layoutState.currentVenue;
    const scale = 8;
    const padding = venue.exteriorPadding || { top: 40, right: 30, bottom: 30, left: 40 };
    const canvasWidth = venue.canvasWidth ? venue.canvasWidth * scale : (venue.width + padding.left + padding.right) * scale;
    const canvasHeight = venue.canvasHeight ? venue.canvasHeight * scale : (venue.height + padding.top + padding.bottom) * scale;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const marginPx = 40;
    const zoomX = (containerWidth - marginPx) / canvasWidth;
    const zoomY = (containerHeight - marginPx) / canvasHeight;
    const newZoom = Math.min(1.5, Math.max(0.25, Math.min(zoomX, zoomY)));
    const scaledCanvasWidth = canvasWidth * newZoom;
    const scaledCanvasHeight = canvasHeight * newZoom;
    const offsetX = Math.max(20, (containerWidth - scaledCanvasWidth) / 2);
    const offsetY = Math.max(20, (containerHeight - scaledCanvasHeight) / 2);
    setZoom(newZoom);
    setPanOffset({ x: offsetX, y: offsetY });
  }, [layoutState.currentVenue]);

  const handleResetView = useCallback(() => fitAndCenterVenue(), [fitAndCenterVenue]);

  function ensureCanEditLayout(): boolean {
    if (canEditCurrentLayout) return true;
    showToast('You do not have permission to edit this layout.', 'warning');
    return false;
  }

  const handleResetToVenue = useCallback(() => {
    if (!canvasContainerRef.current) return;
    const container = canvasContainerRef.current;
    const venue = layoutState.currentVenue;
    const scale = 8;
    const padding = venue.exteriorPadding || { top: 40, right: 30, bottom: 30, left: 40 };
    const venueOffsetX = (venue.venueX ?? padding.left) * scale;
    const venueOffsetY = (venue.venueY ?? padding.top) * scale;
    let minX = venueOffsetX; let minY = venueOffsetY;
    let maxX = venueOffsetX + venue.width * scale; let maxY = venueOffsetY + venue.height * scale;
    if (venue.shape === 'custom' && venue.shapePoints && venue.shapePoints.length >= 3) {
      const xs = venue.shapePoints.map((p) => venueOffsetX + p.x * scale);
      const ys = venue.shapePoints.map((p) => venueOffsetY + p.y * scale);
      minX = Math.min(...xs); minY = Math.min(...ys); maxX = Math.max(...xs); maxY = Math.max(...ys);
    }
    const shapeWidth = Math.max(1, maxX - minX); const shapeHeight = Math.max(1, maxY - minY);
    const margin = 40; const containerWidth = container.clientWidth - margin; const containerHeight = container.clientHeight - margin;
    const zoomX = containerWidth / shapeWidth; const zoomY = containerHeight / shapeHeight;
    const newZoom = Math.min(zoomX, zoomY, 1);
    const panX = (container.clientWidth - shapeWidth * newZoom) / 2 - minX * newZoom;
    const panY = (container.clientHeight - shapeHeight * newZoom) / 2 - minY * newZoom;
    setZoom(newZoom); setPanOffset({ x: panX, y: panY });
  }, [layoutState.currentVenue]);

  const handleResetToCanvas = useCallback(() => {
    if (!canvasContainerRef.current) return;
    const container = canvasContainerRef.current;
    const venue = layoutState.currentVenue;
    const scale = 8;
    const padding = venue.exteriorPadding || { top: 40, right: 30, bottom: 30, left: 40 };
    const canvasWidth = venue.canvasWidth ? venue.canvasWidth * scale : (venue.width + padding.left + padding.right) * scale;
    const canvasHeight = venue.canvasHeight ? venue.canvasHeight * scale : (venue.height + padding.top + padding.bottom) * scale;
    const containerWidth = container.clientWidth - 40; const containerHeight = container.clientHeight - 40;
    const zoomX = containerWidth / canvasWidth; const zoomY = containerHeight / canvasHeight;
    const newZoom = Math.min(zoomX, zoomY, 2);
    const panX = (containerWidth - canvasWidth * newZoom) / 2 + 20; const panY = (containerHeight - canvasHeight * newZoom) / 2 + 20;
    setZoom(newZoom); setPanOffset({ x: panX, y: panY });
  }, [layoutState.currentVenue]);

  useEffect(() => {
    layoutState.setOnVenueChange(() => {
      setTimeout(() => {
        if (!canvasContainerRef.current) return;
        const container = canvasContainerRef.current;
        const venue = layoutState.currentVenue;
        const scale = 8;
        const padding = venue.exteriorPadding || { top: 40, right: 30, bottom: 30, left: 40 };
        const venueWidth = venue.width * scale; const venueHeight = venue.height * scale;
        const containerWidth = container.clientWidth - 40; const containerHeight = container.clientHeight - 40;
        const zoomX = containerWidth / venueWidth; const zoomY = containerHeight / venueHeight;
        const newZoom = Math.min(zoomX, zoomY, 1);
        const venueX = (venue.venueX || padding.left) * scale; const venueY = (venue.venueY || padding.top) * scale;
        const panX = (containerWidth - venueWidth * newZoom) / 2 - venueX * newZoom + 20;
        const panY = (containerHeight - venueHeight * newZoom) / 2 - venueY * newZoom + 20;
        setZoom(newZoom); setPanOffset({ x: panX, y: panY });
      }, 100);
    });
  }, [layoutState]);

  const refreshSavedLayouts = useCallback(() => setSavedLayoutsState(getSavedLayouts()), []);

  // Platform layout sync: pulls shared layouts on load and exposes a push for
  // the save/delete handlers (no-op in local mode).
  const layoutBackendSync = useLayoutBackendSync({
    userId: user.id,
    organizationId,
    onLoaded: refreshSavedLayouts,
  });

  // Platform entity sync: pulls shared catalog/asset/design domains on load and
  // exposes a push used after admin edits (no-op in local mode).
  const entityBackendSync = useEntityBackendSync({
    userId: user.id,
    organizationId,
    onLoaded: refreshSavedLayouts,
  });

  // Keep the saved-layouts list in sync with storage on same-tab data changes
  // (e.g. an admin "Reset to defaults" clears saved layouts; without this the
  // Header dropdown would show stale entries until reload).
  useEffect(() => {
    return on('spm_data_changed', () => refreshSavedLayouts());
  }, [refreshSavedLayouts]);

  // When admin edits persist an entity domain (spm_data_changed), flush that
  // domain to the backend so other devices/users stay in sync.
  useEffect(() => {
    if (!entityBackendSync.enabled) return;
    return on('spm_data_changed', (detail) => {
      const type = detail?.type;
      if (!type || type === 'all') return;
      void entityBackendSync.saveDomainToBackend(type);
    });
  }, [entityBackendSync]);
  const pushUndoSnapshot = useCallback(() => {
    const snapshot = {
      tables: [...layoutState.layout.tables], fixtures: [...layoutState.layout.fixtures],
      decor: [...(layoutState.layout.decor || [])], timestamp: Date.now(),
    };
    emit('spm_push_undo_snapshot', snapshot satisfies UndoSnapshot);
  }, [layoutState.layout]);

  const handleRestoreSnapshot = useCallback((snapshot: { tables: any[]; fixtures: any[]; decor: any[] }) => {
    layoutState.updateLayout({ tables: snapshot.tables, fixtures: snapshot.fixtures, decor: snapshot.decor || [], });
  }, [layoutState]);

  async function handleAutoRepair() {
    await createEmergencyRecoverySnapshot({ id: user.id, name: user.name });
    const repaired = recoverCorruptDomains();
    const report = buildProjectHealthReport();
    setProjectHealth(report);
    setSafeMode(report.overallStatus === 'corrupt');
    emitDataChanged('all');
    showToast(`Recovered ${repaired.length} corrupt storage domain(s).`, 'warning');
  }

  useEffect(() => {
    return subscribeToCollaborationEvents((event) => {
      if (event.type === 'layout-saved') {
        refreshSavedLayouts();
        if (event.actorName && event.actorName !== user.name) showToast(`${event.actorName} saved a newer layout revision.`, 'info');
      }
    });
  }, [refreshSavedLayouts, user.name]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEYS.SAVED_LAYOUTS) refreshSavedLayouts(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshSavedLayouts]);

  useEffect(() => on('spm_open_workspace_help', () => setShowWorkspaceHelp(true)), []);

  // Event-bus → modal wiring (the Header/Sidebar/PropertiesPanel emit these to
  // open modals without prop-drilling). Previously handled by useAppModals.
  useEffect(() => {
    const offs = [
      on('spm_open_vendors', () => open('vendors')),
      on('spm_open_timeline', () => open('timeline')),
      on('spm_open_decor_designer', (detail) => {
        if (detail?.arrangementId) setEditingArrangementId(detail.arrangementId);
        open('decorDesigner');
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [open]);

  const getTotalCapacity = useCallback(() => {
    const tableSpecs = getTableSpecs();
    return layoutState.layout.tables.reduce((sum, table) => {
      const spec = tableSpecs.find(s => s.id === table.specId);
      if (!spec) return sum;
      // Mirror the GuestPanel capacity logic so the on-canvas counter agrees
      // with the guest panel: seating rows = chairCount×rowCount; otherwise
      // customCapacity overrides the spec capacity.
      if (spec.isSeatingType) {
        const perRow = table.chairCount ?? table.customCapacity ?? spec.capacity ?? 0;
        const rowCount = Math.max(1, spec.seatingRowCount || 1);
        return sum + perRow * rowCount;
      }
      return sum + (table.customCapacity ?? spec.capacity ?? 0);
    }, 0);
  }, [layoutState.layout.tables]);

  const handleDragStart = useCallback((type: 'table' | 'fixture' | 'arrangement', specId: string, isExterior?: boolean) => {
    setDragItem({ type, specId, isExterior });
  }, []);

  const handleDragEnd = useCallback(() => setDragItem(null), []);

  const applyGridSnap = useCallback((position: Position): Position => {
    if (!snapToGrid) return position;
    return { x: Math.round(position.x / gridSize) * gridSize, y: Math.round(position.y / gridSize) * gridSize, };
  }, [snapToGrid, gridSize]);

  const resolvePlacement = useCallback((rawPosition: Position, item: { kind: 'table' | 'fixture' | 'arrangement'; specId: string; isExterior?: boolean; id?: string; showChairs?: boolean; chairType?: string; chairLayout?: any }, opts?: { silent?: boolean }) => {
    const venue = layoutState.currentVenue;
    const snapped = applyGridSnap({ ...rawPosition });
    const normalized = !!item.isExterior ? { x: Math.max(0, Math.min(snapped.x, (venue.canvasWidth || venue.width + 80) - 5)), y: Math.max(0, Math.min(snapped.y, (venue.canvasHeight || venue.height + 80) - 5)), } : { x: Math.max(0, Math.min(snapped.x, venue.width - 2)), y: Math.max(0, Math.min(snapped.y, venue.height - 2)), };
    if (item.kind === 'table') {
      const collision = checkTableCollision({ x: normalized.x, y: normalized.y, specId: item.specId, showChairs: item.showChairs ?? true, chairType: item.chairType ?? 'white-plastic', chairLayout: item.chairLayout ?? 'all-sides', }, layoutState.layout.tables, layoutState.layout.fixtures, venue, item.id);
      if (collision.collides) {
        if (!opts?.silent) showToast(collision.wallError || collision.details || `Cannot place table here.`, 'warning');
        return { ok: false as const, position: normalized };
      }
      return { ok: true as const, position: normalized };
    }
    const collision = checkFixtureCollision({ x: normalized.x, y: normalized.y, specId: item.specId, isExterior: !!item.isExterior }, layoutState.layout.tables, layoutState.layout.fixtures, venue, item.id);
    if (collision.collides) {
      if (!opts?.silent) showToast(collision.wallError || collision.details || 'Cannot place item here.', 'warning');
      return { ok: false as const, position: normalized };
    }
    return { ok: true as const, position: normalized };
  }, [layoutState, applyGridSnap]);

  const handleDrop = useCallback((position: Position, isExterior?: boolean) => {
    if (!ensureCanEditLayout()) return;
    if (!dragItem) return;
    if (dragItem.type === 'arrangement') {
      const { x, y } = position;
      const targetTable = layoutState.layout.tables.find(t => {
        const spec = getTableSpecs().find(s => s.id === t.specId);
        return spec && x >= t.x && x <= t.x + spec.width && y >= t.y && y <= t.y + spec.height;
      });
      if (targetTable) {
        layoutState.updateTable(targetTable.id, { appliedArrangementId: dragItem.specId });
        showToast(`Applied design to ${targetTable.label}`, 'success');
        setDragItem(null); return;
      }
      showToast('To apply a design, drop it onto a table.', 'info');
      setDragItem(null); return;
    }
    const placement = resolvePlacement(position, { kind: dragItem.type, specId: dragItem.specId, isExterior: !!(dragItem.isExterior || isExterior), });
    if (!placement.ok) return;
    pushUndoSnapshot();
    if (dragItem.type === 'table') layoutState.addTable(dragItem.specId, placement.position);
    else layoutState.addFixture(dragItem.specId, placement.position, dragItem.isExterior);
    setDragItem(null); setShowProperties(true);
  }, [dragItem, layoutState, resolvePlacement, ensureCanEditLayout]);

  const handleSelectItem = useCallback((id: string | null) => layoutState.setSelectedId(id), [layoutState]);
  const handleDoubleClickItem = useCallback((id: string) => { layoutState.setSelectedId(id); setShowProperties(true); }, [layoutState]);

  // A single undo snapshot is pushed once per interaction (at drag start, via
  // onDragStart, or once per discrete arrow-key nudge) so that Undo rewinds an
  // entire drag as one step rather than hundreds of per-mousemove snapshots.
  const handleMoveItem = useCallback((id: string, position: Position, isExterior?: boolean) => {
    if (!ensureCanEditLayout()) return;
    const table = layoutState.layout.tables.find(t => t.id === id);
    if (table) {
      const placement = resolvePlacement(position, { kind: 'table', id, specId: table.specId, isExterior: false, }, { silent: true });
      if (placement.ok) { layoutState.updateTable(id, { x: placement.position.x, y: placement.position.y }); }
      return;
    }
    const fixture = layoutState.layout.fixtures.find(f => f.id === id);
    if (fixture) {
      const spec = getFixtureTypes().find(s => s.id === fixture.specId);
      if (spec?.isPermanent || !canMoveFixture(user, spec!)) { showToast('Cannot move this fixture.', 'warning'); return; }
      const placement = resolvePlacement(position, { kind: 'fixture', id, specId: fixture.specId, isExterior: !!(fixture.isExterior || isExterior), }, { silent: true });
      if (placement.ok) { layoutState.updateFixture(id, { x: placement.position.x, y: placement.position.y }); }
    }
  }, [layoutState, resolvePlacement, user, ensureCanEditLayout]);

  const handleUpdateTableSafe = useCallback((id: string, updates: Partial<any>) => {
    if (!ensureCanEditLayout()) return;
    const existing = layoutState.layout.tables.find(t => t.id === id);
    if (!existing) return;
    if (updates.x === undefined && updates.y === undefined) { layoutState.updateTable(id, updates); return; }
    const placement = resolvePlacement({ x: updates.x ?? existing.x, y: updates.y ?? existing.y }, { kind: 'table', id, specId: existing.specId, ...updates });
    if (placement.ok) { pushUndoSnapshot(); layoutState.updateTable(id, { ...updates, x: placement.position.x, y: placement.position.y }); }
  }, [layoutState, resolvePlacement, ensureCanEditLayout]);

  const handleUpdateFixtureSafe = useCallback((id: string, updates: Partial<any>) => {
    if (!ensureCanEditLayout()) return;
    const existing = layoutState.layout.fixtures.find(f => f.id === id);
    if (!existing) return;
    const placement = resolvePlacement({ x: updates.x ?? existing.x, y: updates.y ?? existing.y }, { kind: 'fixture', id, specId: existing.specId, ...updates });
    if (placement.ok) { pushUndoSnapshot(); layoutState.updateFixture(id, { ...updates, x: placement.position.x, y: placement.position.y }); }
  }, [layoutState, resolvePlacement, ensureCanEditLayout]);

  const handleVenueChange = useCallback((venueId: string) => {
    // Changing venues loads that venue's master layout, which replaces the current
    // layout. If the current layout has placed (unsaved) work, ask first so a user
    // doesn't lose items silently.
    const hasWork =
      layoutState.layout.tables.length > 0 ||
      layoutState.layout.fixtures.length > 0 ||
      layoutState.layout.decor.length > 0;
    if (hasWork && venueId !== layoutState.currentVenue.id) {
      setPendingVenueChange(venueId);
      return;
    }
    layoutState.changeVenue(venueId);
    setTimeout(fitAndCenterVenue, 100);
  }, [layoutState, fitAndCenterVenue]);

  const confirmVenueChange = useCallback(() => {
    if (!pendingVenueChange) return;
    const venueId = pendingVenueChange;
    setPendingVenueChange(null);
    layoutState.changeVenue(venueId);
    setTimeout(fitAndCenterVenue, 100);
  }, [pendingVenueChange, layoutState, fitAndCenterVenue]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      const mod = e.ctrlKey || e.metaKey;
      if ((e.key === 'Delete' || e.key === 'Backspace')) { if (layoutState.selectedId) { e.preventDefault(); layoutState.removeItem(layoutState.selectedId); } }
      else if (mod && (e.key === 'd' || e.key === 'D')) {
        if (layoutState.selectedId) { e.preventDefault(); pushUndoSnapshot(); layoutState.duplicateItem(layoutState.selectedId); }
      }
      else if (e.key === 'p' || e.key === 'P') { if (!mod) { setShowProperties(v => !v); } }
      else if (e.key === '?') { e.preventDefault(); setShowWorkspaceHelp(true); }
      else if (mod && e.key === '1') { e.preventDefault(); handleResetToVenue(); }
      else if (mod && e.key === '0') { e.preventDefault(); handleResetToCanvas(); }
      else if (e.key === 'Escape') { layoutState.setSelectedId(null); setShowProperties(false); setDragItem(null); }
    };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [layoutState, pushUndoSnapshot, handleResetToVenue, handleResetToCanvas]);

  useEffect(() => { rootStyles(brandingConfig); }, [brandingConfig]);

  // Keep the browser tab title in sync with the configured venue name (branding).
  useEffect(() => {
    document.title = brandingConfig.venueName
      ? `${brandingConfig.venueName} | Wedding Layout Planner`
      : 'Wedding Layout Planner';
  }, [brandingConfig.venueName]);

  // Save/delete wrappers that flush to the shared backend after the local
  // localStorage write (no-op when the platform backend is disabled).
  const handleSaveLayoutWithSync = useCallback(
    (name: string) => {
      const id = layoutState.saveLayout(name);
      void layoutBackendSync.saveToBackend();
      showToast(`Layout "${name}" saved.`, 'success');
      return id;
    },
    [layoutState, layoutBackendSync],
  );

  const handleDeleteSavedLayoutWithSync = useCallback(
    (id: string) => {
      setSavedLayoutsState((prev) => {
        const next = prev.filter((l) => l.id !== id);
        setSavedLayouts(next);
        return next;
      });
      void layoutBackendSync.saveToBackend();
      showToast('Saved layout deleted.', 'success');
    },
    [layoutBackendSync],
  );

  if (view === 'dashboard') {
    return (
      <VenueDashboard
        user={user}
        isAdmin={isAdmin}
        isStaff={isStaff}
        canAdmin={canOpenAdminPanel}
        canOps={canOpenOperationsPanel}
        canGuests={canOpenGuestPanel}
        onOpenAdmin={() => { setView('studio'); open('admin'); }}
        onOpenOperations={() => { setView('studio'); open('operations'); }}
        onOpenGuests={() => { setView('studio'); open('guests'); }}
        onOpenVendors={() => { setView('studio'); open('vendors'); }}
        onOpenTimeline={() => { setView('studio'); open('timeline'); }}
        onOpenStudio={() => setView('studio')}
        onLogout={logout}
        adminNode={
          canOpenAdminPanel ? (
            <AdminPanel
              inline
              onClose={() => setView('studio')}
              currentLayout={{ tables: layoutState.layout.tables, fixtures: layoutState.layout.fixtures, venueId: layoutState.currentVenue.id, category: layoutState.currentVenue.category }}
              onLoadTemplateForEdit={(t) => { if (t.venueId !== layoutState.currentVenue.id) layoutState.changeVenue(t.venueId); layoutState.loadTemplate(t); handleResetView(); }}
            />
          ) : undefined
        }
        opsNode={
          canOpenOperationsPanel ? (
            <StaffOperationsPanel
              inline
              onClose={() => setView('studio')}
              currentUser={user}
              isAdmin={isAdmin}
              venueId={layoutState.currentVenue.id}
              eventName={currentEventName}
              users={allUsers}
              venues={selectableVenues}
            />
          ) : undefined
        }
      />
    );
  }

  return (
    <UndoRedoProvider onRestore={handleRestoreSnapshot}>
      <div className="h-screen flex flex-col overflow-hidden" style={{ fontFamily: brandingConfig.fontFamily, backgroundColor: brandingConfig.backgroundColor, color: brandingConfig.bodyTextColor }}>
        <Header
          currentVenue={layoutState.currentVenue} venues={selectableVenues} selectedVenueCategories={selectedVenueCategories} onChangeVenueCategories={setSelectedVenueCategories} onChangeVenue={handleVenueChange}
          onSaveLayout={handleSaveLayoutWithSync} onSaveMasterLayout={isAdmin ? () => { layoutState.saveMasterLayout(); showToast(`Saved as the master layout for ${layoutState.currentVenue.name}.`, 'success'); } : undefined} onClearMasterLayout={isAdmin ? () => { layoutState.clearMasterLayout(); showToast('Master layout cleared.', 'success'); } : undefined} onPrint={() => open('print')}
          onShowTemplates={() => open('templates')} onShowGuests={() => open('guests')} onShowAdmin={canOpenAdminPanel ? () => open('admin') : undefined} onShowDashboard={() => { closeAll(); setView('dashboard'); }} onLogout={logout} userName={user.name} isAdmin={isAdmin} isStaff={isStaff}
          onOpenOperations={canOpenOperationsPanel ? () => open('operations') : undefined} savedLayouts={savedLayouts} onLoadSavedLayout={layoutState.loadLayout} onDeleteSavedLayout={handleDeleteSavedLayoutWithSync}
          mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} onShowWorkspaceHelp={() => setShowWorkspaceHelp(true)} currentUser={user}
        />
        <AppStatusBar items={statusItems} />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar
            width={sidebarWidth} collapsed={sidebarCollapsed} onWidthChange={setSidebarWidth} onCollapsedChange={setSidebarCollapsed} zoom={zoom} onZoomChange={setZoom} showGrid={showGrid} onShowGridChange={setShowGrid} gridSize={gridSize} onGridSizeChange={setGridSize} gridContrast={gridContrast} onGridContrastChange={setGridContrast} snapToGrid={snapToGrid} onSnapToGridChange={setSnapToGrid}
            onDragStart={handleDragStart} onDragEnd={handleDragEnd} currentDragItem={dragItem} onClearLayout={layoutState.clearLayout} isAdmin={isAdmin} onViewImage={(url, title) => setImagePreview({ url, title })}
            layoutCategories={layoutCategories} currentVenueCategory={layoutState.currentVenue.category} venueWidth={layoutState.currentVenue.width} venueHeight={layoutState.currentVenue.height} canvasWidth={layoutState.currentVenue.canvasWidth} canvasHeight={layoutState.currentVenue.canvasHeight}
            onResetView={handleResetView} onResetToVenue={handleResetToVenue} onResetToCanvas={handleResetToCanvas} placedTables={layoutState.layout.tables} placedFixtures={layoutState.layout.fixtures} currentUser={user}
          />
          <div ref={canvasContainerRef} className="flex-1 relative overflow-hidden">
            <FloorPlanCanvas
              venue={layoutState.currentVenue} tables={layoutState.layout.tables} fixtures={layoutState.layout.fixtures} decor={layoutState.layout.decor} guests={layoutState.guests} selectedId={layoutState.selectedId} zoom={zoom} showGrid={showGrid} gridSize={gridSize} gridContrast={gridContrast}
              onSelect={handleSelectItem} onDoubleClick={handleDoubleClickItem} onMove={handleMoveItem} onDrop={handleDrop} onClickToPlace={handleDrop} onDragStart={pushUndoSnapshot} isDragging={!!dragItem} isDraggingExterior={dragItem?.isExterior || false} isAdmin={isAdmin} onViewImage={(url, title) => setImagePreview({ url, title })} panOffset={panOffset} onPanChange={setPanOffset} onZoomChange={setZoom} svgRef={floorPlanSvgRef}
            />
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <div className="bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-lg text-sm">
                <span className="font-medium">Capacity:</span> <span className={getTotalCapacity() > layoutState.currentVenue.capacity ? 'text-red-600 font-bold' : 'text-green-600'}>{getTotalCapacity()} / {layoutState.currentVenue.capacity}</span>
              </div>
              <button
                type="button"
                onClick={() => open('overview')}
                className="bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-lg text-sm font-medium hover:bg-white"
                aria-label="Open event overview dashboard"
              >
                📊 Overview
              </button>
            </div>
            <UndoRedoToolbar />
            {layoutState.warnings.length > 0 &&
              dismissedWarningsKey !== layoutState.warnings.map((w) => w.id).join('|') && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[min(28rem,92%)] pointer-events-none">
                <div className="bg-amber-50 border border-amber-300 rounded-xl shadow-lg p-3 text-sm text-amber-900 pointer-events-auto">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold mb-1">
                      ⚠️ {layoutState.warnings.length} layout warning{layoutState.warnings.length === 1 ? '' : 's'}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDismissedWarningsKey(layoutState.warnings.map((w) => w.id).join('|'))
                      }
                      className="text-amber-700 hover:text-amber-900 font-bold leading-none"
                      aria-label="Dismiss layout warnings"
                      title="Dismiss (warnings reappear if new issues arise)"
                    >
                      ✕
                    </button>
                  </div>
                  <ul className="text-xs space-y-0.5 max-h-24 overflow-y-auto mt-1">
                    {layoutState.warnings.slice(0, 5).map((w) => (
                      <li key={w.id}>• {w.message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {isMasterBasicUser && (
              <div className="absolute bottom-4 left-44 z-20 flex gap-2">
                <button onClick={() => open('messages')} className="bg-[#4A1942] text-white rounded-xl shadow-lg px-3 py-2 text-sm font-medium">💬 Messages</button>
                <button onClick={() => open('submission')} className="bg-[#4A1942] text-white rounded-xl shadow-lg px-3 py-2 text-sm font-medium">📤 Submit</button>
                <button onClick={() => open('eventQuestions')} className="bg-[#4A1942] text-white rounded-xl shadow-lg px-3 py-2 text-sm font-medium">📝 Questions</button>
              </div>
            )}
          </div>
          <PropertiesPanel
            selectedId={layoutState.selectedId} tables={layoutState.layout.tables} fixtures={layoutState.layout.fixtures} guests={layoutState.guests} onUpdateTable={handleUpdateTableSafe} onUpdateFixture={handleUpdateFixtureSafe}
            onRemoveItem={layoutState.removeItem} onDuplicateItem={layoutState.duplicateItem} onClose={() => setShowProperties(false)} onAddGuest={(name, tableId) => layoutState.addGuest(name, undefined, tableId)} onRemoveGuestFromTable={(id) => layoutState.assignGuestToTable(id, null)}
            onViewImage={(url, title) => setImagePreview({ url, title })} visible={showProperties} onToggleVisibility={() => setShowProperties(v => !v)} arrangements={layoutState.getDecorArrangements()}
          />
        </div>
        <Suspense fallback={null}>
          {showGuests && canOpenGuestPanel && <GuestPanel guests={layoutState.guests} tables={layoutState.layout.tables} fixtures={layoutState.layout.fixtures} venue={layoutState.currentVenue} eventName={currentEventName} venueName={layoutState.currentVenue.name} onAddGuest={layoutState.addGuest} onUpdateGuest={layoutState.updateGuest} onRemoveGuest={layoutState.removeGuest} onAssignToTable={layoutState.assignGuestToTable} onAssignToRoom={layoutState.assignGuestToRoom} onImportCSV={layoutState.importGuestsFromCSV} onExportCSV={layoutState.exportGuestsToCSV} onClose={() => close('guests')} />}
          {showOperations && (
            <StaffOperationsPanel
              onClose={() => close('operations')}
              currentUser={user}
              isAdmin={isAdmin}
              venueId={layoutState.currentVenue.id}
              eventName={currentEventName}
              users={allUsers}
              venues={selectableVenues}
            />
          )}
          {showVendors && <VendorPanel onClose={() => close('vendors')} />}
          {showTimeline && <TimelinePanel onClose={() => close('timeline')} />}
          {showPrint && canPrintCurrentLayout && (
            <PrintView
              venue={layoutState.currentVenue}
              tables={layoutState.layout.tables}
              fixtures={layoutState.layout.fixtures}
              guests={layoutState.guests}
              layoutName={currentEventName}
              exportSvgRef={floorPlanSvgRef}
              onClose={() => close('print')}
            />
          )}
          {showEventQuestions && (
            <CenteredModal title="Event Questions" onClose={() => close('eventQuestions')}>
              <EventQuestionsWizard
                questions={eventQuestions}
                initialAnswers={currentEventAnswers}
                userId={user.id}
                eventId={currentEventName}
                onSaveAnswers={saveEventAnswers}
                onVenueFilterChange={setSelectedVenueCategories}
                onComplete={() => close('eventQuestions')}
              />
            </CenteredModal>
          )}
          {showSubmission && (
            <CenteredModal title="Submission Status" onClose={() => close('submission')}>
              <SubmissionStatusPanel
                eventName={currentEventName}
                selectedVenueIds={selectableVenues.map((v) => v.id)}
                answers={currentEventAnswers}
                submission={currentSubmission}
                onSubmit={() => {
                  submissionWorkflow.submit({
                    eventName: currentEventName,
                    masterUserId: user.id,
                    masterUserName: user.name,
                    selectedVenueIds: selectableVenues.map((v) => v.id),
                    answers: currentEventAnswers,
                  });
                  showToast('Layout submitted for approval.', 'success');
                }}
              />
            </CenteredModal>
          )}
          {showMessages && (
            <CenteredModal title="Messages" onClose={() => close('messages')}>
              <DirectMessagePanel
                title="Messages"
                threadId={masterThreadId}
                currentUserId={user.id}
                currentUserName={user.name}
                currentUserRole="admin"
              />
            </CenteredModal>
          )}
          {showDecorDesigner && <DecorDesigner onClose={() => close('decorDesigner')} onSave={(a) => { const currentArrangements = layoutState.getDecorArrangements(); const nextArrangements = currentArrangements.find(x => x.id === a.id) ? currentArrangements.map(x => x.id === a.id ? a : x) : [...currentArrangements, a]; layoutState.setDecorArrangements(nextArrangements); close('decorDesigner'); }} initialArrangement={editingArrangementId ? layoutState.getDecorArrangements().find(a => a.id === editingArrangementId) : null} />}
          {showAdmin && <AdminPanel onClose={() => { close('admin'); layoutState.refreshVenues(); setBrandingConfig(getConfig()); }} currentLayout={{ tables: layoutState.layout.tables, fixtures: layoutState.layout.fixtures, venueId: layoutState.currentVenue.id, category: layoutState.currentVenue.category }} onLoadTemplateForEdit={(t) => { if (t.venueId !== layoutState.currentVenue.id) layoutState.changeVenue(t.venueId); layoutState.loadTemplate(t); handleResetView(); }} />}
          {showOverview && (
            <EventOverview
              guests={layoutState.guests}
              tables={layoutState.layout.tables}
              tableSpecs={getTableSpecs()}
              venue={layoutState.currentVenue}
              eventName={currentEventName}
              venueName={layoutState.currentVenue.name}
              onOpenGuests={() => { close('overview'); open('guests'); }}
              canManageGuests={canOpenGuestPanel}
              onOpenVendors={() => { close('overview'); open('vendors'); }}
              onOpenTemplates={() => { close('overview'); open('templates'); }}
              onClose={() => close('overview')}
            />
          )}
          {showTemplates && (
            <TemplateSelector
              templates={getTemplates()}
              layoutCategories={layoutCategories}
              onSelect={(t) => {
                // Warn before a template overwrites non-empty current work.
                const hasWork =
                  layoutState.layout.tables.length > 0 ||
                  layoutState.layout.fixtures.length > 0 ||
                  (layoutState.layout.decor || []).length > 0;
                const proceed = () => {
                  if (t.venueId !== layoutState.currentVenue.id) layoutState.changeVenue(t.venueId);
                  layoutState.loadTemplate(t);
                  handleResetView();
                  close('templates');
                };
                if (hasWork) {
                  setPendingOverwrite(() => proceed);
                  return;
                }
                proceed();
              }}
              onClose={() => close('templates')}
            />
          )}
          {showWorkspaceHelp && <WorkspaceHelp onClose={() => setShowWorkspaceHelp(false)} />}
          {imagePreview && (
            <CenteredModal title={imagePreview.title || 'Image Preview'} onClose={() => setImagePreview(null)}>
              <div className="max-h-[70vh] overflow-auto">
                <img
                  src={imagePreview.url}
                  alt={imagePreview.title || 'Preview'}
                  className="mx-auto max-h-[65vh] rounded-lg object-contain shadow-lg"
                  onClick={() => setImagePreview(null)}
                />
              </div>
            </CenteredModal>
          )}
          {showWelcome && (
            <WelcomeModal
              onClose={() => setShowWelcome(false)}
              isAdmin={isAdmin}
              isGuest={isGuest}
            />
          )}
          <ConfirmDialog
            open={!!pendingVenueChange}
            title="Switch venues?"
            message="Your current layout has placed items that haven't been saved. Switching venues will load that venue's master layout and discard this work. Continue?"
            confirmLabel="Discard & Switch"
            onConfirm={() => confirmVenueChange()}
            onCancel={() => setPendingVenueChange(null)}
          />
          {/* ... other modals similarly refactored ... */}

          <ConfirmDialog
            open={!!pendingOverwrite}
            title="Replace current layout?"
            message="Loading a template will replace your current layout. This cannot be undone."
            confirmLabel="Replace"
            onConfirm={() => {
              pendingOverwrite?.();
              setPendingOverwrite(null);
            }}
            onCancel={() => setPendingOverwrite(null)}
          />
        </Suspense>
      </div>
    </UndoRedoProvider>
  );
}

function rootStyles(config: any) {
  const root = document.documentElement;
  root.style.setProperty('--primary-color', config.primaryColor);
  root.style.setProperty('--primary-dark', config.primaryDark);
  root.style.setProperty('--primary-light', config.primaryLight);
  root.style.setProperty('--accent-color', config.accentColor);
  root.style.setProperty('--background-color', config.backgroundColor);
  root.style.setProperty('--text-color', config.textColor);
  root.style.setProperty('--font-family', config.fontFamily);
  root.style.setProperty('--heading-font-family', config.headingFontFamily);
  root.style.setProperty('--header-text-color', config.headerTextColor);
  root.style.setProperty('--body-text-color', config.bodyTextColor);
  root.style.setProperty('--accent-text-color', config.accentTextColor);
}
