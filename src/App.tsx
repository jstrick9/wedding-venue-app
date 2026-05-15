import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useLayoutState, getSavedLayouts, setSavedLayouts, getTemplates, getTableSpecs, getFixtureTypes } from './hooks/useLayoutState';
import { LayoutTemplate, EventAnswer, EventQuestion, PlacedTable, PlacedFixture } from './types';
import { layoutCategories, getSpacingSettings } from './data/venueData';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { FloorPlanCanvas } from './components/FloorPlanCanvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { lazy, Suspense } from 'react';
// Always-present shell components – eager imports
import { WelcomeModal } from './components/WelcomeModal';
import { ToastContainer, showToast } from './components/Toast';
import { LiveRegion, announce } from './components/LiveRegion';
import AppStatusBar, { StatusBarItem } from './components/AppStatusBar';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import SafeImage from './components/SafeImage';
import ModalDialog from './components/ModalDialog';
import { buildMessageThreadId } from './models/DirectMessage';
import { useSubmissionWorkflow } from './hooks/useSubmissionWorkflow';

// ─── Lazy-loaded modal / portal components ───────────────────────────────────
// These are gated by showXxx flags or URL hash – load them only when needed.
// A single Suspense boundary wraps the whole modals section below.
const DecorDesigner = lazy(() =>
  import('./components/DecorDesigner').then((m) => ({ default: m.DecorDesigner })),
);
const GuestPanel = lazy(() =>
  import('./components/GuestPanel').then((m) => ({ default: m.GuestPanel })),
);
const StaffOperationsPanel = lazy(() => import('./components/StaffOperationsPanel'));
const GuestPortal = lazy(() => import('./components/GuestPortal'));
const AdminPanel = lazy(() =>
  import('./components/AdminPanel').then((m) => ({ default: m.AdminPanel })),
);
const PrintView = lazy(() =>
  import('./components/PrintView').then((m) => ({ default: m.PrintView })),
);
const TemplateSelector = lazy(() =>
  import('./components/TemplateSelector').then((m) => ({ default: m.TemplateSelector })),
);
const DirectMessagePanel = lazy(() =>
  import('./components/DirectMessagePanel').then((m) => ({ default: m.DirectMessagePanel })),
);
const SubmissionStatusPanel = lazy(() =>
  import('./components/SubmissionStatusPanel').then((m) => ({ default: m.SubmissionStatusPanel })),
);
const EventQuestionsWizard = lazy(() =>
  import('./components/EventQuestionsWizard').then((m) => ({ default: m.EventQuestionsWizard })),
);
const VendorPanel = lazy(() =>
  import('./components/VendorPanel').then((m) => ({ default: m.VendorPanel })),
);
const TimelinePanel = lazy(() =>
  import('./components/TimelinePanel').then((m) => ({ default: m.TimelinePanel })),
);
// ─────────────────────────────────────────────────────────────────────────────

import { getConfig } from './config';
import { checkTableCollision, checkFixtureCollision } from './utils/collisionDetection';
import { getGuestPortalTokenFromLocation } from './utils/guestPortal';
import { subscribeToCollaborationEvents } from './utils/collaborationChannel';
import {
  buildProjectHealthReport,
  createEmergencyRecoverySnapshot,
  recoverCorruptDomains,
  type ProjectHealthReport,
} from './utils/recovery';
import { STORAGE_KEYS } from './constants/storageKeys';
import {
  canAccessAdminPanel,
  canAccessOperationsPanel,
  canEditLayout,
  canManageGuests,
  canMoveFixture,
  canPrintLayouts,
} from './utils/permissions';
import { UndoRedoProvider } from './contexts/UndoRedoContext';
import { UndoRedoToolbar } from './components/UndoRedoToolbar';
import { emit, emitDataChanged, on, type UndoSnapshot } from './utils/appEvents';
import { useAppModals } from './hooks/useAppModals';

// Position type
interface Position {
  x: number;
  y: number;
}

// Drag item type
interface DragItem {
  type: 'table' | 'fixture' | 'arrangement';
  specId: string;
  isExterior?: boolean;
}

