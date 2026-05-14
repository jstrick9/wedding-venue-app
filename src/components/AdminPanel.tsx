// src/components/AdminPanel.tsx - REFACTORED to eliminate monolith and use mapped components
import { useState, useEffect } from 'react';
import {
  Venue, TableSpec, FixtureType, Guideline, LayoutCategory,
  LayoutTemplate, User, EventQuestion, ChairSpec, Config, SpacingSettings
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getConfig, setConfig } from '../config';
import { AccessControlPanel } from './admin/AccessControlPanel';
import { AdminDecorSection } from './AdminDecorSection';
import { useDirectMessages } from '../hooks/useDirectMessages';
import { useLayoutState } from '../hooks/useLayoutState'; // For full state sync
import {
  getDecorItems, setDecorItems,
  getDecorCategories, setDecorCategories,
  getDecorArrangements, setDecorArrangements,
  getDecorPackages, setDecorPackages,
} from '../hooks/useLayoutState';

// Refactored Tab Components
import { VenueManagement } from './admin/VenueManagement';
import { TableManagement } from './admin/TableManagement';
import { ChairManagement } from './admin/ChairManagement';
import { FixtureManagement } from './admin/FixtureManagement';
import { SpacingManagement } from './admin/SpacingManagement';
import { TemplateManagement } from './admin/TemplateManagement';
import { GuidelineManagement } from './admin/GuidelineManagement';
import { EventQuestionsManagement } from './admin/EventQuestionsManagement';
import { UserManagement } from './admin/UserManagement';
import { BrandingManagement } from './admin/BrandingManagement';

import { DrawingTool } from './DrawingTool';
import { DirectMessagePanel } from './DirectMessagePanel'; // For integration in admin if needed

export interface AdminPanelProps {
  onClose: () => void;
  currentLayout?: any;
  onLoadTemplateForEdit?: (template: LayoutTemplate) => void;
  layoutState?: any; // For passing full layout state
}

