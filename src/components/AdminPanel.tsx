// src/components/AdminPanel.tsx
import { useState } from 'react';
import {
  Venue, TableSpec, FixtureType, Guideline, LayoutCategory,
  LayoutTemplate, User, EventQuestion, ChairSpec, Config, SpacingSettings
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getConfig, setConfig } from '../config';
import { AccessControlPanel } from './admin/AccessControlPanel';
import { AdminDecorSection } from './AdminDecorSection';

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

export interface AdminPanelProps {
  onClose: () => void;
  currentLayout?: any;
  onLoadTemplateForEdit?: (template: LayoutTemplate) => void;
}

export function AdminPanel({ onClose, currentLayout, onLoadTemplateForEdit }: AdminPanelProps) {
  const { createUser, deleteUser, getAllUsers, user } = useAuth();

  // ==================== STATE ====================
  const [activeTab, setActiveTab] = useState('venues');
  const [config, setConfigState] = useState(() => getConfig());
  const [venues, setVenuesState] = useState<Venue[]>(() => []);
  const [tableSpecs, setTableSpecsState] = useState<TableSpec[]>(() => []);
  const [fixtureTypes, setFixtureTypesState] = useState<FixtureType[]>(() => []);
  const [guidelines, setGuidelinesState] = useState<Guideline[]>(() => []);
  const [templates, setTemplatesState] = useState<LayoutTemplate[]>(() => []);
  const [users, setUsersState] = useState<User[]>(() => []);
  const [chairSpecs, setChairSpecsState] = useState<ChairSpec[]>(() => []);
  const [spacingSettings, setSpacingSettingsState] = useState<SpacingSettings>(() => ({
    minItemSpacing: 2,
    minWallSpacing: 2,
    minFixtureSpacing: 4,
    minTableSpacing: 3,
    enableCollisionDetection: true,
    showCollisionWarnings: true,
  }));
  const [eventQuestions, setEventQuestions] = useState<EventQuestion[]>([]);

  // Expanded states
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

  // ==================== HANDLERS ====================
  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 2500);
  };

  const handleSaveVenues = (updated: Venue[]) => { setVenuesState(updated); showSuccess('Venues saved!'); };
  const handleSaveTables = (updated: TableSpec[]) => { setTableSpecsState(updated); showSuccess('Tables saved!'); };
  const handleSaveFixtures = (updated: FixtureType[]) => { setFixtureTypesState(updated); showSuccess('Fixtures saved!'); };
  const handleSaveGuidelines = (updated: Guideline[]) => { setGuidelinesState(updated); showSuccess('Guidelines saved!'); };
  const handleSaveTemplates = (updated: LayoutTemplate[]) => { setTemplatesState(updated); showSuccess('Templates saved!'); };
  const handleSaveUsers = (updated: User[]) => { setUsersState(updated); showSuccess('Users saved!'); };
  const handleSaveConfig = (updated: Config) => { setConfigState(updated); showSuccess('Branding saved!'); };
  const handleSaveChairs = (updated: ChairSpec[]) => { setChairSpecsState(updated); showSuccess('Chairs saved!'); };
  const handleSaveSpacing = (updated: SpacingSettings) => { setSpacingSettingsState(updated); showSuccess('Spacing saved!'); };

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

  // ==================== TABS ====================
  const tabs = [
    { id: 'venues', label: '🏛️ Venues' },
    { id: 'tables', label: '🪑 Tables' },
    { id: 'chairs', label: '💺 Chairs' },
    { id: 'fixtures', label: '📦 Fixtures' },
    { id: 'decor', label: '🎀 Decor' },
    { id: 'spacing', label: '📐 Spacing' },
    { id: 'templates', label: '📋 Templates' },
    { id: 'guidelines', label: '💡 Guidelines' },
    { id: 'event-questions', label: '❓ Questions' },
    { id: 'users', label: '👥 Users' },
    { id: 'access-control', label: '🔐 Access' },
    { id: 'branding', label: '🎨 Branding' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#4A1942] text-white p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Admin Panel</h2>
          <button onClick={onClose} className="text-2xl hover:opacity-80">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto bg-white">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeTab === tab.id ? 'border-b-2 border-[#4A1942] text-[#4A1942]' : 'text-gray-600 hover:text-gray-800'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {activeTab === 'venues' && <VenueManagement venues={venues} config={config} onSaveVenues={handleSaveVenues} expandedVenues={expandedVenues} onToggleVenue={toggleVenueExpanded} customShapeVenueId={customShapeVenueId} onOpenShapeBuilder={setCustomShapeVenueId} />}
          {activeTab === 'tables' && <TableManagement tableSpecs={tableSpecs} config={config} onSaveTables={handleSaveTables} expandedTables={expandedTables} onToggleTable={toggleTableExpanded} />}
          {activeTab === 'chairs' && <ChairManagement chairSpecs={chairSpecs} config={config} onSaveChairs={handleSaveChairs} expandedChairs={expandedChairs} onToggleChair={toggleChairExpanded} />}
          {activeTab === 'fixtures' && <FixtureManagement fixtureTypes={fixtureTypes} config={config} onSaveFixtures={handleSaveFixtures} expandedFixtures={expandedVenueFixtures} onToggleFixture={toggleVenueFixtureExpanded} onShowDrawingTool={() => setShowDrawingTool(true)} />}
          {activeTab === 'decor' && <AdminDecorSection config={config} decorItems={decorItems} setDecorItems={setDecorItemsState} decorCategories={decorCategories} setDecorCategories={setDecorCategoriesState} decorArrangements={decorArrangements} setDecorArrangements={setDecorArrangementsState} decorPackages={decorPackages} setDecorPackages={setDecorPackagesState} onShowSuccess={showSuccess} />}
          {activeTab === 'spacing' && <SpacingManagement spacingSettings={spacingSettings} config={config} onSaveSpacing={handleSaveSpacing} />}
          {activeTab === 'templates' && <TemplateManagement templates={templates} venues={venues} config={config} onSaveTemplates={handleSaveTemplates} onLoadTemplate={onLoadTemplateForEdit || (() => {})} expandedTemplates={expandedTemplates} onToggleTemplate={toggleTemplateExpanded} />}
          {activeTab === 'guidelines' && <GuidelineManagement guidelines={guidelines} config={config} onSaveGuidelines={handleSaveGuidelines} expandedGuidelines={expandedGuidelines} onToggleGuideline={toggleGuidelineExpanded} />}
          {activeTab === 'event-questions' && <EventQuestionsManagement eventQuestions={eventQuestions} config={config} onSaveQuestions={setEventQuestions} />}
          {activeTab === 'users' && <UserManagement users={users} config={config} onSaveUsers={handleSaveUsers} onShowCreateModal={() => setShowCreateUserModal(true)} expandedUsers={expandedUsers} onToggleUser={toggleUserExpanded} />}
          {activeTab === 'access-control' && <AccessControlPanel onClose={() => setActiveTab('venues')} inline={true} />}
          {activeTab === 'branding' && <BrandingManagement config={config} onSaveConfig={handleSaveConfig} expandedSections={expandedBrandingSections} onToggleSection={toggleBrandingSection} />}
        </div>
      </div>
    </div>
  );
}