function AuthenticatedApp() {
  const { user: authUser, isAdmin, isGuest, logout, getAllUsers } = useAuth();
  const user = authUser!;
  const allUsers = getAllUsers();
  const isStaff = user?.role === 'staff';
  const layoutState = useLayoutState();
  const canOpenAdminPanel = canAccessAdminPanel(user);
  const canOpenOperationsPanel = canAccessOperationsPanel(user);
  const canOpenGuestPanel = canManageGuests(user);
  const canPrintCurrentLayout = canPrintLayouts(user);
  const canEditCurrentLayout = canEditLayout(user);
  
  // Refs for centering
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  
  // Branding config state - reloads when admin panel closes
  const [brandingConfig, setBrandingConfig] = useState(() => getConfig());
  const [projectHealth, setProjectHealth] = useState<ProjectHealthReport | null>(null);
  const [safeMode, setSafeMode] = useState(false);
  // All modal/panel open-state lives in one hook so that:
  //   - the typed event-bus subscriptions for spm_open_* are co-located, and
  //   - the file no longer needs ~12 useState hooks for what is conceptually
  //     a single "which modals are visible?" map.
  // We keep the original `showXxx` / `setShowXxx` local names to avoid touching
  // every call site downstream — the local consts below are a thin facade.
  const _modals = useAppModals();
  const editingArrangementId = _modals.editingArrangementId;
  const setEditingArrangementId = _modals.setEditingArrangementId;
  const showVendors = _modals.modals.vendors;
  const setShowVendors = (v: boolean) => (v ? _modals.open('vendors') : _modals.close('vendors'));
  const showTimeline = _modals.modals.timeline;
  const setShowTimeline = (v: boolean) => (v ? _modals.open('timeline') : _modals.close('timeline'));
  const showGuests = _modals.modals.guests;
  const setShowGuests = (v: boolean) => (v ? _modals.open('guests') : _modals.close('guests'));
  const showAdmin = _modals.modals.admin;
  const setShowAdmin = (v: boolean) => (v ? _modals.open('admin') : _modals.close('admin'));
  const showTemplates = _modals.modals.templates;
  const setShowTemplates = (v: boolean) => (v ? _modals.open('templates') : _modals.close('templates'));
  const showPrint = _modals.modals.print;
  const setShowPrint = (v: boolean) => (v ? _modals.open('print') : _modals.close('print'));
  const showOperations = _modals.modals.operations;
  const setShowOperations = (v: boolean) => (v ? _modals.open('operations') : _modals.close('operations'));
  const showMessages = _modals.modals.messages;
  const setShowMessages = (v: boolean) => (v ? _modals.open('messages') : _modals.close('messages'));
  const showSubmission = _modals.modals.submission;
  const setShowSubmission = (v: boolean) => (v ? _modals.open('submission') : _modals.close('submission'));
  const showEventQuestions = _modals.modals.eventQuestions;
  const setShowEventQuestions = (v: boolean) =>
    (v ? _modals.open('eventQuestions') : _modals.close('eventQuestions'));
  const showDecorDesigner = _modals.modals.decorDesigner;
  const setShowDecorDesigner = (v: boolean) =>
    (v ? _modals.open('decorDesigner') : _modals.close('decorDesigner'));

  // Local UI state
  const [zoom, setZoom] = useState(1);
  // Grid functionality removed from canvas/layout tools by request.
  const showGrid = false;
  const gridSize = 1;
  const gridContrast = 0.45;
  const snapToGrid = false;
  const [showProperties, setShowProperties] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [savedLayouts, setSavedLayoutsState] = useState(() => getSavedLayouts());
  const [imagePreview, setImagePreview] = useState<{ url: string; title: string } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedVenueCategories, setSelectedVenueCategories] = useState<string[]>([]);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [showFloatingViewControls, setShowFloatingViewControls] = useState(true);
  const [floatingViewControlsPos, setFloatingViewControlsPos] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [draggingViewControls, setDraggingViewControls] = useState(false);
  const [showWorkspaceHelp, setShowWorkspaceHelp] = useState(false);
  const [viewControlsDragOffset, setViewControlsDragOffset] = useState({ x: 0, y: 0 });
  const [showWelcome, setShowWelcome] = useState(() => {
    // Check if admin has disabled welcome by default
    const config = getConfig();
    if (config.showWelcomeByDefault === false) return false;
    
    // Always show welcome by default - the actual hide logic is handled below
    return true;
  });
  
  useEffect(() => {
    const report = buildProjectHealthReport();
    setProjectHealth(report);

    if (report.overallStatus === 'corrupt') {
      setSafeMode(true);
    }
  }, []);

  // Effect to handle welcome modal visibility based on user type
  useEffect(() => {
    if (!user) return;

    // Admin users should never see the welcome modal.
    if (isAdmin) {
      setShowWelcome(false);
      return;
    }
    
    // For guests, always show the welcome modal (no ability to permanently hide)
    if (isGuest) {
      const config = getConfig();
      if (config.showWelcomeByDefault !== false) {
        setShowWelcome(true);
      }
      return;
    }
    
    // For admin and basic users, check if they've hidden it permanently
    const permanentlyHidden = localStorage.getItem(STORAGE_KEYS.WELCOME_HIDDEN) === 'true';
    if (permanentlyHidden) {
      setShowWelcome(false);
    }
  }, [user, isGuest, isAdmin]);
  
  const selectableVenues = (isAdmin
    ? layoutState.venues
    : layoutState.venues.filter(v => v.isMaster !== false)
  ).filter(v => selectedVenueCategories.length === 0 || selectedVenueCategories.includes(v.category));

  const isMasterBasicUser = user.role === 'basic' && (user.userRole === 'master' || user.isMasterUser === true);
  const currentEventName = user.eventName || user.department || 'general';
  const masterThreadId = buildMessageThreadId(currentEventName, user.id);
  const submissionWorkflow = useSubmissionWorkflow();

  // ── Reactive event-answers ───────────────────────────────────────────────
  // Read answers from localStorage into state so they are reactive across
  // re-renders without the `showSubmission` staleness hack (B-08 fix).
  const readEventAnswers = useCallback((): EventAnswer[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EVENT_ANSWERS);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as EventAnswer[];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((a) => a.userId === user.id && a.eventId === currentEventName);
    } catch {
      return [];
    }
  }, [user.id, currentEventName]);

  const [currentEventAnswers, setCurrentEventAnswers] = useState<EventAnswer[]>(readEventAnswers);

  // Keep answers fresh whenever any part of the app writes new data.
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
    } catch {
      return [] as EventQuestion[];
    }
  }, [showAdmin]);

  const saveEventAnswers = useCallback((answers: EventAnswer[]) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EVENT_ANSWERS);
      const existing = raw ? (JSON.parse(raw) as EventAnswer[]) : [];
      const filtered = (Array.isArray(existing) ? existing : []).filter(
        (a) => !(a.userId === user.id && a.eventId === currentEventName),
      );
      localStorage.setItem(STORAGE_KEYS.EVENT_ANSWERS, JSON.stringify([...filtered, ...answers]));
    } catch {
      // ignore local storage errors in frontend-only mode
    }
  }, [user.id, currentEventName]);

  const currentSubmission = submissionWorkflow.getByMasterAndEvent(user.id, currentEventName);

  const statusItems = useMemo<StatusBarItem[]>(() => {
    const items: StatusBarItem[] = [];

    if (safeMode) {
      items.push({
        id: 'safe-mode',
        kind: 'warning',
        title: 'Safe Mode is active',
        description:
          'Some local project data appears damaged. Advanced actions may be limited until recovery is reviewed.',
        actions: [
          {
            label: 'Attempt Auto-Repair',
            onClick: () => {
              void handleAutoRepair();
            },
          },
          {
            label: 'Reload App',
            onClick: () => {
              window.location.reload();
            },
          },
        ],
      });
    } else if (projectHealth?.overallStatus === 'warning') {
      items.push({
        id: 'health-warning',
        kind: 'warning',
        title: 'Project health warning',
        description:
          'Some local project data may be incomplete or inconsistent. Review recovery tools if you notice issues.',
        actions: [
          {
            label: 'Reload App',
            onClick: () => {
              window.location.reload();
            },
          },
        ],
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
  
  // Calculate zoom to fit venue and center it on screen
  const fitAndCenterVenue = useCallback(() => {
    if (!canvasContainerRef.current) return;
    
    const container = canvasContainerRef.current;
    const venue = layoutState.currentVenue;
    const padding = venue.exteriorPadding || { top: 40, right: 30, bottom: 30, left: 40 };
    const scale = 8;
    
    // Use canvas size from venue settings, or calculate from padding
    const canvasWidth = venue.canvasWidth 
      ? venue.canvasWidth * scale 
      : (venue.width + padding.left + padding.right) * scale;
    const canvasHeight = venue.canvasHeight 
      ? venue.canvasHeight * scale 
      : (venue.height + padding.top + padding.bottom) * scale;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Calculate zoom to fit the entire canvas with some margin
    const marginPx = 40; // 20px margin on each side
    const availableWidth = containerWidth - marginPx;
    const availableHeight = containerHeight - marginPx;
    
    const zoomX = availableWidth / canvasWidth;
    const zoomY = availableHeight / canvasHeight;
    
    // Use the smaller zoom to ensure entire canvas fits
    // Cap between 0.25 and 1.5
    const newZoom = Math.min(1.5, Math.max(0.25, Math.min(zoomX, zoomY)));
    
    // Calculate offset to center with new zoom
    const scaledCanvasWidth = canvasWidth * newZoom;
    const scaledCanvasHeight = canvasHeight * newZoom;
    
    const offsetX = Math.max(20, (containerWidth - scaledCanvasWidth) / 2);
    const offsetY = Math.max(20, (containerHeight - scaledCanvasHeight) / 2);
    
    setZoom(newZoom);
    setPanOffset({ x: offsetX, y: offsetY });
  }, [layoutState.currentVenue]);
  
  // Center the venue on the screen with current zoom (kept for potential future use)
  // Using fitAndCenterVenue instead which calculates optimal zoom

  // Reset view function - fits entire venue on screen
  const handleResetView = useCallback(() => {
    fitAndCenterVenue();
  }, [fitAndCenterVenue]);
  
  // Permission check helper - defined early so it can be used in callbacks
  function ensureCanEditLayout(): boolean {
    if (canEditCurrentLayout) return true;
    showToast('You do not have permission to edit this layout.', 'warning');
    return false;
  }
  
  // Reset to venue only (without exterior features)
  const handleResetToVenue = useCallback(() => {
    if (!canvasContainerRef.current) return;

    const container = canvasContainerRef.current;
    const venue = layoutState.currentVenue;
    const scale = 8;
    const padding = venue.exteriorPadding || { top: 40, right: 30, bottom: 30, left: 40 };

    const venueOffsetX = (venue.venueX ?? padding.left) * scale;
    const venueOffsetY = (venue.venueY ?? padding.top) * scale;

    let minX = venueOffsetX;
    let minY = venueOffsetY;
    let maxX = venueOffsetX + venue.width * scale;
    let maxY = venueOffsetY + venue.height * scale;

    if (venue.shape === 'custom' && venue.shapePoints && venue.shapePoints.length >= 3) {
      const xs = venue.shapePoints.map((p) => venueOffsetX + p.x * scale);
      const ys = venue.shapePoints.map((p) => venueOffsetY + p.y * scale);
      minX = Math.min(...xs);
      minY = Math.min(...ys);
      maxX = Math.max(...xs);
      maxY = Math.max(...ys);
    }

    const shapeWidth = Math.max(1, maxX - minX);
    const shapeHeight = Math.max(1, maxY - minY);

    const margin = 40;
    const containerWidth = container.clientWidth - margin;
    const containerHeight = container.clientHeight - margin;

    const zoomX = containerWidth / shapeWidth;
    const zoomY = containerHeight / shapeHeight;
    const newZoom = Math.min(zoomX, zoomY, 1);

    const panX = (container.clientWidth - shapeWidth * newZoom) / 2 - minX * newZoom;
    const panY = (container.clientHeight - shapeHeight * newZoom) / 2 - minY * newZoom;

    setZoom(newZoom);
    setPanOffset({ x: panX, y: panY });
  }, [layoutState.currentVenue]);
  
  // Reset to full canvas (including exterior features)
  const handleResetToCanvas = useCallback(() => {
    if (!canvasContainerRef.current) return;
    
    const container = canvasContainerRef.current;
    const venue = layoutState.currentVenue;
    const scale = 8;
    const padding = venue.exteriorPadding || { top: 40, right: 30, bottom: 30, left: 40 };
    
    // Calculate full canvas size
    const canvasWidth = venue.canvasWidth 
      ? venue.canvasWidth * scale 
      : (venue.width + padding.left + padding.right) * scale;
    const canvasHeight = venue.canvasHeight 
      ? venue.canvasHeight * scale 
      : (venue.height + padding.top + padding.bottom) * scale;
    
    const containerWidth = container.clientWidth - 40;
    const containerHeight = container.clientHeight - 40;
    
    const zoomX = containerWidth / canvasWidth;
    const zoomY = containerHeight / canvasHeight;
    const newZoom = Math.min(zoomX, zoomY, 2);
    
    // Center the full canvas
    const panX = (containerWidth - canvasWidth * newZoom) / 2 + 20;
    const panY = (containerHeight - canvasHeight * newZoom) / 2 + 20;
    
    setZoom(newZoom);
    setPanOffset({ x: panX, y: panY });
  }, [layoutState.currentVenue]);
  
  // Reset view when venue changes - fit to venue (not canvas) at 100% max zoom
  useEffect(() => {
    layoutState.setOnVenueChange(() => {
      setTimeout(() => {
        if (!canvasContainerRef.current) return;
        
        const container = canvasContainerRef.current;
        const venue = layoutState.currentVenue;
        const scale = 8;
        const padding = venue.exteriorPadding || { top: 40, right: 30, bottom: 30, left: 40 };
        
        const venueWidth = venue.width * scale;
        const venueHeight = venue.height * scale;
        
        const containerWidth = container.clientWidth - 40;
        const containerHeight = container.clientHeight - 40;
        
        const zoomX = containerWidth / venueWidth;
        const zoomY = containerHeight / venueHeight;
        // Cap zoom at 100% (1.0)
        const newZoom = Math.min(zoomX, zoomY, 1);
        
        const venueX = (venue.venueX || padding.left) * scale;
        const venueY = (venue.venueY || padding.top) * scale;
        
        const panX = (containerWidth - venueWidth * newZoom) / 2 - venueX * newZoom + 20;
        const panY = (containerHeight - venueHeight * newZoom) / 2 - venueY * newZoom + 20;
        
        setZoom(newZoom);
        setPanOffset({ x: panX, y: panY });
      }, 100);
    });
  }, [layoutState]);
  
  // Refresh saved layouts
  const refreshSavedLayouts = useCallback(() => {
    setSavedLayoutsState(getSavedLayouts());
  }, []);
  
  // Undo/Redo snapshot helper
  const pushUndoSnapshot = useCallback(() => {
    const snapshot = {
      tables: [...layoutState.layout.tables],
      fixtures: [...layoutState.layout.fixtures],
      decor: [...(layoutState.layout.decor || [])],
      timestamp: Date.now(),
    };
    emit('spm_push_undo_snapshot', snapshot satisfies UndoSnapshot);
  }, [layoutState.layout]);

  // Restore from undo/redo snapshot
  const handleRestoreSnapshot = useCallback((snapshot: { tables: any[]; fixtures: any[]; decor: any[] }) => {
    layoutState.updateLayout({
      tables: snapshot.tables,
      fixtures: snapshot.fixtures,
      decor: snapshot.decor || [],
    });
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

        if (event.actorName && event.actorName !== user.name) {
          showToast(`${event.actorName} saved a newer layout revision.`, 'info');
        }
      }
    });
  }, [refreshSavedLayouts, user.name]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'spm_savedLayouts') {
        refreshSavedLayouts();
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshSavedLayouts]);
  
  // Modal-open subscriptions live inside useAppModals(); see src/hooks/useAppModals.ts.

  // Surface storage failures (quota exceeded, corrupt JSON, etc.) to the user.
  // Previously emitted into the void; now goes through the typed event bus and
  // lands in a toast so the user knows their save didn't persist.
  useEffect(
    () =>
      on('spm_storage_error', (detail) => {
        const verb = detail.action === 'save' ? 'save' : 'load';
        showToast(`Could not ${verb} "${detail.key}": ${detail.error}`, 'warning');
      }),
    [],
  );

  useEffect(() => on('spm_open_workspace_help', () => setShowWorkspaceHelp(true)), []);

  // Get total capacity
  const getTotalCapacity = useCallback(() => {
    const tableSpecs = getTableSpecs();
    return layoutState.layout.tables.reduce((sum, table) => {
      const spec = tableSpecs.find(s => s.id === table.specId);
      return sum + (spec?.capacity || 0);
    }, 0);
  }, [layoutState.layout.tables]);

  // Handle drag start from sidebar
  const handleDragStart = useCallback((type: 'table' | 'fixture' | 'arrangement', specId: string, isExterior?: boolean) => {
    setDragItem({ type, specId, isExterior });
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDragItem(null);
  }, []);

  const applyGridSnap = useCallback((position: Position): Position => {
    if (!snapToGrid) return position;
    if (!Number.isFinite(gridSize) || gridSize <= 0) return position;
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: Math.round(position.y / gridSize) * gridSize,
    };
  }, [snapToGrid, gridSize]);

  // Centralized placement rules so snap/grid never bypass spacing & collision logic.
  const resolvePlacement = useCallback((
    rawPosition: Position,
    item: { kind: 'table' | 'fixture' | 'arrangement'; specId: string; isExterior?: boolean; id?: string; showChairs?: boolean; chairType?: string; chairLayout?: any },
    opts?: { silent?: boolean }
  ) => {
    const venue = layoutState.currentVenue;
    const snapped = applyGridSnap({ ...rawPosition });
    const normalized = !!item.isExterior
      ? {
          x: Math.max(0, Math.min(snapped.x, (venue.canvasWidth || venue.width + 80) - 5)),
          y: Math.max(0, Math.min(snapped.y, (venue.canvasHeight || venue.height + 80) - 5)),
        }
      : {
          x: Math.max(0, Math.min(snapped.x, venue.width - 2)),
          y: Math.max(0, Math.min(snapped.y, venue.height - 2)),
        };

    // Always route through collision functions; they enforce admin spacing settings internally.
    if (item.kind === 'table') {
      const collision = checkTableCollision(
        {
          x: normalized.x,
          y: normalized.y,
          specId: item.specId,
          showChairs: item.showChairs ?? true,
          chairType: item.chairType ?? 'white-plastic',
          chairLayout: item.chairLayout ?? 'all-sides',
        },
        layoutState.layout.tables,
        layoutState.layout.fixtures,
        venue,
        item.id
      );
      if (collision.collides) {
        if (!opts?.silent) {
          const message =
            collision.wallError ||
            collision.details ||
            `Cannot place table here. Tables require ${getSpacingSettings().minTableSpacing}ft spacing.`;
          showToast(message, 'warning');
        }
        return { ok: false as const, position: normalized };
      }
      return { ok: true as const, position: normalized };
    }

    // Exterior and lodging/utilities fixtures are exempt by collision utility rules.
    const collision = checkFixtureCollision(
      { x: normalized.x, y: normalized.y, specId: item.specId, isExterior: !!item.isExterior },
      layoutState.layout.tables,
      layoutState.layout.fixtures,
      venue,
      item.id
    );

    if (collision.collides) {
      if (!opts?.silent) {
        const message =
          collision.wallError ||
          collision.details ||
          'Cannot place item here - it would overlap with another item or violate spacing rules.';
        showToast(message, 'warning');
      }
      return { ok: false as const, position: normalized };
    }

    return { ok: true as const, position: normalized };
  }, [layoutState, applyGridSnap]);

  // Handle drop on canvas
  const handleDrop = useCallback((position: Position, isExterior?: boolean) => {
    if (!ensureCanEditLayout()) return;
    if (!dragItem) return;

    // Handle Arrangement Drops (Apply design to existing items)
    if (dragItem.type === 'arrangement') {
      const x = position.x;
      const y = position.y;

      const targetTable = layoutState.layout.tables.find(t => {
        const spec = getTableSpecs().find(s => s.id === t.specId);
        if (!spec) return false;
        return x >= t.x && x <= t.x + spec.width && y >= t.y && y <= t.y + spec.height;
      });

      const targetFixture = layoutState.layout.fixtures.find(f => {
        const spec = getFixtureTypes().find(s => s.id === f.specId);
        if (!spec) return false;
        return x >= f.x && x <= f.x + spec.width && y >= f.y && y <= f.y + spec.height;
      });

      if (targetTable) {
        layoutState.updateTable(targetTable.id, { appliedArrangementId: dragItem.specId });
        showToast(`Applied design to ${targetTable.label}`, 'success');
        setDragItem(null);
        return;
      }

      if (targetFixture) {
        layoutState.updateFixture(targetFixture.id, { appliedArrangementId: dragItem.specId });
        showToast(`Applied design to ${targetFixture.label}`, 'success');
        setDragItem(null);
        return;
      }

      showToast('To apply a design, drop it onto a table or fixture.', 'info');
      setDragItem(null);
      return;
    }

    const placement = resolvePlacement(position, {
      kind: dragItem.type,
      specId: dragItem.specId,
      isExterior: !!(dragItem.isExterior || isExterior),
      showChairs: true,
      chairType: 'white-plastic',
      chairLayout: 'all-sides',
    });
    if (!placement.ok) return;
	
    pushUndoSnapshot();
    if (dragItem.type === 'table') {
      layoutState.addTable(dragItem.specId, placement.position);
    } else {
      layoutState.addFixture(dragItem.specId, placement.position, dragItem.isExterior);
    }
    
    setDragItem(null);
    setShowProperties(true);
  }, [dragItem, layoutState, resolvePlacement, showToast, ensureCanEditLayout]);

  // Handle click to place (mobile friendly)
  const handleClickToPlace = useCallback((position: Position, isExterior?: boolean) => {
    if (!ensureCanEditLayout()) return;
    if (!dragItem) return;

    // Handle Arrangement Clicks (Apply design to existing items)
    if (dragItem.type === 'arrangement') {
      const x = position.x;
      const y = position.y;

      const targetTable = layoutState.layout.tables.find(t => {
        const spec = getTableSpecs().find(s => s.id === t.specId);
        if (!spec) return false;
        return x >= t.x && x <= t.x + spec.width && y >= t.y && y <= t.y + spec.height;
      });

      const targetFixture = layoutState.layout.fixtures.find(f => {
        const spec = getFixtureTypes().find(s => s.id === f.specId);
        if (!spec) return false;
        return x >= f.x && x <= f.x + spec.width && y >= f.y && y <= f.y + spec.height;
      });

      if (targetTable) {
        layoutState.updateTable(targetTable.id, { appliedArrangementId: dragItem.specId });
        showToast(`Applied design to ${targetTable.label}`, 'success');
        setDragItem(null);
        return;
      }

      if (targetFixture) {
        layoutState.updateFixture(targetFixture.id, { appliedArrangementId: dragItem.specId });
        showToast(`Applied design to ${targetFixture.label}`, 'success');
        setDragItem(null);
        return;
      }

      showToast('To apply a design, tap on a table or fixture.', 'info');
      setDragItem(null);
      setMobileMenuOpen(false);
      return;
    }

    const placement = resolvePlacement(position, {
      kind: dragItem.type,
      specId: dragItem.specId,
      isExterior: !!(dragItem.isExterior || isExterior),
      showChairs: true,
      chairType: 'white-plastic',
      chairLayout: 'all-sides',
    });
    if (!placement.ok) return;
    
	pushUndoSnapshot();
    if (dragItem.type === 'table') {
      layoutState.addTable(dragItem.specId, placement.position);
    } else {
      layoutState.addFixture(dragItem.specId, placement.position, dragItem.isExterior);
    }
    
    setDragItem(null);
    setShowProperties(true);
    setMobileMenuOpen(false);
  }, [dragItem, layoutState, resolvePlacement, showToast, ensureCanEditLayout]);

  // Handle item selection (single click - do NOT open properties)
  const handleSelectItem = useCallback((id: string | null) => {
    layoutState.setSelectedId(id);
    // Do NOT automatically open properties on single click of existing items
    // Properties only opens when:
    // 1. Placing a new item (handled in handleDrop/handleClickToPlace)
    // 2. Double-clicking an item (handled in handleDoubleClickItem)
    // 3. Pressing the arrow button in the collapsed properties panel
  }, [layoutState]);

  // Handle double-click on existing item to open properties
  const handleDoubleClickItem = useCallback((id: string) => {
    layoutState.setSelectedId(id);
    setShowProperties(true);
  }, [layoutState]);

  // Handle item move
  const handleMoveItem = useCallback((id: string, position: Position, isExterior?: boolean) => {
    if (!ensureCanEditLayout()) return;

    const table = layoutState.layout.tables.find(t => t.id === id);
    if (table) {
      const placement = resolvePlacement(position, {
        kind: 'table',
        id,
        specId: table.specId,
        isExterior: false,
        showChairs: table.showChairs !== false,
        chairType: table.chairType,
        chairLayout: table.chairLayout,
      }, {
        silent: true,
      });
      if (!placement.ok) return;
	  
	  pushUndoSnapshot();
      layoutState.updateTable(id, { x: placement.position.x, y: placement.position.y });
      return;
    }
    
    const fixture = layoutState.layout.fixtures.find(f => f.id === id);
    if (fixture) {
      const fixtureSpec = getFixtureTypes().find(s => s.id === fixture.specId);
      const permanentlyBlocked = !!fixtureSpec?.isPermanent;
      const blockedForRole = fixtureSpec ? !canMoveFixture(user, fixtureSpec) : false;

      if (blockedForRole || permanentlyBlocked) {
        showToast(
          permanentlyBlocked
            ? 'This fixture is permanent and cannot be moved.'
            : 'This fixture is locked for your role and cannot be moved.',
          'warning',
        );
        return;
      }

      const placement = resolvePlacement(position, {
        kind: 'fixture',
        id,
        specId: fixture.specId,
        isExterior: !!(fixture.isExterior || isExterior),
      }, {
        silent: true,
      });
      if (!placement.ok) return;
	  
	  pushUndoSnapshot();
      layoutState.updateFixture(id, { x: placement.position.x, y: placement.position.y });
    }
  }, [layoutState, resolvePlacement, showToast, user, ensureCanEditLayout]);

  // Safe table update path (used by Properties panel too) so spacing/collision stays authoritative
  const handleUpdateTableSafe = useCallback((id: string, updates: Partial<any>) => {
    if (!ensureCanEditLayout()) return;
    
    const existing = layoutState.layout.tables.find(t => t.id === id);
    if (!existing) return;

    const hasPositionUpdate = Object.prototype.hasOwnProperty.call(updates, 'x') || Object.prototype.hasOwnProperty.call(updates, 'y');
    if (!hasPositionUpdate) {
      layoutState.updateTable(id, updates);
      return;
    }

    const targetPosition: Position = {
      x: typeof updates.x === 'number' ? updates.x : existing.x,
      y: typeof updates.y === 'number' ? updates.y : existing.y,
    };

    const placement = resolvePlacement(targetPosition, {
      kind: 'table',
      id,
      specId: existing.specId,
      isExterior: false,
      showChairs: (typeof updates.showChairs === 'boolean' ? updates.showChairs : existing.showChairs) !== false,
      chairType: (updates.chairType as string | undefined) ?? existing.chairType,
      chairLayout: (updates.chairLayout as any) ?? existing.chairLayout,
    });

    if (!placement.ok) return;
	
	pushUndoSnapshot();
    layoutState.updateTable(id, {
      ...updates,
      x: placement.position.x,
      y: placement.position.y,
    });
  }, [layoutState, resolvePlacement, ensureCanEditLayout]);

  // Safe fixture update path (used by Properties panel too) so spacing/collision stays authoritative
  const handleUpdateFixtureSafe = useCallback((id: string, updates: Partial<any>) => {
    if (!ensureCanEditLayout()) return;

    const existing = layoutState.layout.fixtures.find(f => f.id === id);
    if (!existing) return;

    const fixtureSpec = getFixtureTypes().find(s => s.id === existing.specId);
    const permanentlyBlocked = !!fixtureSpec?.isPermanent;
    const blockedForRole = fixtureSpec ? !canMoveFixture(user, fixtureSpec) : false;

    if (blockedForRole || permanentlyBlocked) {
      showToast(
        permanentlyBlocked
          ? 'This fixture is permanent and cannot be moved.'
          : 'This fixture is locked for your role and cannot be moved.',
        'warning',
      );
      return;
    }
    const hasPositionUpdate = Object.prototype.hasOwnProperty.call(updates, 'x') || Object.prototype.hasOwnProperty.call(updates, 'y');
    if (!hasPositionUpdate) {
      layoutState.updateFixture(id, updates);
      return;
    }

    const targetPosition: Position = {
      x: typeof updates.x === 'number' ? updates.x : existing.x,
      y: typeof updates.y === 'number' ? updates.y : existing.y,
    };

    const placement = resolvePlacement(targetPosition, {
      kind: 'fixture',
      id,
      specId: existing.specId,
      isExterior: !!((updates as any).isExterior ?? existing.isExterior),
    });

    if (!placement.ok) return;
	
	pushUndoSnapshot();
    layoutState.updateFixture(id, {
      ...updates,
      x: placement.position.x,
      y: placement.position.y,
    });
  }, [layoutState, resolvePlacement, showToast, user, ensureCanEditLayout]);

  // Handle save layout
  const handleClearLayout = useCallback(() => {
    if (!ensureCanEditLayout()) return;
    layoutState.clearLayout();
  }, [layoutState, canEditCurrentLayout]);

  // Handle save layout

  const handleSaveLayout = useCallback((name: string) => {

    layoutState.saveLayout(name);

    refreshSavedLayouts();

  }, [layoutState, refreshSavedLayouts]);

  // Handle load saved layout
  const handleLoadSavedLayout = useCallback((layoutId: string) => {
    layoutState.loadLayout(layoutId);
    handleResetView();
  }, [layoutState, handleResetView]);

  // Handle delete saved layout
  const handleDeleteSavedLayout = useCallback((layoutId: string) => {
    const updated = savedLayouts.filter(l => l.id !== layoutId);
    setSavedLayouts(updated);
    setSavedLayoutsState(updated);
  }, [savedLayouts]);

  // Handle load template
  const handleLoadTemplate = useCallback((template: LayoutTemplate) => {
    layoutState.loadTemplate(template);
    setShowTemplates(false);
    handleResetView();
  }, [layoutState, handleResetView]);

  // Handle load template for editing (from admin panel)
  const handleLoadTemplateForEdit = useCallback((template: LayoutTemplate) => {
    // Change to the template's venue first
    if (template.venueId !== layoutState.currentVenue.id) {
      layoutState.changeVenue(template.venueId);
    }
    // Load the template
    layoutState.loadTemplate(template);
    handleResetView();
  }, [layoutState, handleResetView]);

  const openAdminPanel = useCallback(() => {
    if (!canOpenAdminPanel) {
      const message = 'You do not have permission to access the admin panel.';
      showToast(message, 'warning');
      announce(message);
      return;
    }

    announce('Opening admin panel');
    setShowAdmin(true);
  }, [canOpenAdminPanel]);

  const openOperationsPanel = useCallback(() => {
    if (!canOpenOperationsPanel) {
      const message = 'You do not have permission to access staff operations.';
      showToast(message, 'warning');
      announce(message);
      return;
    }

    announce('Opening staff operations panel');
    setShowOperations(true);
  }, [canOpenOperationsPanel]);

  const openGuestPanel = useCallback(() => {
    if (!canOpenGuestPanel) {
      const message = 'You do not have permission to manage guests.';
      showToast(message, 'warning');
      announce(message);
      return;
    }

    announce('Opening guest management');
    setShowGuests(true);
  }, [canOpenGuestPanel]);

  const openPrintView = useCallback(() => {
    if (!canPrintCurrentLayout) {
      const message = 'You do not have permission to print/export this layout.';
      showToast(message, 'warning');
      announce(message);
      return;
    }

    announce('Opening print preview');
    setShowPrint(true);
  }, [canPrintCurrentLayout]);

  // Handle view image

  const handleViewImage = useCallback((url: string, title: string) => {
    setImagePreview({ url, title });

  }, []);

  // Handle pan change
  const handlePanChange = useCallback((offset: { x: number; y: number }) => {
    setPanOffset(offset);
  }, []);

  // Floating view controls drag handlers
  const handleViewControlsMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    setDraggingViewControls(true);
    setViewControlsDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!draggingViewControls || !canvasContainerRef.current) return;
      const containerRect = canvasContainerRef.current.getBoundingClientRect();
      const boxWidth = 210;
      const boxHeight = 120;
      const nextX = Math.min(
        Math.max(8, e.clientX - containerRect.left - viewControlsDragOffset.x),
        Math.max(8, containerRect.width - boxWidth - 8)
      );
      const nextY = Math.min(
        Math.max(8, e.clientY - containerRect.top - viewControlsDragOffset.y),
        Math.max(8, containerRect.height - boxHeight - 8)
      );
      setFloatingViewControlsPos({ x: nextX, y: nextY });
    };

    const handleUp = () => setDraggingViewControls(false);

    if (draggingViewControls) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [draggingViewControls, viewControlsDragOffset]);

  const resetFloatingViewControlsPosition = useCallback(() => {
    setFloatingViewControlsPos({ x: null, y: null });
  }, []);


  // Handle venue change
  const handleVenueChange = useCallback((venueId: string) => {

    const venueName =
      layoutState.venues.find((v) => v.id === venueId)?.name || 'venue';
    layoutState.changeVenue(venueId);
    announce(`Switched to ${venueName}`);
    // Reset zoom and center venue after a short delay to allow state to update
    setTimeout(() => {
      fitAndCenterVenue();
    }, 100);
  }, [layoutState, fitAndCenterVenue]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          if (layoutState.selectedId) {
            e.preventDefault();
            layoutState.removeItem(layoutState.selectedId);
          }
          break;
        case 'Escape':
          layoutState.setSelectedId(null);
          setShowProperties(false);
          setDragItem(null);
          break;
        case 'd':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (layoutState.selectedId) {
              layoutState.duplicateItem(layoutState.selectedId);
            }
          }
          break;
        case 'p':
          if (!e.ctrlKey && !e.metaKey) {
            setShowProperties(prev => !prev);
          }
          break;
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleResetToCanvas();
          }
          break;
        case '1':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleResetToVenue();
          }
          break;
        case '+':
        case '=':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoom(prev => Math.min(3, prev + 0.1));
          }
          break;
        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoom(prev => Math.max(0.1, prev - 0.1));
          }
          break;
        case '?':
          e.preventDefault();
          setShowWorkspaceHelp(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [layoutState, handleResetView, handleResetToVenue, handleResetToCanvas]);

  useEffect(() => {
    if (!canOpenAdminPanel && showAdmin) setShowAdmin(false);
    if (!canOpenOperationsPanel && showOperations) setShowOperations(false);
    if (!canOpenGuestPanel && showGuests) setShowGuests(false);
    if (!canPrintCurrentLayout && showPrint) setShowPrint(false);
  }, [
    canOpenAdminPanel,
    canOpenOperationsPanel,
    canOpenGuestPanel,
    canPrintCurrentLayout,
    showAdmin,
    showOperations,
    showGuests,
    showPrint,
  ]);

  // Refresh data when admin panel closes

  useEffect(() => {

    if (!showAdmin) {

      layoutState.refreshVenues();

      // Reload branding config when admin panel closes

      setBrandingConfig(getConfig());

    }

  }, [showAdmin, layoutState]);
  
  // Apply branding styles to document
  useEffect(() => {
    // Apply CSS custom properties for branding
    const root = document.documentElement;
    root.style.setProperty('--primary-color', brandingConfig.primaryColor);
    root.style.setProperty('--primary-dark', brandingConfig.primaryDark);
    root.style.setProperty('--primary-light', brandingConfig.primaryLight);
    root.style.setProperty('--accent-color', brandingConfig.accentColor);
    root.style.setProperty('--background-color', brandingConfig.backgroundColor);
    root.style.setProperty('--text-color', brandingConfig.textColor);
    root.style.setProperty('--font-family', brandingConfig.fontFamily);
    root.style.setProperty('--heading-font-family', brandingConfig.headingFontFamily);
    root.style.setProperty('--header-text-color', brandingConfig.headerTextColor);
    root.style.setProperty('--body-text-color', brandingConfig.bodyTextColor);
    root.style.setProperty('--accent-text-color', brandingConfig.accentTextColor);
  }, [brandingConfig]);

  return (
    <UndoRedoProvider onRestore={handleRestoreSnapshot}>
      <div 
        className="h-screen flex flex-col overflow-hidden"
        style={{
          fontFamily: brandingConfig.fontFamily,
          backgroundColor: brandingConfig.backgroundColor,
          color: brandingConfig.bodyTextColor,
        }}
      >
      {/* Header */}
      <Header
        currentVenue={layoutState.currentVenue}
        venues={selectableVenues}
        selectedVenueCategories={selectedVenueCategories}
        onChangeVenueCategories={setSelectedVenueCategories}
        onChangeVenue={handleVenueChange}
        onSaveLayout={handleSaveLayout}
        onSaveMasterLayout={isAdmin ? layoutState.saveMasterLayout : undefined}
        onClearMasterLayout={isAdmin ? layoutState.clearMasterLayout : undefined}
        onPrint={openPrintView}
        onShowTemplates={() => setShowTemplates(true)}
        onShowGuests={openGuestPanel}
        onShowAdmin={canOpenAdminPanel ? openAdminPanel : undefined}
        onLogout={logout}
        userName={user.name}
        isAdmin={isAdmin}
	isStaff={isStaff}
	onOpenOperations={canOpenOperationsPanel ? openOperationsPanel : undefined}
        savedLayouts={savedLayouts}
        onLoadSavedLayout={handleLoadSavedLayout}
        onDeleteSavedLayout={handleDeleteSavedLayout}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onShowWorkspaceHelp={() => setShowWorkspaceHelp(true)}
	currentUser={user}
      />

      <AppStatusBar items={statusItems} />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          width={sidebarWidth}
          collapsed={sidebarCollapsed}
          onWidthChange={setSidebarWidth}
          onCollapsedChange={setSidebarCollapsed}
          zoom={zoom}
          onZoomChange={setZoom}
          showGrid={showGrid}
          onShowGridChange={() => {}}
          gridSize={gridSize}
          onGridSizeChange={() => {}}
          gridContrast={gridContrast}
          onGridContrastChange={() => {}}
          snapToGrid={snapToGrid}
          onSnapToGridChange={() => {}}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          currentDragItem={dragItem}
          onClearLayout={handleClearLayout}
          isAdmin={isAdmin}
          onViewImage={handleViewImage}
          layoutCategories={layoutCategories}
          currentVenueCategory={layoutState.currentVenue.category}
          venueWidth={layoutState.currentVenue.width}
          venueHeight={layoutState.currentVenue.height}
          canvasWidth={layoutState.currentVenue.canvasWidth}
          canvasHeight={layoutState.currentVenue.canvasHeight}
          onResetView={handleResetView}
          onResetToVenue={handleResetToVenue}
          onResetToCanvas={handleResetToCanvas}
          placedTables={layoutState.layout.tables}
          placedFixtures={layoutState.layout.fixtures}
	  currentUser={user}
        />

        {/* Canvas */}
        <div ref={canvasContainerRef} className="flex-1 relative overflow-hidden">
          {/* Status bar */}
          {dragItem && (
            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10 bg-green-600 text-white px-4 py-2 rounded-full shadow-lg text-sm">
              {window.innerWidth < 768 
                ? 'Tap on the canvas to place the item'
                : 'Drop the item on the canvas or click to place'}
            </div>
          )}
          
          <FloorPlanCanvas
            venue={layoutState.currentVenue}
            tables={layoutState.layout.tables}
            fixtures={layoutState.layout.fixtures}
            decor={layoutState.layout.decor}
            guests={layoutState.guests}
            selectedId={layoutState.selectedId}
            zoom={zoom}
            showGrid={showGrid}
            gridSize={gridSize}
            gridContrast={gridContrast}
            onSelect={handleSelectItem}
            onDoubleClick={handleDoubleClickItem}
            onMove={handleMoveItem}
            onDrop={handleDrop}
            onClickToPlace={handleClickToPlace}
            isDragging={!!dragItem}
            isDraggingExterior={dragItem?.isExterior || false}
            isAdmin={isAdmin}
            onViewImage={handleViewImage}
            panOffset={panOffset}
            onPanChange={handlePanChange}
            onZoomChange={setZoom}
          />

          {/* Capacity indicator */}
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-lg text-sm">
            <span className="font-medium">Capacity:</span>{' '}
            <span className={getTotalCapacity() > layoutState.currentVenue.capacity ? 'text-red-600 font-bold' : 'text-green-600'}>
              {getTotalCapacity()} / {layoutState.currentVenue.capacity}
            </span>
          </div>

          {/* Master Basic User Messages Launcher */}
          {isMasterBasicUser && (
            <div className="absolute bottom-4 left-44 z-20 flex gap-2">
              <button
                type="button"
                onClick={() => setShowMessages(true)}
                className="bg-[#4A1942] hover:bg-[#3b1435] text-white rounded-xl shadow-lg px-3 py-2 text-sm font-medium"
                title="Open messages with Admin"
              >
                💬 Messages
              </button>
              <button
                type="button"
                onClick={() => setShowSubmission(true)}
                className="bg-[#4A1942] hover:bg-[#3b1435] text-white rounded-xl shadow-lg px-3 py-2 text-sm font-medium"
                title="Submission workflow"
              >
                📤 Submit
              </button>
              <button
                type="button"
                onClick={() => setShowEventQuestions(true)}
                className="bg-[#4A1942] hover:bg-[#3b1435] text-white rounded-xl shadow-lg px-3 py-2 text-sm font-medium"
                title="Event questions"
              >
                📝 Questions
              </button>
            </div>
          )}

          {/* Floating Zoom Controls */}
          {showFloatingViewControls ? (
            <div
              className="absolute bg-white/95 backdrop-blur rounded-xl shadow-lg p-3 flex flex-col gap-2 border border-gray-200 z-20 select-none"
              style={{
                right: floatingViewControlsPos.x === null ? 16 : 'auto',
                bottom: floatingViewControlsPos.y === null ? 16 : 'auto',
                left: floatingViewControlsPos.x !== null ? floatingViewControlsPos.x : 'auto',
                top: floatingViewControlsPos.y !== null ? floatingViewControlsPos.y : 'auto',
                cursor: draggingViewControls ? 'grabbing' : 'default',
                width: 210,
              }}
            >
            <div
              className="flex items-center justify-between gap-2 pb-1 border-b border-gray-200 cursor-grab active:cursor-grabbing"
              onMouseDown={handleViewControlsMouseDown}
              title="Drag to move view controls"
            >
              <span className="text-xs font-semibold text-gray-700">🔍 View Controls</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={resetFloatingViewControlsPosition}
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-xs"
                  title="Reset position"
                >
                  ⌂
                </button>
                <button
                  onClick={() => setShowFloatingViewControls(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-xs"
                  title="Hide view controls"
                >
                  —
                </button>
              </div>
            </div>
            {/* Zoom buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 font-bold text-lg transition-colors"
                title="Zoom Out (Ctrl+-)"
              >
                −
              </button>
              <span className="text-sm font-semibold w-14 text-center bg-gray-50 py-1 rounded">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 font-bold text-lg transition-colors"
                title="Zoom In (Ctrl++)"
              >
                +
              </button>
            </div>
            
            {/* Reset buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetToVenue}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs text-white rounded-lg font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: brandingConfig.primaryColor }}
                title="Fit Venue to Screen (Ctrl+1)"
              >
                <span>🏛️</span>
                <span>Venue</span>
              </button>
              <button
                onClick={handleResetToCanvas}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded-lg font-medium transition-colors"
                title="Fit Canvas to Screen (Ctrl+0)"
              >
                <span>📐</span>
                <span>Canvas</span>
              </button>
            </div>
          </div>
          ) : (
            <button
              onClick={() => setShowFloatingViewControls(true)}
              className="absolute bottom-4 right-4 z-20 bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-50"
              title="Show view controls"
            >
              🔍 View
            </button>
          )}

          {/* Grid controls removed by request */}

        </div>

        {/* Properties Panel */}
        <PropertiesPanel
          selectedId={layoutState.selectedId}
          tables={layoutState.layout.tables}
          fixtures={layoutState.layout.fixtures}
          guests={layoutState.guests}
          onUpdateTable={handleUpdateTableSafe}
          onUpdateFixture={handleUpdateFixtureSafe}
          onRemoveItem={layoutState.removeItem}
          onDuplicateItem={layoutState.duplicateItem}
          onClose={() => setShowProperties(false)}
          onAddGuest={(name, tableId) => layoutState.addGuest(name, undefined, tableId)}
          onRemoveGuestFromTable={(guestId) => layoutState.assignGuestToTable(guestId, null)}
          onViewImage={handleViewImage}
          visible={showProperties}
          onToggleVisibility={() => setShowProperties(prev => !prev)}
          arrangements={layoutState.getDecorArrangements()}
        />
      </div>

      {/* ─── Lazy-loaded modals – one shared Suspense boundary ─────────────── */}
      {/* All components below are React.lazy(). The fallback is invisible so   */}
      {/* first-paint of the main canvas is never blocked by modal JS chunks.  */}
      <Suspense fallback={null}>

      {/* Guest Panel Modal */}
      {showGuests && canOpenGuestPanel && (
        <GuestPanel
          guests={layoutState.guests}
          tables={layoutState.layout.tables}
          fixtures={layoutState.layout.fixtures}
          venue={layoutState.currentVenue}
          eventName={currentEventName}
          venueName={layoutState.currentVenue.name}
          onAddGuest={layoutState.addGuest}
          onUpdateGuest={layoutState.updateGuest}
          onRemoveGuest={layoutState.removeGuest}
          onAssignToTable={layoutState.assignGuestToTable}
          onAssignToRoom={layoutState.assignGuestToRoom}
          onImportCSV={layoutState.importGuestsFromCSV}
          onExportCSV={layoutState.exportGuestsToCSV}
          onClose={() => setShowGuests(false)}
        />
      )}

      {/* Decor Designer Modal */}
      {showDecorDesigner && (
        <DecorDesigner
          onClose={() => {
            setShowDecorDesigner(false);
            setEditingArrangementId(undefined);
          }}
          onSave={(arrangement) => {
            const currentArrangements = layoutState.getDecorArrangements();
            const exists = currentArrangements.find(a => a.id === arrangement.id);
            if (exists) {
              layoutState.setDecorArrangements(currentArrangements.map(a => a.id === arrangement.id ? arrangement : a));
            } else {
              layoutState.setDecorArrangements([...currentArrangements, arrangement]);
            }
            setShowDecorDesigner(false);
            setEditingArrangementId(undefined);
            showToast('Design saved successfully!', 'success');
          }}
          initialArrangement={editingArrangementId ? layoutState.getDecorArrangements().find(a => a.id === editingArrangementId) : null}
        />
      )}

      {/* Direct Messages Modal (Master Basic User) */}
      {showMessages && isMasterBasicUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
          <div className="w-full max-w-3xl">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMessages(false)}
                className="px-3 py-1.5 rounded-lg bg-white text-gray-700 hover:bg-gray-100 shadow"
              >
                Close
              </button>
            </div>
            <DirectMessagePanel
              title="Messages with Admin"
              threadId={masterThreadId}
              currentUserId={user.id}
              currentUserName={user.name}
              currentUserRole="master"
            />
          </div>
        </div>
      )}

      {/* Submission Workflow Modal (Master Basic User) */}
      {showSubmission && isMasterBasicUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
          <div className="w-full max-w-2xl">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSubmission(false)}
                className="px-3 py-1.5 rounded-lg bg-white text-gray-700 hover:bg-gray-100 shadow"
              >
                Close
              </button>
            </div>
            <SubmissionStatusPanel
              eventName={currentEventName}
              selectedVenueIds={[layoutState.currentVenue.id]}
              answers={currentEventAnswers}
              submission={currentSubmission}
              onSubmit={() => {
                submissionWorkflow.submit({
                  eventName: currentEventName,
                  masterUserId: user.id,
                  masterUserName: user.name,
                  selectedVenueIds: [layoutState.currentVenue.id],
                  answers: currentEventAnswers,
                });
              }}
            />
          </div>
        </div>
      )}

      {/* Event Questions Modal (Master Basic User) */}
      {showEventQuestions && isMasterBasicUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
          <div className="w-full max-w-4xl max-h-[92vh] overflow-auto">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowEventQuestions(false)}
                className="px-3 py-1.5 rounded-lg bg-white text-gray-700 hover:bg-gray-100 shadow"
              >
                Close
              </button>
            </div>
            <EventQuestionsWizard
              questions={eventQuestions}
              initialAnswers={currentEventAnswers}
              userId={user.id}
              eventId={currentEventName}
              onSaveAnswers={saveEventAnswers}
              onVenueFilterChange={(categories) => setSelectedVenueCategories(categories)}
            />
          </div>
        </div>
      )}

      {/* Staff Operations Panel Modal */}
      {showOperations && canOpenOperationsPanel && (
          <StaffOperationsPanel
          onClose={() => setShowOperations(false)}
          currentUser={user}
          isAdmin={isAdmin}
          venueId={layoutState.currentVenue.id}
          eventName={currentEventName}
          users={allUsers}
          venues={layoutState.venues}
        />
	)}

      {/* Admin Panel Modal */}
      {showAdmin && canOpenAdminPanel && (
        <AdminPanel 
          onClose={() => {
            setShowAdmin(false);
            // Refresh venues to pick up any changes
            layoutState.refreshVenues();
          }} 
          currentLayout={{
            tables: layoutState.layout.tables,
            fixtures: layoutState.layout.fixtures,
            venueId: layoutState.currentVenue.id,
            category: layoutState.currentVenue.category
          }}
          onLoadTemplateForEdit={handleLoadTemplateForEdit}
        />
      )}

      {/* Template Selector Modal */}
      {showTemplates && (
        <TemplateSelector
          templates={getTemplates()}
          layoutCategories={layoutCategories}
          onSelect={handleLoadTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {/* Print View Modal */}
      {showPrint && canPrintCurrentLayout && (
        <PrintView
          venue={layoutState.currentVenue}
          tables={layoutState.layout.tables}
          fixtures={layoutState.layout.fixtures}
          guests={layoutState.guests}
          layoutName={layoutState.layout.name}
          onClose={() => setShowPrint(false)}
        />
      )}

      {/* Image Preview Modal */}
      {imagePreview && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4"
          style={{ zIndex: 10001 }}
          onClick={() => setImagePreview(null)}
        >
          <div className="bg-white rounded-xl max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-lg">{imagePreview.title}</h3>
              <button
                onClick={() => setImagePreview(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <SafeImage
                src={imagePreview.url}
                alt={imagePreview.title || 'Preview image'}
                className="max-w-full max-h-[70vh] object-contain mx-auto rounded-lg"
                fallback={
                  <div className="w-[320px] h-[220px] max-w-full flex items-center justify-center bg-gray-100 text-gray-500 border border-gray-200 rounded mx-auto">
                    Preview unavailable
                  </div>
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Welcome Modal for first-time users */}
      {showWelcome && !isAdmin && (
        <WelcomeModal
          onClose={() => {
            setShowWelcome(false);
          }}
          isAdmin={isAdmin}
          isGuest={isGuest}    
        />
      )}
	  {/* Undo/Redo Toolbar */}
      <UndoRedoToolbar variant="floating" />
	  
	  {/* Vendor Panel */}
	  {showVendors && (
		<VendorPanel onClose={() => setShowVendors(false)} />
      )}
	  
	  {/* Timeline Panel */}
	  {showTimeline && (
		<TimelinePanel onClose={() => setShowTimeline(false)} />
	  )}

      </Suspense>
      {/* ─────────────────────────────────────────────────────────────────────── */}

      {showWorkspaceHelp && (
        <ModalDialog
          title="Workspace Help & Shortcuts"
          description="Use these shortcuts to move faster through layout planning."
          onClose={() => setShowWorkspaceHelp(false)}
          className="max-w-2xl"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900">Navigation</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li><strong>Shift + Drag</strong> pan the canvas</li>
                <li><strong>Ctrl/Cmd + 0</strong> fit the full canvas</li>
                <li><strong>Ctrl/Cmd + 1</strong> fit the venue</li>
                <li><strong>?</strong> open this help panel</li>
              </ul>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900">Editing</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li><strong>Drag or click</strong> an item from the sidebar to place it</li>
                <li><strong>Double-click</strong> an item to open properties</li>
                <li><strong>Delete / Backspace</strong> remove the selected item</li>
                <li><strong>Ctrl/Cmd + D</strong> duplicate the selected item</li>
                <li><strong>P</strong> toggle the properties panel</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-[#4A1942]/10 bg-[#4A1942]/5 p-4 text-sm text-gray-700">
            <p className="font-semibold text-[#4A1942]">Workspace UX tips</p>
            <ul className="mt-2 space-y-1.5">
              <li>• Use <strong>Quick find</strong> in the sidebar to jump to any table, fixture, or saved design.</li>
              <li>• The <strong>Workspace Snapshot</strong> card keeps key layout counts visible while you work.</li>
              <li>• Use the Guest, Admin, Vendor, and Timeline tools from the header when you need event-wide context.</li>
            </ul>
          </div>
        </ModalDialog>
      )}

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  </UndoRedoProvider>
  );
}

function AppContent() {
  const { user, continueAsGuest } = useAuth();
  // TRACK HASH IN STATE TO TRIGGER RE-RENDERS
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Guest Portal route — GuestPortal is lazy, wrap in its own Suspense
  if (hash.startsWith('#/guest-portal')) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-slate-100 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="text-4xl animate-pulse">🌸</div>
              <p className="text-sm text-gray-500">Loading Guest Portal…</p>
            </div>
          </div>
        }
      >
        <GuestPortal
          guestToken={getGuestPortalTokenFromLocation(window.location)}
          onExitPortal={() => {
            window.location.hash = '';
          }}
        />
      </Suspense>
    );
  }

  // Login screen — pass continueAsGuest so the button works without
  // requiring AuthContext access directly inside LoginScreen (B-12 fix).
  if (!user) {
    return <LoginScreen onContinueAsGuest={continueAsGuest} />;
  }

  return <AuthenticatedApp />;
}

export default function App() {

  return (

    <AppErrorBoundary>

      <AuthProvider>

        <LiveRegion />

        <AppContent />

      </AuthProvider>

    </AppErrorBoundary>

  );

}