export function AdminPanel({ onClose, currentLayout, onLoadTemplateForEdit, layoutState: externalLayoutState }: AdminPanelProps) {
  const { createUser, deleteUser, getAllUsers, user } = useAuth();
  const { directMessages, sendMessage, markAsRead, unreadCount } = useDirectMessages();
  const layoutHook = useLayoutState(); // For sync with main app state

  // Merge external and local for full layoutState prop
  const fullLayoutState = { ...layoutHook, ...externalLayoutState };

  // ==================== STATE ====================
  const [activeTab, setActiveTab] = useState('venues');
  const [config, setConfigState] = useState(() => getConfig());
  const [venues, setVenuesState] = useState<Venue[]>(() => layoutHook.venues || []);
  const [tableSpecs, setTableSpecsState] = useState<TableSpec[]>(() => []);
  const [fixtureTypes, setFixtureTypesState] = useState<FixtureType[]>(() => []);
  const [guidelines, setGuidelinesState] = useState<Guideline[]>(() => []);
  const [templates, setTemplatesState] = useState<LayoutTemplate[]>(() => []);
  const [users, setUsersState] = useState<User[]>(() => getAllUsers?.() || []);
  const [chairSpecs, setChairSpecsState] = useState<ChairSpec[]>(() => []);
  const [spacingSettings, setSpacingSettingsState] = useState<SpacingSettings>(() => ({
    minItemSpacing: 2, minWallSpacing: 2, minFixtureSpacing: 4, minTableSpacing: 3,
    enableCollisionDetection: true, showCollisionWarnings: true,
  }));
  const [eventQuestions, setEventQuestions] = useState<EventQuestion[]>([]);

  // Decor state (was missing - fixed)
  const [decorItems, setDecorItemsState] = useState(() => getDecorItems());
  const [decorCategories, setDecorCategoriesState] = useState(() => getDecorCategories());
  const [decorArrangements, setDecorArrangementsState] = useState(() => getDecorArrangements());
  const [decorPackages, setDecorPackagesState] = useState(() => getDecorPackages());

  // Expanded states for accordions
  const [expandedVenues, setExpandedVenues] = useState<Set<string>>(new Set());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [expandedChairs, setExpandedChairs] = useState<Set<string>>(new Set());
  const [expandedVenueFixtures, setExpandedVenueFixtures] = useState<Set<string>>(new Set());
  const [expandedGuidelines, setExpandedGuidelines] = useState<Set<string>>(new Set());
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [expandedBrandingSections, setExpandedBrandingSections] = useState<Set<string>>(new Set());

  const [customShapeVenueId, setCustomShapeVenueId] = useState<string | null>(null);
  const [showDrawingTool, setShowDrawingTool] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Sync with layoutHook changes
  useEffect(() => {
    if (layoutHook.venues) setVenuesState(layoutHook.venues);
  }, [layoutHook.venues]);

  // ==================== HANDLERS ====================
  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 2500);
  };

  const handleSaveVenues = (updated: Venue[]) => { 
    setVenuesState(updated); 
    // Sync to storage/hook
    if (typeof (layoutHook as any).setVenues === 'function') (layoutHook as any).setVenues(updated); 
    showSuccess('Venues saved!');
  };
  const handleSaveTables = (updated: TableSpec[]) => { setTableSpecsState(updated); showSuccess('Tables saved!'); };
  const handleSaveFixtures = (updated: FixtureType[]) => { setFixtureTypesState(updated); showSuccess('Fixtures saved!'); };
  const handleSaveGuidelines = (updated: Guideline[]) => { setGuidelinesState(updated); showSuccess('Guidelines saved!'); };
  const handleSaveTemplates = (updated: LayoutTemplate[]) => { setTemplatesState(updated); showSuccess('Templates saved!'); };
  const handleSaveUsers = (updated: User[]) => { setUsersState(updated); showSuccess('Users saved!'); };
  const handleSaveConfig = (updated: Config) => { 
    setConfigState(updated); 
    setConfig(updated); 
    showSuccess('Branding saved!'); 
  };
  const handleSaveChairs = (updated: ChairSpec[]) => { setChairSpecsState(updated); showSuccess('Chairs saved!'); };
  const handleSaveSpacing = (updated: SpacingSettings) => { setSpacingSettingsState(updated); showSuccess('Spacing saved!'); };
  const handleSaveDecor = (updatedItems: any[], updatedCategories?: any[], updatedArrangements?: any[], updatedPackages?: any[]) => {
    setDecorItemsState(updatedItems);
    setDecorItems(updatedItems);
    if (updatedCategories) setDecorCategoriesState(updatedCategories);
    if (updatedArrangements) setDecorArrangementsState(updatedArrangements);
    if (updatedPackages) setDecorPackagesState(updatedPackages);
    showSuccess('Decor settings saved!');
  };

  // Toggle handlers
  const toggleVenueExpanded = (id: string) => setExpandedVenues(prev => toggleSet(prev, id));
  const toggleTableExpanded = (id: string) => setExpandedTables(prev => toggleSet(prev, id));
  const toggleChairExpanded = (id: string) => setExpandedChairs(prev => toggleSet(prev, id));
  const toggleVenueFixtureExpanded = (id: string) => setExpandedVenueFixtures(prev => toggleSet(prev, id));
  const toggleGuidelineExpanded = (id: string) => setExpandedGuidelines(prev => toggleSet(prev, id));
  const toggleTemplateExpanded = (id: string) => setExpandedTemplates(prev => toggleSet(prev, id));
  const toggleUserExpanded = (id: string) => setExpandedUsers(prev => toggleSet(prev, id));
  const toggleBrandingSection = (key: string) => setExpandedBrandingSections(prev => toggleSet(prev, key));

  function toggleSet(set: Set<string>, id: string) {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  }

  const handlers = {
    handleSaveVenues,
    handleSaveTables,
    handleSaveFixtures,
    handleSaveGuidelines,
    handleSaveTemplates,
    handleSaveUsers,
    handleSaveConfig,
    handleSaveChairs,
    handleSaveSpacing,
    handleSaveDecor,
    toggleVenueExpanded,
    toggleTableExpanded,
    toggleChairExpanded,
    toggleVenueFixtureExpanded,
    toggleGuidelineExpanded,
    toggleTemplateExpanded,
    toggleUserExpanded,
    toggleBrandingSection,
    onShowCreateModal: () => setShowCreateUserModal(true),
    onOpenShapeBuilder: setCustomShapeVenueId,
    onShowDrawingTool: () => setShowDrawingTool(true),
    sendMessage,
    markAsRead,
    createUser,
    deleteUser,
    showSuccess,
  };

  // ==================== TABS MAPPING (replaces massive inline conditionals/switch) ====================
  const tabs = [
    { 
      id: 'venues', 
      label: '🏛️ Venues', 
      Component: VenueManagement,
      props: { 
        venues, config, onSaveVenues: handleSaveVenues, expandedVenues, 
        onToggleVenue: toggleVenueExpanded, customShapeVenueId, 
        onOpenShapeBuilder: setCustomShapeVenueId, layoutState: fullLayoutState 
      } 
    },
    { 
      id: 'tables', 
      label: '🪑 Tables', 
      Component: TableManagement,
      props: { tableSpecs, config, onSaveTables: handleSaveTables, expandedTables, onToggleTable: toggleTableExpanded, layoutState: fullLayoutState } 
    },
    { 
      id: 'chairs', 
      label: '💺 Chairs', 
      Component: ChairManagement,
      props: { chairSpecs, config, onSaveChairs: handleSaveChairs, expandedChairs, onToggleChair: toggleChairExpanded, layoutState: fullLayoutState } 
    },
    { 
      id: 'fixtures', 
      label: '📦 Fixtures', 
      Component: FixtureManagement,
      props: { fixtureTypes, config, onSaveFixtures: handleSaveFixtures, expandedFixtures: expandedVenueFixtures, onToggleFixture: toggleVenueFixtureExpanded, onShowDrawingTool: () => setShowDrawingTool(true), layoutState: fullLayoutState } 
    },
    { 
      id: 'decor', 
      label: '🎀 Decor', 
      Component: AdminDecorSection,
      props: { 
        config, decorItems, setDecorItems: setDecorItemsState, decorCategories, setDecorCategories: setDecorCategoriesState, 
        decorArrangements, setDecorArrangements: setDecorArrangementsState, decorPackages, setDecorPackages: setDecorPackagesState, 
        onShowSuccess: showSuccess, layoutState: fullLayoutState, handlers 
      } 
    },
    { 
      id: 'spacing', 
      label: '📐 Spacing', 
      Component: SpacingManagement,
      props: { spacingSettings, config, onSaveSpacing: handleSaveSpacing, layoutState: fullLayoutState } 
    },
    { 
      id: 'templates', 
      label: '📋 Templates', 
      Component: TemplateManagement,
      props: { templates, venues, config, onSaveTemplates: handleSaveTemplates, onLoadTemplate: onLoadTemplateForEdit || (() => {}), expandedTemplates, onToggleTemplate: toggleTemplateExpanded, layoutState: fullLayoutState } 
    },
    { 
      id: 'guidelines', 
      label: '💡 Guidelines', 
      Component: GuidelineManagement,
      props: { guidelines, config, onSaveGuidelines: handleSaveGuidelines, expandedGuidelines, onToggleGuideline: toggleGuidelineExpanded, layoutState: fullLayoutState } 
    },
    { 
      id: 'event-questions', 
      label: '❓ Questions', 
      Component: EventQuestionsManagement,
      props: { eventQuestions, config, onSaveQuestions: setEventQuestions, layoutState: fullLayoutState } 
    },
    { 
      id: 'users', 
      label: '👥 Users', 
      Component: UserManagement,
      props: { 
        users, config, onSaveUsers: handleSaveUsers, onShowCreateModal: () => setShowCreateUserModal(true), 
        expandedUsers, onToggleUser: toggleUserExpanded, directMessages, handlers, layoutState: fullLayoutState 
      } 
    },
    { 
      id: 'access-control', 
      label: '🔐 Access', 
      Component: AccessControlPanel,
      props: { onClose: () => setActiveTab('venues'), inline: true, layoutState: fullLayoutState, handlers } 
    },
    { 
      id: 'branding', 
      label: '🎨 Branding', 
      Component: BrandingManagement,
      props: { config, onSaveConfig: handleSaveConfig, expandedSections: expandedBrandingSections, onToggleSection: toggleBrandingSection, directMessages, layoutState: fullLayoutState, handlers } 
    },
    // Added messaging integration point for intelligence platform
    { 
      id: 'messages', 
      label: '💬 Messages', 
      Component: DirectMessagePanel,
      props: { directMessages, onSendMessage: sendMessage, currentUser: user, layoutState: fullLayoutState } 
    },
  ];

  const activeTabConfig = tabs.find(tab => tab.id === activeTab);
  const ActiveComponent = activeTabConfig?.Component;
  const activeProps = activeTabConfig?.props || {};

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#4A1942] text-white p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Admin Panel - Wedding Venue Intelligence</h2>
          <button onClick={onClose} className="text-2xl hover:opacity-80">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto bg-white">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.id 
                  ? 'border-[#4A1942] text-[#4A1942] bg-white' 
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area with mapped component */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {ActiveComponent ? (
            <ActiveComponent {...activeProps} />
          ) : (
            <div className="p-8 text-center text-gray-500">Select a tab to begin configuration.</div>
          )}
        </div>

        {/* Success Toast */}
        {successMessage && (
          <div className="absolute bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-2">
            ✅ {successMessage}
          </div>
        )}

        {/* Drawing Tool Modal */}
        {showDrawingTool && (
          <DrawingTool 
            onClose={() => setShowDrawingTool(false)} 
            onSave={(newFixture) => {
              // Handle save logic
              setShowDrawingTool(false);
              showSuccess('Custom fixture created!');
            }} 
          />
        )}
      </div>
    </div>
  );
}
