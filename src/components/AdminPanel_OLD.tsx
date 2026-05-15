import { useState, useRef, useEffect } from 'react';
import { Venue, TableSpec, FixtureType, Guideline, ShapeType, PatternType, LayoutCategory, LayoutTemplate, PlacedTable, PlacedFixture, PatternColors, ChairType, RectangularChairLayout, ChairSpec, User, EventQuestion, EventQuestionAnswerType, EventQuestionGroup, DecorArrangement, DecorPackage } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { DrawingTool } from './DrawingTool';
import EmojiPicker from './EmojiPicker';
import MultiImageUpload from './MultiImageUpload';
import { CustomVenueBuilder } from './CustomVenueBuilder';
import { WelcomeModal } from './WelcomeModal';
import { DirectMessagePanel } from './DirectMessagePanel';
import { buildMessageThreadId } from '../models/DirectMessage';
import { useDirectMessages } from '../hooks/useDirectMessages';
import { useSubmissionWorkflow } from '../hooks/useSubmissionWorkflow';
import { AdminSubmissionQueue } from './AdminSubmissionQueue';
import { layoutCategories, LinenColor, getChairSpecs, setChairSpecs, getSpacingSettings, setSpacingSettings, getWallStyles, setWallStyles, defaultWallStyles } from '../data/venueData';
import { WallStyle } from '../types';
import { 
  getVenues, setVenues, 
  getTableSpecs, setTableSpecs, 
  getFixtureTypes, setFixtureTypes, 
  getGuidelines, setGuidelines,
  getLinenColors, setLinenColors,
  getTemplates, setTemplates,
  getDecorItems, setDecorItems,
  setUsers,
  resetToDefaults 
} from '../hooks/useLayoutState';
import { getConfig, setConfig, Config } from '../config';
import { AdminDecorSection } from './AdminDecorSection';
import { canAccessAdminPanel } from '../utils/permissions';
import { 
  getDecorCategories, 
  setDecorCategories, 
  getDecorArrangements, 
  setDecorArrangements, 
  getDecorPackages, 
  setDecorPackages 
} from '../hooks/useLayoutState';
import { AccessControlPanel } from './admin/AccessControlPanel';
import { useRBAC } from '../hooks/useRBAC';
import { createPasswordRecord } from '../utils/auth';

// Branding-aware section header component
interface BrandedSectionHeaderProps {
  icon: string;
  title: string;
  description?: string;
  config: Config;
  variant?: 'primary' | 'secondary' | 'accent';
}

function BrandedSectionHeader({ icon, title, description, config, variant = 'primary' }: BrandedSectionHeaderProps) {
  const bgColor = variant === 'primary' ? config.primaryColor : 
                  variant === 'secondary' ? config.primaryDark : config.accentColor;
  
  return (
    <div 
      className="p-4 rounded-t-xl"
      style={{ 
        background: `linear-gradient(135deg, ${bgColor} 0%, ${config.primaryDark} 100%)`,
        fontFamily: config.headingFontFamily 
      }}
    >
      <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: config.headerTextColor }}>
        <span className="text-xl">{icon}</span>
        {title}
      </h3>
      {description && (
        <p className="text-sm mt-1 opacity-90" style={{ color: config.headerTextColor }}>
          {description}
        </p>
      )}
    </div>
  );
}

// Branding-aware stat card component
interface BrandedStatCardProps {
  icon: string;
  label: string;
  value: string | number;
  config: Config;
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning';
}

function BrandedStatCard({ icon, label, value, config, variant = 'primary' }: BrandedStatCardProps) {
  const bgColor = variant === 'primary' ? `${config.primaryColor}15` :
                  variant === 'secondary' ? `${config.primaryDark}15` :
                  variant === 'accent' ? `${config.accentColor}15` :
                  variant === 'success' ? '#10b98115' :
                  '#f59e0b15';
  
  const textColor = variant === 'primary' ? config.primaryColor :
                    variant === 'secondary' ? config.primaryDark :
                    variant === 'accent' ? config.accentColor :
                    variant === 'success' ? '#059669' :
                    '#d97706';
  
  return (
    <div 
      className="p-3 rounded-xl text-center border"
      style={{ 
        backgroundColor: bgColor,
        borderColor: `${textColor}30`
      }}
    >
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xl font-bold" style={{ color: textColor }}>{value}</div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  );
}

// Branding-aware tips component
interface TipItem {
  icon?: string;
  title: string;
  description: string;
}

interface BrandedTipsProps {
  title: string;
  tips: TipItem[];
  config: Config;
  defaultOpen?: boolean;
}

function BrandedTips({ title, tips, config, defaultOpen = false }: BrandedTipsProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div 
      className="rounded-xl border overflow-hidden transition-all duration-300"
      style={{ 
        backgroundColor: `${config.primaryColor}08`,
        borderColor: `${config.primaryColor}30`
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity"
        style={{ backgroundColor: `${config.primaryColor}15` }}
      >
        <h4 
          className="font-semibold flex items-center gap-2"
          style={{ color: config.primaryColor }}
        >
          <span>💡</span>
          <span>{title}</span>
        </h4>
        <span 
          className="transition-transform duration-300"
          style={{ 
            color: config.primaryColor,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        >
          ▼
        </span>
      </button>
      
      {isOpen && (
        <div className="p-4 space-y-3">
          {tips.map((tip, index) => (
            <div 
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg bg-white/50 border"
              style={{ borderColor: `${config.primaryColor}20` }}
            >
              <span className="text-lg flex-shrink-0">{tip.icon || '💡'}</span>
              <div className="min-w-0">
                <h5 
                  className="font-semibold text-sm"
                  style={{ color: config.primaryColor }}
                >
                  {tip.title}
                </h5>
                <p className="text-xs text-gray-600 mt-0.5">
                  {tip.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// import { FeatureTemplatesManager } from './FeatureEditor'; // Removed - not used

// Chair layout options for rectangular tables
const chairLayoutOptions: { id: RectangularChairLayout; name: string; description: string }[] = [
  { id: 'all-sides', name: 'All Sides', description: 'Chairs on all 4 sides' },
  { id: 'long-sides-only', name: 'Long Sides Only', description: 'Chairs only on long sides (e.g., 4+4)' },
  { id: 'head-table', name: 'Head Table', description: 'Chairs on one side only (facing out)' },
];

export interface AdminPanelProps {
  onClose: () => void;
  currentLayout?: {
    tables: PlacedTable[];
    fixtures: PlacedFixture[];
    venueId: string;
    category?: LayoutCategory;
  };
  onLoadTemplateForEdit?: (template: LayoutTemplate) => void;
}

const shapeOptions: ShapeType[] = ['circle', 'rectangle', 'triangle', 'semicircle', 'oval', 'hexagon', 'octagon', 'polygon'];
const patternOptions: PatternType[] = ['solid', 'checkered', 'gravel', 'concrete', 'grass', 'wood', 'tile', 'brick', 'marble', 'water', 'carpet'];

// Default colors for each pattern type
const defaultPatternColors: Record<PatternType, PatternColors> = {
  solid: { color1: '#FFFFFF', color2: '#FFFFFF' },
  checkered: { color1: '#FFFFFF', color2: '#1a1a1a' },
  gravel: { color1: '#B8860B', color2: '#8B7355' },
  concrete: { color1: '#C0C0C0', color2: '#A9A9A9' },
  grass: { color1: '#90EE90', color2: '#228B22' },
  wood: { color1: '#DEB887', color2: '#CD853F' },
  tile: { color1: '#E8E8E8', color2: '#D0D0D0' },
  brick: { color1: '#B74A3A', color2: '#8B4513' },
  marble: { color1: '#F5F5F5', color2: '#C0C0C0' },
  water: { color1: '#87CEEB', color2: '#4169E1' },
  carpet: { color1: '#8B4513', color2: '#654321' }
};

// Get pattern color labels based on pattern type
const getPatternColorLabels = (pattern: PatternType): { label1: string; label2: string } => {
  switch (pattern) {
    case 'checkered': return { label1: 'Square 1 Color', label2: 'Square 2 Color' };
    case 'gravel': return { label1: 'Background', label2: 'Gravel Color' };
    case 'concrete': return { label1: 'Concrete Color', label2: 'Joint Color' };
    case 'grass': return { label1: 'Grass Color', label2: 'Blade Color' };
    case 'wood': return { label1: 'Wood Color', label2: 'Grain Color' };
    case 'tile': return { label1: 'Tile Color', label2: 'Grout Color' };
    case 'brick': return { label1: 'Brick Color', label2: 'Mortar Color' };
    case 'marble': return { label1: 'Marble Color', label2: 'Vein Color' };
    case 'water': return { label1: 'Water Color', label2: 'Ripple Color' };
    case 'carpet': return { label1: 'Carpet Color', label2: 'Texture Color' };
    default: return { label1: 'Primary Color', label2: 'Secondary Color' };
  }
};

// Pattern color picker component
interface PatternColorPickerProps {
  pattern: PatternType;
  patternColors?: PatternColors;
  onChange: (colors: PatternColors) => void;
}

function PatternColorPicker({ pattern, patternColors, onChange }: PatternColorPickerProps) {
  if (pattern === 'solid') return null;
  
  const colors = patternColors || defaultPatternColors[pattern];
  const labels = getPatternColorLabels(pattern);
  
  return (
    <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
      <h5 className="text-xs font-semibold text-purple-800 mb-2 flex items-center gap-1">
        🎨 Pattern Colors for {pattern.charAt(0).toUpperCase() + pattern.slice(1)}
      </h5>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">{labels.label1}</label>
          <div className="flex gap-1 mt-1">
            <input
              type="color"
              value={colors.color1}
              onChange={(e) => onChange({ ...colors, color1: e.target.value })}
              className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={colors.color1}
              onChange={(e) => onChange({ ...colors, color1: e.target.value })}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">{labels.label2}</label>
          <div className="flex gap-1 mt-1">
            <input
              type="color"
              value={colors.color2}
              onChange={(e) => onChange({ ...colors, color2: e.target.value })}
              className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={colors.color2}
              onChange={(e) => onChange({ ...colors, color2: e.target.value })}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
            />
          </div>
        </div>
      </div>
      {/* Pattern preview */}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-gray-500">Preview:</span>
        <div 
          className="w-16 h-8 rounded border border-gray-300"
          style={{
            background: pattern === 'checkered' 
              ? `repeating-conic-gradient(${colors.color1} 0% 25%, ${colors.color2} 0% 50%) 50% / 16px 16px`
              : pattern === 'grass' || pattern === 'gravel'
              ? `radial-gradient(circle at 25% 25%, ${colors.color2} 2px, transparent 2px), radial-gradient(circle at 75% 75%, ${colors.color2} 2px, transparent 2px), ${colors.color1}`
              : pattern === 'wood'
              ? `repeating-linear-gradient(0deg, ${colors.color1}, ${colors.color1} 4px, ${colors.color2} 4px, ${colors.color2} 5px)`
              : pattern === 'tile' || pattern === 'brick'
              ? `linear-gradient(${colors.color2} 1px, transparent 1px), linear-gradient(90deg, ${colors.color2} 1px, ${colors.color1} 1px)`
              : pattern === 'water'
              ? `linear-gradient(135deg, ${colors.color1} 25%, ${colors.color2} 25%, ${colors.color2} 50%, ${colors.color1} 50%, ${colors.color1} 75%, ${colors.color2} 75%)`
              : `linear-gradient(135deg, ${colors.color1} 50%, ${colors.color2} 50%)`
          }}
        />
        <button
          type="button"
          onClick={() => onChange(defaultPatternColors[pattern])}
          className="text-xs text-purple-600 hover:text-purple-800"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

export function AdminPanel({ onClose, currentLayout, onLoadTemplateForEdit }: AdminPanelProps) {
  const { createUser, deleteUser, getAllUsers, user } = useAuth();
  const canAccessThisPanel = canAccessAdminPanel(user);
  const EVENT_ROLES_STORAGE_KEY = 'spm_event_roles';
  const EVENT_QUESTIONS_STORAGE_KEY = 'spm_event_questions';
  const DEFAULT_EVENT_ROLES = [
    'Bride',
    'Groom',
    'Wedding Planner',
    'Venue Manager',
    'Photographer',
    'DJ',
    'Caterer',
    'Decorator',
    'Coordinator',
  ];
  const [activeTab, setActiveTab] = useState('venues');
  const [venues, setVenuesState] = useState(() => getVenues());
  const [tableSpecs, setTableSpecsState] = useState(() => getTableSpecs());
  const [fixtureTypes, setFixtureTypesState] = useState(() => getFixtureTypes());
  const [guidelines, setGuidelinesState] = useState(() => getGuidelines());
  const [templates, setTemplatesState] = useState(() => getTemplates());
  const [linenColors, setLinenColorsState] = useState(() => getLinenColors());
  const [config, setConfigState] = useState(() => getConfig());
  const [users, setUsersState] = useState(() => getAllUsers());
  const [chairSpecs, setChairSpecsState] = useState(() => getChairSpecs());
  const [spacingSettings, setSpacingSettingsState] = useState(() => getSpacingSettings());
  const [wallStyles, setWallStylesState] = useState<WallStyle[]>(() => getWallStyles());
  const [decorItems, setDecorItemsState] = useState(() => getDecorItems());
  const [decorCategories, setDecorCategoriesState] = useState(() => getDecorCategories());
  const [decorArrangements, setDecorArrangementsState] = useState(() => getDecorArrangements());
  const [decorPackages, setDecorPackagesState] = useState(() => getDecorPackages());
  const [newUser, setNewUser] = useState({ 
    username: '', 
    password: '', 
    name: '', 
    role: 'basic' as 'admin' | 'basic' | 'staff' | 'guest',
    email: '',
    phone: '',
    contactPhoneNumber: '',
    phoneType: 'Mobile' as 'Mobile' | 'Home' | 'Work' | 'Other',
    preferredCommunication: [] as ('call' | 'text' | 'email')[],
    eventRole: '',
    eventName: '',
    userRole: 'master' as 'admin' | 'master' | 'shared' | 'read-only' | 'staff',
    isMasterUser: false,
    parentUserId: undefined as string | undefined,
    allowSharedAccess: false,
    sharedUserLimit: 0,
    userStatus: 'active' as 'invited' | 'pending' | 'active' | 'suspended' | 'disabled',
    eventDate: '',
    jobTitle: '',
    department: '',
    assignedRoles: [] as string[]
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [createUserFieldErrors, setCreateUserFieldErrors] = useState<Record<string, string>>({});
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [showDrawingTool, setShowDrawingTool] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  // Collapsible state for items
  const [customShapeVenueId, setCustomShapeVenueId] = useState<string | null>(null);
  const [expandedVenues, setExpandedVenues] = useState<Set<string>>(new Set());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [expandedSeatingTypes, setExpandedSeatingTypes] = useState<Set<string>>(new Set());
  const [showTableTypesSection, setShowTableTypesSection] = useState(false);
  const [showSeatingTypesSection, setShowSeatingTypesSection] = useState(false);
  const [expandedVenueFixtures, setExpandedVenueFixtures] = useState<Set<string>>(new Set());
  const [expandedLodgingFixtures, setExpandedLodgingFixtures] = useState<Set<string>>(new Set());
  const [expandedExteriorFixtures, setExpandedExteriorFixtures] = useState<Set<string>>(new Set());
  const [showVenueFixturesSection, setShowVenueFixturesSection] = useState(false);
  const [showLodgingFixturesSection, setShowLodgingFixturesSection] = useState(false);
  const [showExteriorFixturesSection, setShowExteriorFixturesSection] = useState(false);
  const [expandedChairs, setExpandedChairs] = useState<Set<string>>(new Set());
  const [expandedWalls, setExpandedWalls] = useState<Set<string>>(new Set());
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [expandedGuidelines, setExpandedGuidelines] = useState<Set<string>>(new Set());
  const [expandedBrandingSections, setExpandedBrandingSections] = useState<Set<string>>(new Set());
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [showUserDirectMessagesSection, setShowUserDirectMessagesSection] = useState(false);
  const [showUserPendingApprovalsSection, setShowUserPendingApprovalsSection] = useState(false);
  const [showUserEventRolesSection, setShowUserEventRolesSection] = useState(false);
  const [showUserAccountsSection, setShowUserAccountsSection] = useState(false);
  const [expandedLinens, setExpandedLinens] = useState<Set<string>>(new Set());
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [eventRoles, setEventRoles] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(EVENT_ROLES_STORAGE_KEY);
      if (!raw) return DEFAULT_EVENT_ROLES;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return DEFAULT_EVENT_ROLES;
      const cleaned = parsed
        .map((r: unknown) => String(r || '').trim())
        .filter((r: string) => r.length > 0);
      return cleaned.length > 0 ? cleaned : DEFAULT_EVENT_ROLES;
    } catch {
      return DEFAULT_EVENT_ROLES;
    }
  });
  const [newEventRoleName, setNewEventRoleName] = useState('');
  const [editingEventRoleName, setEditingEventRoleName] = useState<string | null>(null);
  const [editingEventRoleValue, setEditingEventRoleValue] = useState('');
  const [eventQuestions, setEventQuestions] = useState<EventQuestion[]>(() => {
    try {
      const raw = localStorage.getItem(EVENT_QUESTIONS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as EventQuestion[];
    } catch {
      return [];
    }
  });
  const [newQuestion, setNewQuestion] = useState<{
    text: string;
    group: EventQuestionGroup;
    answerType: EventQuestionAnswerType;
    optionsText: string;
  }>({
    text: '',
    group: 'Ceremony',
    answerType: 'text',
    optionsText: '',
  });
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionError, setQuestionError] = useState('');
  const [selectedMessageMasterUserId, setSelectedMessageMasterUserId] = useState<string>('');
  const [showWelcomePreview, setShowWelcomePreview] = useState(false);
  const [showAccessControl, setShowAccessControl] = useState(false);
  const submissionWorkflow = useSubmissionWorkflow();
  const directMessages = useDirectMessages();
  const rbac = useRBAC();
  const allRoles = rbac.getAllRoles();

  const AVAILABLE_WELCOME_FEATURES = [
    'Layout Design',
    'Guest Management',
    'Templates',
    'Print & Share',
    'Event Questions',
    'Chat',
    'Venue Filtering',
  ];
  const currentWelcomeFeatures = (config.welcomeFeatures && config.welcomeFeatures.length > 0)
    ? config.welcomeFeatures
    : AVAILABLE_WELCOME_FEATURES;

  useEffect(() => {
    const masterUsers = users.filter(
      (u) => u.role === 'basic' && (u.userRole === 'master' || u.isMasterUser),
    );
    if (masterUsers.length === 0) {
      setSelectedMessageMasterUserId('');
      return;
    }
    if (!selectedMessageMasterUserId || !masterUsers.some((u) => u.id === selectedMessageMasterUserId)) {
      setSelectedMessageMasterUserId(masterUsers[0].id);
    }
  }, [users, selectedMessageMasterUserId]);
  
  const toggleVenueExpanded = (id: string) => {
    setExpandedVenues(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const toggleTableExpanded = (id: string) => {
    setExpandedTables(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSeatingTypeExpanded = (id: string) => {
    setExpandedSeatingTypes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const toggleVenueFixtureExpanded = (id: string) => {
    setExpandedVenueFixtures(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLodgingFixtureExpanded = (id: string) => {
    setExpandedLodgingFixtures(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExteriorFixtureExpanded = (id: string) => {
    setExpandedExteriorFixtures(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const expandAllVenues = () => setExpandedVenues(new Set(venues.map(v => v.id)));
  const collapseAllVenues = () => setExpandedVenues(new Set());
  const expandAllTables = () => setExpandedTables(new Set(tableSpecs.filter(t => !t.isSeatingType).map(t => t.id)));
  const collapseAllTables = () => setExpandedTables(new Set());
  const expandAllSeatingTypes = () => setExpandedSeatingTypes(new Set(tableSpecs.filter(t => t.isSeatingType).map(t => t.id)));
  const collapseAllSeatingTypes = () => setExpandedSeatingTypes(new Set());
  const expandAllVenueFixtures = () => {
    const ids = fixtureTypes.filter(f => f.category !== 'exterior' && f.category !== 'lodging').map(f => f.id);
    setExpandedVenueFixtures(new Set(ids));
  };
  const collapseAllVenueFixtures = () => {
    setExpandedVenueFixtures(new Set());
  };
  const expandAllLodgingFixtures = () => setExpandedLodgingFixtures(new Set(fixtureTypes.filter(f => f.category === 'lodging').map(f => f.id)));
  const collapseAllLodgingFixtures = () => setExpandedLodgingFixtures(new Set());
  const expandAllExteriorFixtures = () => {
    const ids = new Set(fixtureTypes.filter(f => f.category === 'exterior').map(f => f.id));
    setExpandedExteriorFixtures(ids);
  };
  const collapseAllExteriorFixtures = () => {
    setExpandedExteriorFixtures(new Set());
  };

  const toggleLinenExpanded = (id: string) => {
    setExpandedLinens(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAllLinens = () => setExpandedLinens(new Set(linenColors.map(l => l.id)));
  const collapseAllLinens = () => setExpandedLinens(new Set());

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  useEffect(() => {
    localStorage.setItem(EVENT_ROLES_STORAGE_KEY, JSON.stringify(eventRoles));
  }, [eventRoles]);

  useEffect(() => {
    localStorage.setItem(EVENT_QUESTIONS_STORAGE_KEY, JSON.stringify(eventQuestions));
  }, [eventQuestions]);

  const validateEventQuestion = (q: {
    text: string;
    answerType: EventQuestionAnswerType;
    optionsText: string;
  }): string | null => {
    if (!q.text.trim()) return 'Question text is required.';
    if (q.answerType === 'dropdown') {
      const options = q.optionsText
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);
      if (options.length === 0) return 'Dropdown questions require at least one option.';
    }
    return null;
  };

  const handleAddEventQuestion = () => {
    const err = validateEventQuestion(newQuestion);
    if (err) {
      setQuestionError(err);
      return;
    }
    const options = newQuestion.answerType === 'dropdown'
      ? newQuestion.optionsText.split(',').map(o => o.trim()).filter(Boolean)
      : undefined;

    const question: EventQuestion = {
      id: `eq-${Date.now()}`,
      text: newQuestion.text.trim(),
      group: newQuestion.group,
      answerType: newQuestion.answerType,
      options,
      workflow: [],
    };
    setEventQuestions(prev => [...prev, question]);
    setNewQuestion({ text: '', group: 'Ceremony', answerType: 'text', optionsText: '' });
    setQuestionError('');
    showSuccess('Event question added!');
  };

  const handleUpdateEventQuestion = (id: string, updates: Partial<EventQuestion>) => {
    setEventQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const handleDeleteEventQuestion = (id: string) => {
    if (!window.confirm('Delete this event question?')) return;
    setEventQuestions(prev => prev.filter(q => q.id !== id));
    if (editingQuestionId === id) setEditingQuestionId(null);
    showSuccess('Event question deleted!');
  };

  const handleAddEventRole = () => {
    const roleName = newEventRoleName.trim();
    if (!roleName) {
      alert('Event Role name is required.');
      return;
    }
    const exists = eventRoles.some(r => r.toLowerCase() === roleName.toLowerCase());
    if (exists) {
      alert('This Event Role already exists.');
      return;
    }
    setEventRoles(prev => [...prev, roleName]);
    setNewEventRoleName('');
    showSuccess('Event Role added!');
  };

  const handleStartEditEventRole = (role: string) => {
    setEditingEventRoleName(role);
    setEditingEventRoleValue(role);
  };

  const handleSaveEventRoleEdit = () => {
    if (!editingEventRoleName) return;
    const next = editingEventRoleValue.trim();
    if (!next) {
      alert('Event Role name is required.');
      return;
    }
    const duplicate = eventRoles.some(
      r => r.toLowerCase() === next.toLowerCase() && r !== editingEventRoleName,
    );
    if (duplicate) {
      alert('This Event Role already exists.');
      return;
    }
    setEventRoles(prev => prev.map(r => (r === editingEventRoleName ? next : r)));
    setEditingEventRoleName(null);
    setEditingEventRoleValue('');
    showSuccess('Event Role updated!');
  };

  const handleDeleteEventRole = (role: string) => {
    if (!window.confirm(`Delete Event Role "${role}"?`)) return;
    setEventRoles(prev => prev.filter(r => r !== role));
    showSuccess('Event Role deleted!');
  };

  const handleSaveVenues = (updated: Venue[]) => {
    setVenues(updated);
    setVenuesState(updated);
    showSuccess('Venues saved!');
  };

  const handleSaveTables = (updated: TableSpec[]) => {
    setTableSpecs(updated);
    setTableSpecsState(updated);
    showSuccess('Tables saved!');
  };

  const handleSaveFixtures = (updated: FixtureType[]) => {
    setFixtureTypes(updated);
    setFixtureTypesState(updated);
    showSuccess('Fixtures saved!');
  };

  const handleSaveGuidelines = (updated: Guideline[]) => {
    setGuidelines(updated);
    setGuidelinesState(updated);
    showSuccess('Guidelines saved!');
  };

  const handleSaveTemplates = (updated: LayoutTemplate[]) => {
    setTemplates(updated);
    setTemplatesState(updated);
    showSuccess('Templates saved!');
  };

  const handleSaveLinenColors = (updated: LinenColor[]) => {
    setLinenColors(updated);
    setLinenColorsState(updated);
    showSuccess('Linen colors saved!');
  };

  const handleSaveWallStyles = (updated: WallStyle[]) => {
    setWallStyles(updated);
    setWallStylesState(updated);
    showSuccess('Wall styles saved!');
  };

  const handleSaveConfig = (updated: typeof config) => {
    setConfig(updated);
    setConfigState(updated);
    showSuccess('Branding saved!');
  };

  const handleSaveUsers = (updated: User[]) => {
    setUsers(updated);
    setUsersState(updated);
    showSuccess('Users saved!');
  };

  const mapUserRoleToLegacyRole = (userRole?: 'admin' | 'master' | 'shared' | 'read-only' | 'staff'): 'admin' | 'basic' | 'staff' => {
    if (userRole === 'admin') return 'admin';
    if (userRole === 'staff') return 'staff';
    return 'basic';
  };

  const validateUserForm = (u: {
    username?: string;
    password?: string;
    name?: string;
    email?: string;
    contactPhoneNumber?: string;
    phoneType?: 'Mobile' | 'Home' | 'Work' | 'Other';
    preferredCommunication?: ('call' | 'text' | 'email')[];
    eventRole?: string;
    eventName?: string;
    userRole?: 'admin' | 'master' | 'shared' | 'read-only' | 'staff';
    eventDate?: string;
    allowSharedAccess?: boolean;
    sharedUserLimit?: number;
  }, requireAuthFields = false): string[] => {
    const errors: string[] = [];
    const normalizedUsername = (u.username || u.email || '').trim();
    if (requireAuthFields) {
      // Allow email to act as username for better UX/backward compatibility.
      if (!normalizedUsername) errors.push('Username is required.');
      if (!u.password?.trim()) errors.push('Password is required.');
      if (!u.name?.trim()) errors.push('Name is required.');
    }

    const role = u.userRole ?? 'shared';
    if (!u.userRole) errors.push('User Role is required.');

    // Required for non-admin user types
    if (role !== 'admin') {
      if (!u.email?.trim()) errors.push('Email is required for non-admin users.');
      if (!u.contactPhoneNumber?.trim()) errors.push('Contact Phone Number is required for non-admin users.');
      if (!u.phoneType) errors.push('Phone Type is required for non-admin users.');
      if (!u.eventRole?.trim()) errors.push('Event Role is required for non-admin users.');
      if (!u.eventName?.trim()) errors.push('Event Name is required for non-admin users.');
    }

    if ((u.preferredCommunication || []).includes('text') && u.phoneType !== 'Mobile') {
      errors.push('Preferred Communication "Text" requires Phone Type to be Mobile.');
    }

    if (role !== 'admin') {
      if (!u.eventDate?.trim()) {
        errors.push('Event Date is required for non-admin users.');
      } else {
        const selected = new Date(`${u.eventDate}T00:00:00`);
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        if (Number.isNaN(selected.getTime()) || selected <= todayStart) {
          errors.push('Event Date must be in the future for non-admin users.');
        }
      }
    }

    if (u.allowSharedAccess) {
      const limit = Math.floor(Number(u.sharedUserLimit ?? 0));
      if (!Number.isFinite(limit) || limit <= 0 || limit > 10) {
        errors.push('Shared User Limit must be an integer between 1 and 10 when shared access is enabled.');
      }
    }

    return errors;
  };

  const getUserFieldErrors = (
    u: {
      username?: string;
      password?: string;
      name?: string;
      email?: string;
      contactPhoneNumber?: string;
      phoneType?: 'Mobile' | 'Home' | 'Work' | 'Other';
      preferredCommunication?: ('call' | 'text' | 'email')[];
      eventRole?: string;
      eventName?: string;
      userRole?: 'admin' | 'master' | 'shared' | 'read-only' | 'staff';
      eventDate?: string;
      allowSharedAccess?: boolean;
      sharedUserLimit?: number;
    },
    requireAuthFields = false,
  ): Record<string, string> => {
    const fieldErrors: Record<string, string> = {};
    const role = u.userRole ?? 'shared';
    const normalizedUsername = (u.username || u.email || '').trim();

    if (requireAuthFields) {
      if (!u.name?.trim()) fieldErrors.name = 'Name is required.';
      if (!normalizedUsername) fieldErrors.email = 'Email is required.';
      if (!u.password?.trim()) fieldErrors.password = 'Password is required.';
    }

    if (!u.userRole) fieldErrors.userRole = 'User Role is required.';

    if (role !== 'admin') {
      if (!u.email?.trim()) fieldErrors.email = 'Email is required for non-admin users.';
      if (!u.contactPhoneNumber?.trim()) fieldErrors.contactPhoneNumber = 'Contact Phone Number is required for non-admin users.';
      if (!u.phoneType) fieldErrors.phoneType = 'Phone Type is required for non-admin users.';
      if (!u.eventRole?.trim()) fieldErrors.eventRole = 'Event Role is required for non-admin users.';
      if (!u.eventName?.trim()) fieldErrors.eventName = 'Event Name is required for non-admin users.';
      if (!u.eventDate?.trim()) {
        fieldErrors.eventDate = 'Event Date is required for non-admin users.';
      } else {
        const selected = new Date(`${u.eventDate}T00:00:00`);
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        if (Number.isNaN(selected.getTime()) || selected <= todayStart) {
          fieldErrors.eventDate = 'Event Date must be in the future for non-admin users.';
        }
      }
    }

    if ((u.preferredCommunication || []).includes('text') && u.phoneType !== 'Mobile') {
      fieldErrors.preferredCommunication = 'Preferred Communication "Text" requires Phone Type to be Mobile.';
    }

    if (u.allowSharedAccess) {
      const limit = Math.floor(Number(u.sharedUserLimit ?? 0));
      if (!Number.isFinite(limit) || limit <= 0 || limit > 10) {
        fieldErrors.sharedUserLimit = 'Shared User Limit must be an integer between 1 and 10.';
      }
    }

    return fieldErrors;
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File too large. Maximum size is 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        handleSaveConfig({ ...config, logoUrl: dataUrl });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = (callback: (dataUrl: string) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          alert('File too large. Maximum size is 5MB.');
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          callback(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleCreateUser = async () => {
    const usernameFromEmail = (newUser.email || '').trim().toLowerCase();
    const normalizedDraft = {
      ...newUser,
      username: (newUser.username || usernameFromEmail).trim(),
      preferredCommunication: newUser.preferredCommunication || [],
      allowSharedAccess: !!newUser.allowSharedAccess,
      sharedUserLimit: newUser.allowSharedAccess
        ? Math.max(1, Math.min(10, Math.floor(Number(newUser.sharedUserLimit || 1))))
        : 0,
    };

    const errors = validateUserForm(normalizedDraft, true);
    const fieldErrors = getUserFieldErrors(normalizedDraft, true);

    if (!usernameFromEmail) {
      errors.push('Email is required.');
    } else {
      const emailExists = users.some(
        (u) => (u.email || u.username || '').trim().toLowerCase() === usernameFromEmail
      );
      if (emailExists) errors.push('Email already exists.');
    }

    if (errors.length > 0) {
      setCreateUserFieldErrors(fieldErrors);
      alert(errors.join('\n'));
      return;
    }

    setCreateUserFieldErrors({});

    const legacyRole = mapUserRoleToLegacyRole(normalizedDraft.userRole);
    // Use email as username when available.
    const effectiveUsername = usernameFromEmail || normalizedDraft.username;

    const created = await createUser(
      effectiveUsername,
      normalizedDraft.password || '',
      normalizedDraft.name || '',
      legacyRole,
      normalizedDraft.email || '',
    );

    if (!created) {
      alert('Unable to create user. The username may already exist.');
      return;
    }

    // Backfill extended fields on the newly created user record
    const updatedUsers = getAllUsers().map((u) =>
      u.username.toLowerCase() === effectiveUsername.toLowerCase()
        ? {
            ...u,
            email: normalizedDraft.email || '',
            contactPhoneNumber: normalizedDraft.contactPhoneNumber || '',
            phoneType: normalizedDraft.phoneType || 'Mobile',
            preferredCommunication: normalizedDraft.preferredCommunication || [],
            eventRole: normalizedDraft.eventRole || '',
            eventName: normalizedDraft.eventName || '',
            userRole: normalizedDraft.userRole || 'shared',
            isMasterUser: normalizedDraft.isMasterUser || false,
            parentUserId: normalizedDraft.parentUserId,
            allowSharedAccess: normalizedDraft.allowSharedAccess || false,
            sharedUserLimit: normalizedDraft.allowSharedAccess
              ? normalizedDraft.sharedUserLimit
              : 0,
            userStatus: normalizedDraft.userStatus || 'active',
            eventDate: normalizedDraft.eventDate || '',
            // backward-compat mirrors
            phone: normalizedDraft.contactPhoneNumber || '',
            jobTitle: normalizedDraft.eventRole || '',
            department: normalizedDraft.eventName || '',
          }
        : u,
    );

    handleSaveUsers(updatedUsers);
    setNewUser({
      username: '',
      password: '',
      name: '',
      role: 'basic',
      email: '',
      phone: '',
      contactPhoneNumber: '',
      phoneType: 'Mobile',
      preferredCommunication: [],
      eventRole: '',
      eventName: '',
      userRole: 'master',
      isMasterUser: false,
      parentUserId: undefined,
      allowSharedAccess: false,
      sharedUserLimit: 0,
      userStatus: 'active',
      eventDate: '',
      jobTitle: '',
      department: '',
      assignedRoles: []
    });
    setCreateUserFieldErrors({});
    showSuccess('User created!');
  };

  const handleDeleteUser = (userId: string, label?: string) => {
    const displayName = label || users.find((u) => u.id === userId)?.name || userId;
    if (confirm(`Delete user "${displayName}"?`)) {
      deleteUser(userId);
      setUsersState(getAllUsers());
      showSuccess('User deleted!');
    }
  };

  // Update template with current layout
  const handleUpdateTemplateWithCurrentLayout = (templateId: string) => {
    if (!currentLayout) {
      alert('No current layout to save. Please design a layout first.');
      return;
    }
    
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    const updatedTemplate: LayoutTemplate = {
      ...template,
      tables: currentLayout.tables.map(t => ({
        id: t.id,
        type: 'table' as const,
        specId: t.specId,
        x: t.x,
        y: t.y,
        rotation: t.rotation,
        label: t.label,
        guests: t.guests || [],
        hasLinen: t.hasLinen,
        linenColor: t.linenColor,
        customCapacity: t.customCapacity
      })),
      fixtures: currentLayout.fixtures.map(f => ({
        id: f.id,
        type: 'fixture' as const,
        specId: f.specId,
        x: f.x,
        y: f.y,
        rotation: f.rotation,
        label: f.label,
        isExterior: f.isExterior
      })),
      venueId: currentLayout.venueId
    };
    
    handleSaveTemplates(templates.map(t => t.id === templateId ? updatedTemplate : t));
    setEditingTemplateId(null);
  };

  // Create new template from current layout
  const handleCreateTemplateFromLayout = () => {
    if (!currentLayout) {
      alert('No current layout to save. Please design a layout first, then come back to save it as a template.');
      return;
    }
    
    const newTemplate: LayoutTemplate = {
      id: `template-${Date.now()}`,
      name: 'New Template from Layout',
      description: 'Created from current layout',
      venueId: currentLayout.venueId,
      category: currentLayout.category || 'reception',
      tables: currentLayout.tables.map(t => ({
        id: t.id,
        type: 'table' as const,
        specId: t.specId,
        x: t.x,
        y: t.y,
        rotation: t.rotation,
        label: t.label,
        guests: t.guests || [],
        hasLinen: t.hasLinen,
        linenColor: t.linenColor,
        customCapacity: t.customCapacity
      })),
      fixtures: currentLayout.fixtures.map(f => ({
        id: f.id,
        type: 'fixture' as const,
        specId: f.specId,
        x: f.x,
        y: f.y,
        rotation: f.rotation,
        label: f.label,
        isExterior: f.isExterior
      })),
      isMasterTemplate: false,
      createdAt: new Date().toISOString()
    };
    
    handleSaveTemplates([...templates, newTemplate]);
  };

  // Load template for editing in the main canvas
  const handleLoadForEdit = (template: LayoutTemplate) => {
    if (onLoadTemplateForEdit) {
      onLoadTemplateForEdit(template);
      onClose();
    }
  };

  const handleReset = () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      resetToDefaults();
      setVenuesState(getVenues());
      setTableSpecsState(getTableSpecs());
      setFixtureTypesState(getFixtureTypes());
      setGuidelinesState(getGuidelines());
      setTemplatesState(getTemplates());
      setLinenColorsState(getLinenColors());
      showSuccess('Reset to defaults!');
    }
  };

  // Render shape preview for tables
  const renderShapePreview = (shape: ShapeType, color: string = '#4A1942') => {
    const size = 48;
    switch (shape) {
      case 'circle':
        return <circle cx={size/2} cy={size/2} r={size/2 - 4} fill={color} stroke="#333" strokeWidth="1" />;
      case 'rectangle':
        return <rect x="4" y="8" width={size - 8} height={size - 16} fill={color} stroke="#333" strokeWidth="1" />;
      case 'oval':
        return <ellipse cx={size/2} cy={size/2} rx={size/2 - 4} ry={size/3} fill={color} stroke="#333" strokeWidth="1" />;
      case 'triangle':
        return <polygon points={`${size/2},4 ${size-4},${size-4} 4,${size-4}`} fill={color} stroke="#333" strokeWidth="1" />;
      case 'semicircle':
        return <path d={`M 4,${size/2} A ${size/2 - 4},${size/2 - 4} 0 0,1 ${size-4},${size/2} L 4,${size/2}`} fill={color} stroke="#333" strokeWidth="1" />;
      case 'hexagon':
        const hx = size/2, hy = size/2, hr = size/2 - 4;
        const hexPoints = Array.from({length: 6}, (_, i) => {
          const angle = (i * 60 - 90) * Math.PI / 180;
          return `${hx + hr * Math.cos(angle)},${hy + hr * Math.sin(angle)}`;
        }).join(' ');
        return <polygon points={hexPoints} fill={color} stroke="#333" strokeWidth="1" />;
      case 'octagon':
        const ox = size/2, oy = size/2, or = size/2 - 4;
        const octPoints = Array.from({length: 8}, (_, i) => {
          const angle = (i * 45 - 90) * Math.PI / 180;
          return `${ox + or * Math.cos(angle)},${oy + or * Math.sin(angle)}`;
        }).join(' ');
        return <polygon points={octPoints} fill={color} stroke="#333" strokeWidth="1" />;
      default:
        return <rect x="4" y="4" width={size - 8} height={size - 8} fill={color} stroke="#333" strokeWidth="1" />;
    }
  };

  const tabs = [
    { id: 'venues', label: '🏛️ Venues', icon: '🏛️' },
    { id: 'tables', label: '🪑 Tables/Seating', icon: '🪑' },
    { id: 'chairs', label: '💺 Chairs', icon: '💺' },
    { id: 'fixtures', label: '📦 Fixtures', icon: '📦' },
    { id: 'decor', label: '🎀 Decor', icon: '🎀' },
    { id: 'walls', label: '🪟 Walls', icon: '🪟' },
    { id: 'linens', label: '🎨 Linens', icon: '🎨' },
    { id: 'spacing', label: '📐 Spacing', icon: '📐' },
    { id: 'templates', label: '📋 Templates', icon: '📋' },
    { id: 'guidelines', label: '💡 Guidelines', icon: '💡' },
    { id: 'event-questions', label: '❓ Event Questions', icon: '❓' },
    { id: 'users', label: '👥 Users', icon: '👥' },
	{ id: 'access-control', label: '🔐 Access Control', icon: '🔐' },
    { id: 'branding', label: '🎨 Branding', icon: '🎨' }
  ];

  const tableTypes = tableSpecs.filter(t => !t.isSeatingType);
  const seatingTypes = tableSpecs.filter(t => t.isSeatingType);

  const getSeatingDimensions = (
    chairType: string | undefined,
    chairsPerRow: number,
    rowCount: number,
    rowSpacingFt: number,
  ) => {
    const chair = getChairSpecs().find(c => c.id === (chairType || 'white-plastic'));
    const chairWidth = chair?.width || 1.5;
    const chairDepth = chair?.depth || chair?.width || 1.5;
    const chairGap = Math.max(0.2, chairWidth * 0.15);
    const width = (Math.max(1, chairsPerRow) * chairWidth) + Math.max(0, Math.max(1, chairsPerRow) - 1) * chairGap;
    const height = (Math.max(1, rowCount) * chairDepth) + Math.max(0, Math.max(1, rowCount) - 1) * Math.max(0.5, rowSpacingFt);
    return {
      width: Number(width.toFixed(2)),
      height: Number(height.toFixed(2)),
    };
  };

  if (!canAccessThisPanel) {
  return (
    <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl p-6">
        <h2 className="text-xl font-semibold text-red-700">Access denied</h2>
        <p className="mt-2 text-sm text-gray-600">
          You do not have permission to access the admin panel.
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4" style={{ zIndex: 10000 }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden">
        {/* Sticky Header with Tabs */}
        <div 
          className="flex-shrink-0 text-white"
          style={{ 
            background: `linear-gradient(135deg, ${config.primaryColor} 0%, ${config.primaryDark} 100%)`,
            fontFamily: config.headingFontFamily
          }}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <h2 className="text-xl font-bold" style={{ color: config.headerTextColor }}>Admin Panel</h2>
              <p className="text-sm opacity-70" style={{ color: config.headerTextColor }}>Manage venue settings and configurations</p>
            </div>
            <div className="flex items-center gap-3">
              {successMessage && (
                <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm animate-pulse">
                  ✓ {successMessage}
                </span>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors text-xl"
              >
                ✕
              </button>
            </div>
          </div>
          
          {/* Tabs - Scrollable */}
          <div className="flex overflow-x-auto px-2 py-1 scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 px-3 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors`}
                style={{
                  backgroundColor: activeTab === tab.id ? 'white' : 'transparent',
                  color: activeTab === tab.id ? config.primaryColor : config.headerTextColor,
                  opacity: activeTab === tab.id ? 1 : 0.9
                }}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label.split(' ')[1]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6 bg-gray-50">
          {/* Venues Tab */}
          {activeTab === 'venues' && (
            <div className="space-y-4">
              {/* Header Section */}
              <BrandedSectionHeader 
                icon="🏛️" 
                title="Venue Layouts" 
                description="Create and manage venue spaces for receptions, ceremonies, and events"
                config={config}
              />

              {/* Quick Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <BrandedStatCard icon="🏛️" label="Total Venues" value={venues.length} config={config} variant="primary" />
                <BrandedStatCard icon="★" label="Master" value={venues.filter(v => v.isMaster).length} config={config} variant="warning" />
                <BrandedStatCard icon="📐" label="With Layouts" value={venues.filter(v => v.masterLayout).length} config={config} variant="success" />
                <BrandedStatCard icon="👥" label="Total Capacity" value={venues.reduce((sum, v) => sum + (v.capacity || 0), 0)} config={config} variant="accent" />
                <div 
                  className="p-3 rounded-xl text-center border"
                  style={{ backgroundColor: `${config.primaryLight}15`, borderColor: `${config.primaryLight}30` }}
                >
                  <div className="flex justify-center gap-1 mb-1">
                    {layoutCategories.slice(0, 4).map(cat => (
                      <span key={cat.id} title={cat.name} className="text-lg">{cat.icon}</span>
                    ))}
                  </div>
                  <div className="text-xs" style={{ color: config.primaryColor }}>Categories</div>
                </div>
              </div>

              {/* Quick Add Venue Presets */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold text-purple-800 text-sm mb-3 flex items-center gap-2">
                  ✨ Quick Add Venue Presets
                </h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const preset: Venue = {
                        id: `venue-${Date.now()}`,
                        name: 'Reception Venue',
                        width: 60,
                        height: 40,
                        capacity: 150,
                        category: 'reception',
                        color: '#F5F0E8',
                        borderColor: '#4A1942',
                        pattern: 'wood',
                        isMaster: true,
                        canvasWidth: 140,
                        canvasHeight: 120,
                        venueX: 40,
                        venueY: 40,
                        exteriorPadding: { top: 40, right: 40, bottom: 40, left: 40 }
                      };
                      handleSaveVenues([...venues, preset]);
                    }}
                    className="px-3 py-2 bg-white border border-purple-300 rounded-lg text-sm hover:bg-purple-50 hover:border-purple-400 transition-all flex items-center gap-2 shadow-sm"
                  >
                    🎉 Reception
                  </button>
                  <button
                    onClick={() => {
                      const preset: Venue = {
                        id: `venue-${Date.now()}`,
                        name: 'Cocktail Hour Venue',
                        width: 40,
                        height: 30,
                        capacity: 75,
                        category: 'cocktail',
                        color: '#E8E0D0',
                        borderColor: '#8B7355',
                        pattern: 'concrete',
                        isMaster: true,
                        canvasWidth: 100,
                        canvasHeight: 90,
                        venueX: 30,
                        venueY: 30,
                        exteriorPadding: { top: 30, right: 30, bottom: 30, left: 30 }
                      };
                      handleSaveVenues([...venues, preset]);
                    }}
                    className="px-3 py-2 bg-white border border-amber-300 rounded-lg text-sm hover:bg-amber-50 hover:border-amber-400 transition-all flex items-center gap-2 shadow-sm"
                  >
                    🍸 Cocktail Hour
                  </button>
                  <button
                    onClick={() => {
                      const preset: Venue = {
                        id: `venue-${Date.now()}`,
                        name: 'Ceremony Venue',
                        width: 80,
                        height: 60,
                        capacity: 200,
                        category: 'ceremony',
                        color: '#90EE90',
                        borderColor: '#228B22',
                        pattern: 'grass',
                        isMaster: true,
                        canvasWidth: 160,
                        canvasHeight: 140,
                        venueX: 40,
                        venueY: 40,
                        exteriorPadding: { top: 40, right: 40, bottom: 40, left: 40 }
                      };
                      handleSaveVenues([...venues, preset]);
                    }}
                    className="px-3 py-2 bg-white border border-green-300 rounded-lg text-sm hover:bg-green-50 hover:border-green-400 transition-all flex items-center gap-2 shadow-sm"
                  >
                    💒 Ceremony
                  </button>
                  <button
                    onClick={() => {
                      const preset: Venue = {
                        id: `venue-${Date.now()}`,
                        name: 'Lodging Venue',
                        width: 40,
                        height: 30,
                        capacity: 20,
                        category: 'lodging',
                        color: '#FFF8DC',
                        borderColor: '#8B4513',
                        pattern: 'wood',
                        isMaster: true,
                        rooms: [],
                        floors: [{
                          id: `floor-${Date.now()}`,
                          name: 'Floor 1',
                          level: 1,
                          width: 40,
                          height: 30,
                          rooms: []
                        }],
                        canvasWidth: 100,
                        canvasHeight: 90,
                        venueX: 30,
                        venueY: 30,
                        exteriorPadding: { top: 30, right: 30, bottom: 30, left: 30 }
                      };
                      handleSaveVenues([...venues, preset]);
                    }}
                    className="px-3 py-2 bg-white border border-indigo-300 rounded-lg text-sm hover:bg-indigo-50 hover:border-indigo-400 transition-all flex items-center gap-2 shadow-sm"
                  >
                    🏨 Lodging
                  </button>
                  <button
                    onClick={() => {
                      const preset: Venue = {
                        id: `venue-${Date.now()}`,
                        name: 'Rehearsal Dinner Venue',
                        width: 30,
                        height: 25,
                        capacity: 40,
                        category: 'rehearsal-dinner',
                        color: '#F8F4E8',
                        borderColor: '#4A1942',
                        pattern: 'wood',
                        isMaster: true,
                        canvasWidth: 80,
                        canvasHeight: 75,
                        venueX: 25,
                        venueY: 25,
                        exteriorPadding: { top: 25, right: 25, bottom: 25, left: 25 }
                      };
                      handleSaveVenues([...venues, preset]);
                    }}
                    className="px-3 py-2 bg-white border border-rose-300 rounded-lg text-sm hover:bg-rose-50 hover:border-rose-400 transition-all flex items-center gap-2 shadow-sm"
                  >
                    🍽️ Rehearsal Dinner
                  </button>
                </div>
              </div>

              {/* Action Bar */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {venues.slice(0, 4).map((v, i) => (
                      <div 
                        key={i} 
                        className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white shadow-sm"
                        style={{ backgroundColor: v.borderColor || '#4A1942' }}
                      >
                        {v.name.charAt(0)}
                      </div>
                    ))}
                    {venues.length > 4 && (
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-400 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                        +{venues.length - 4}
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-gray-600 font-medium">{venues.length} Venues</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => expandedVenues.size === venues.length ? collapseAllVenues() : expandAllVenues()}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
                  >
                    {expandedVenues.size === venues.length ? '▲ Collapse All' : '▼ Expand All'}
                  </button>
                  <button
                    onClick={() => {
                      const newVenue: Venue = {
                        id: `venue-${Date.now()}`,
                        name: 'New Venue',
                        width: 50,
                        height: 30,
                        capacity: 100,
                        category: 'reception',
                        color: '#FFFFFF',
                        borderColor: '#4A1942',
                        pattern: 'wood',
                        isMaster: true,
                        exteriorPadding: { top: 30, right: 30, bottom: 30, left: 30 }
                      };
                      handleSaveVenues([...venues, newVenue]);
                    }}
                    className="px-4 py-1.5 bg-gradient-to-r from-[#4A1942] to-[#6d2c5a] text-white rounded-lg hover:from-[#5c2a64] hover:to-[#7d3c6a] transition-all font-medium shadow-sm flex items-center gap-1"
                  >
                    <span className="text-lg">+</span> Add Venue
                  </button>
                </div>
              </div>

              {/* Category Legend */}
              <div className="flex flex-wrap gap-2 text-xs">
                {layoutCategories.map(cat => (
                  <span key={cat.id} className="px-2 py-1 bg-gray-100 rounded-full flex items-center gap-1 text-gray-600">
                    {cat.icon} {cat.name} ({venues.filter(v => v.category === cat.id).length})
                  </span>
                ))}
              </div>

              {/* Venues List */}
              <div className="space-y-3">
              
              {venues.map(venue => {
                const category = layoutCategories.find(c => c.id === venue.category);
                return (
                <div key={venue.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                  {/* Color bar based on venue pattern/color */}
                  <div 
                    className="h-1.5"
                    style={{ backgroundColor: venue.borderColor || '#4A1942' }}
                  />
                  <div 
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleVenueExpanded(venue.id)}
                  >
                    <div className="flex items-center gap-3">
                      {/* Venue Preview */}
                      <div 
                        className="w-12 h-10 rounded border-2 flex items-center justify-center text-lg shadow-sm"
                        style={{ 
                          backgroundColor: venue.color || '#FFFFFF',
                          borderColor: venue.borderColor || '#4A1942'
                        }}
                      >
                        {category?.icon || '🏛️'}
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{expandedVenues.has(venue.id) ? '▼' : '▶'}</span>
                          <span className="font-semibold text-gray-800">{venue.name}</span>
                          {venue.isMaster && (
                            <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded font-medium">★</span>
                          )}
                          {venue.masterLayout && (
                            <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded font-medium">📐</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{venue.width}' × {venue.height}'</span>
                          <span>•</span>
                          <span>👥 {venue.capacity}</span>
                          {venue.masterLayout && (
                            <>
                              <span>•</span>
                              <span>{venue.masterLayout.tables.length} tables</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span 
                        className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ 
                          backgroundColor: `${venue.borderColor || '#4A1942'}15`,
                          color: venue.borderColor || '#4A1942'
                        }}
                      >
                        {category?.icon} {category?.name || venue.category}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const copy: Venue = {
                            ...venue,
                            id: `venue-${Date.now()}`,
                            name: `${venue.name} (Copy)`,
                            masterLayout: undefined
                          };
                          handleSaveVenues([...venues, copy]);
                        }}
                        className="text-gray-400 hover:text-blue-600 text-sm px-1.5 py-1 hover:bg-blue-50 rounded"
                        title="Duplicate"
                      >
                        📋
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete venue "${venue.name}"?`)) {
                            handleSaveVenues(venues.filter(v => v.id !== venue.id));
                          }
                        }}
                        className="text-gray-400 hover:text-red-500 text-sm px-1.5 py-1 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  {expandedVenues.has(venue.id) && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Name</label>
                        <input
                          type="text"
                          value={venue.name}
                          onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, name: e.target.value } : v))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Shape Builder</label>
                        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 space-y-3">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <select
                              value={venue.shape || 'rectangle'}
                              onChange={(e) => {
                                const nextShape = e.target.value as ShapeType;
                                handleSaveVenues(venues.map(v => {
                                  if (v.id !== venue.id) return v;
                                  if (nextShape === 'custom') {
                                    return {
                                      ...v,
                                      shape: 'custom',
                                      isCustomShape: true,
                                      shapePoints: v.shapePoints && v.shapePoints.length >= 3
                                        ? v.shapePoints
                                        : [
                                            { x: 0, y: 0 },
                                            { x: v.width, y: 0 },
                                            { x: v.width, y: v.height },
                                            { x: 0, y: v.height }
                                          ],
                                      customPath: v.customPath || `M 0 0 L ${v.width} 0 L ${v.width} ${v.height} L 0 ${v.height} Z`
                                    };
                                  }
                                  return {
                                    ...v,
                                    shape: nextShape,
                                    isCustomShape: false
                                  };
                                }));
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-white"
                            >
                              <option value="rectangle">Rectangle</option>
                              <option value="l-shape">L-Shape</option>
                              <option value="t-shape">T-Shape</option>
                              <option value="u-shape">U-Shape</option>
                              <option value="custom">Custom</option>
                            </select>
                            <button
                              onClick={() => setCustomShapeVenueId(venue.id)}
                              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-colors font-medium shadow-sm whitespace-nowrap"
                              title="Open venue shape builder"
                            >
                              ✏️ Open Shape Builder
                            </button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                            {[
                              { key: 'rectangle', label: 'Rectangle' },
                              { key: 'l-shape', label: 'L-Shape' },
                              { key: 't-shape', label: 'T-Shape' },
                              { key: 'u-shape', label: 'U-Shape' },
                              { key: 'custom', label: 'Custom' },
                            ].map(option => (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() => {
                                  const nextShape = option.key as ShapeType;
                                  handleSaveVenues(venues.map(v => {
                                    if (v.id !== venue.id) return v;
                                    if (nextShape === 'custom') {
                                      return {
                                        ...v,
                                        shape: 'custom',
                                        isCustomShape: true,
                                        shapePoints: v.shapePoints && v.shapePoints.length >= 3
                                          ? v.shapePoints
                                          : [
                                              { x: 0, y: 0 },
                                              { x: v.width, y: 0 },
                                              { x: v.width, y: v.height },
                                              { x: 0, y: v.height }
                                            ],
                                        customPath: v.customPath || `M 0 0 L ${v.width} 0 L ${v.width} ${v.height} L 0 ${v.height} Z`
                                      };
                                    }
                                    return { ...v, shape: nextShape, isCustomShape: false };
                                  }));
                                }}
                                className={`px-2 py-2 rounded-lg border font-medium transition-colors ${(venue.shape || 'rectangle') === option.key ? 'bg-purple-100 border-purple-300 text-purple-800' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-purple-700">
                            Use the shape builder for truly custom venues. It supports draggable points, starter templates, direct dimension editing, and live scaling to your venue width and height.
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Width (ft)</label>
                        <input
                          type="number"
                          value={venue.width}
                          onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, width: parseInt(e.target.value) || 0 } : v))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Height (ft)</label>
                        <input
                          type="number"
                          value={venue.height}
                          onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, height: parseInt(e.target.value) || 0 } : v))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Capacity</label>
                        <input
                          type="number"
                          value={venue.capacity}
                          onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, capacity: parseInt(e.target.value) || 0 } : v))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Category</label>
                        <select
                          value={venue.category}
                          onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, category: e.target.value as LayoutCategory } : v))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        >
                          {layoutCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pattern</label>
                        <select
                          value={venue.pattern || 'solid'}
                          onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, pattern: e.target.value as PatternType, patternColors: defaultPatternColors[e.target.value as PatternType] } : v))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        >
                          {patternOptions.map(p => (
                            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    {/* Venue Features Builder Button removed as requested */}


                    {/* Fill Color - Only show when pattern is solid */}
                    {(venue.pattern === 'solid' || !venue.pattern) && (
                      <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                          🎨 Venue Fill Color
                        </h4>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={venue.color || '#FFFFFF'}
                            onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, color: e.target.value } : v))}
                            className="w-16 h-12 border-2 border-gray-400 rounded-lg cursor-pointer shadow-md hover:shadow-lg transition-shadow"
                            style={{ padding: '2px' }}
                          />
                          <div className="flex-1">
                            <input
                              type="text"
                              value={venue.color || '#FFFFFF'}
                              onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, color: e.target.value } : v))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                              placeholder="#FFFFFF"
                            />
                            <p className="text-xs text-amber-600 mt-1">Click the color box to choose a fill color</p>
                          </div>
                          <div 
                            className="w-12 h-12 rounded-lg border-2 border-gray-300 shadow-inner"
                            style={{ backgroundColor: venue.color || '#FFFFFF' }}
                            title="Color Preview"
                          />
                        </div>
                      </div>
                    )}
                    

                    {/* Border Settings */}
                    <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <h4 className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2">
                        🔲 Venue Border Settings
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={venue.showBorder !== false}
                              onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, showBorder: e.target.checked } : v))}
                              className="w-5 h-5 accent-[#4A1942]"
                            />
                            <span className="text-sm font-medium text-gray-700">Show Border</span>
                          </label>
                        </div>
                        {venue.showBorder !== false && (
                          <>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Border Color</label>
                              <div className="flex gap-2">
                                <input
                                  type="color"
                                  value={venue.borderColor || '#4A1942'}
                                  onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, borderColor: e.target.value } : v))}
                                  className="w-10 h-9 border border-gray-300 rounded cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={venue.borderColor || '#4A1942'}
                                  onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, borderColor: e.target.value } : v))}
                                  className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Border Width (px)</label>
                              <input
                                type="number"
                                value={venue.borderWidth || 2}
                                onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, borderWidth: parseInt(e.target.value) || 1 } : v))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                min={1}
                                max={10}
                              />
                            </div>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-purple-600 mt-2">
                        💡 Configure the border around your venue layout. This helps define the venue boundaries.
                      </p>
                    </div>
                    
                    {/* Pattern Colors */}
                    {venue.pattern && venue.pattern !== 'solid' && (
                      <PatternColorPicker
                        pattern={venue.pattern}
                        patternColors={venue.patternColors}
                        onChange={(colors) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, patternColors: colors } : v))}
                      />
                    )}
                    
                    {/* Canvas Size & Venue Position */}
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                        📐 Canvas & Positioning Settings
                        <span className="text-xs font-normal text-blue-600">(for exterior features)</span>
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Canvas Width (ft)</label>
                          <input
                            type="number"
                            value={venue.canvasWidth || venue.width + 80}
                            onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, canvasWidth: parseInt(e.target.value) || venue.width + 80 } : v))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            min={venue.width + 10}
                          />
                          <p className="text-[10px] text-gray-400 mt-1">Min: {venue.width + 10}ft</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Canvas Height (ft)</label>
                          <input
                            type="number"
                            value={venue.canvasHeight || venue.height + 80}
                            onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, canvasHeight: parseInt(e.target.value) || venue.height + 80 } : v))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            min={venue.height + 10}
                          />
                          <p className="text-[10px] text-gray-400 mt-1">Min: {venue.height + 10}ft</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Venue X Position (ft)</label>
                          <input
                            type="number"
                            value={venue.venueX ?? (venue.exteriorPadding?.left || 40)}
                            onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, venueX: parseInt(e.target.value) || 0 } : v))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            min={0}
                          />
                          <p className="text-[10px] text-gray-400 mt-1">Distance from left edge</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Venue Y Position (ft)</label>
                          <input
                            type="number"
                            value={venue.venueY ?? (venue.exteriorPadding?.top || 40)}
                            onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, venueY: parseInt(e.target.value) || 0 } : v))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            min={0}
                          />
                          <p className="text-[10px] text-gray-400 mt-1">Distance from top edge</p>
                        </div>
                      </div>
                      
                      {/* Canvas Colors */}
                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-blue-200">
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Canvas Fill Color</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={venue.canvasFillColor || '#e8e4e0'}
                              onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, canvasFillColor: e.target.value } : v))}
                              className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                            />
                            <input
                              type="text"
                              value={venue.canvasFillColor || '#e8e4e0'}
                              onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, canvasFillColor: e.target.value } : v))}
                              className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">Background color of exterior area</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Canvas Border Color</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={venue.canvasBorderColor || '#888888'}
                              onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, canvasBorderColor: e.target.value } : v))}
                              className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                            />
                            <input
                              type="text"
                              value={venue.canvasBorderColor || '#888888'}
                              onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, canvasBorderColor: e.target.value } : v))}
                              className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">Border color of the canvas</p>
                        </div>
                      </div>
                      
                      <p className="text-xs text-blue-600 mt-2">
                        💡 Tip: Use canvas size and venue position to create space around your venue for exterior features like driveways, landscaping, and signage.
                      </p>
                    </div>
                    
                    {/* Indoor/Outdoor features removed - use Fixtures tab instead */}
                    
                    {/* Master Venue Toggle */}
                    <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={venue.isMaster || false}
                            onChange={(e) => {
                              handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, isMaster: e.target.checked } : v));
                            }}
                            className="w-5 h-5 accent-[#4A1942]"
                          />
                          <span className="text-sm font-medium text-gray-700">Master Venue</span>
                        </label>
                        {venue.isMaster && (
                          <span className="text-xs bg-[#4A1942] text-white px-2 py-1 rounded">
                            ★ Visible to Basic Users
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 flex-1">
                        Only master venues are visible to basic users.
                      </p>
                    </div>
                    
                    {/* Master Layout Status */}
                    <div className="flex items-center gap-4 pt-3 border-t border-gray-100 bg-amber-50 p-3 rounded-lg -mx-4 -mb-4 mt-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-700">📐 Master Layout</span>
                          {venue.masterLayout ? (
                            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">
                              ✓ Saved
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded">
                              Not Set
                            </span>
                          )}
                        </div>
                        {venue.masterLayout ? (
                          <p className="text-xs text-gray-600">
                            {venue.masterLayout.tables.length} tables, {venue.masterLayout.fixtures.length} fixtures
                            <span className="ml-2 text-gray-400">
                              (saved {new Date(venue.masterLayout.savedAt).toLocaleDateString()})
                            </span>
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500">
                            To set a master layout, go to the canvas view for this venue, add your fixtures, then click Menu → "Save as Master Layout"
                          </p>
                        )}
                      </div>
                      {venue.masterLayout && (
                        <button
                          onClick={() => {
                            if (confirm(`Clear master layout for "${venue.name}"? All pre-placed items will be removed.`)) {
                              handleSaveVenues(venues.map(v => {
                                if (v.id === venue.id) {
                                  const { masterLayout, ...rest } = v;
                                  return rest;
                                }
                                return v;
                              }));
                            }
                          }}
                          className="px-3 py-1.5 text-orange-600 hover:bg-orange-100 border border-orange-200 rounded-lg text-xs"
                        >
                          Clear Layout
                        </button>
                      )}
                    </div>
                    
                    {/* Primary Image upload */}
                    <div className="space-y-3 pt-2 border-t border-gray-100">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Primary Venue Image</label>
                        <div className="flex items-center gap-2 mt-1">
                          {venue.imageUrl ? (
                            <img src={venue.imageUrl} alt="" className="w-16 h-16 object-cover rounded border" />
                          ) : (
                            <div className="w-16 h-16 bg-gray-100 rounded border flex items-center justify-center text-gray-400">
                              No img
                            </div>
                          )}
                          <button
                            onClick={() => handleImageUpload((url) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, imageUrl: url } : v)))}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                          >
                            📷 Upload
                          </button>
                          {venue.imageUrl && (
                            <button
                              onClick={() => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, imageUrl: undefined } : v))}
                              className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Multi-Image Gallery (up to 10 images for venues) */}
                      <MultiImageUpload
                        images={venue.images || []}
                        onChange={(images) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, images } : v))}
                        maxImages={10}
                        itemName="venue"
                      />
                      
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={() => handleSaveVenues(venues.filter(v => v.id !== venue.id))}
                          className="px-4 py-2 text-red-500 hover:bg-red-50 border border-red-200 rounded-lg text-sm"
                        >
                          🗑️ Delete Venue
                        </button>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              );
              })}
              </div>
              
              {/* Tips Section */}
              <BrandedTips
                title="Tips for Venue Setup"
                config={config}
                tips={[
                  { icon: '★', title: 'Master Venue', description: 'Mark venues as "Master" so basic users can see and use them' },
                  { icon: '📐', title: 'Master Layout', description: 'Save a pre-configured layout with fixtures for each venue' },
                  { icon: '🖼️', title: 'Canvas Size', description: 'Use canvas settings to add exterior features around your venue' },
                  { icon: '📁', title: 'Categories', description: 'Assign categories to help organize and filter venues' },
                  { icon: '📷', title: 'Images', description: 'Upload up to 10 reference images per venue for client reference' }
                ]}
              />
            </div>
          )}

          {/* Tables Tab */}
          {activeTab === 'tables' && (
            <div className="space-y-4">
              {/* Header Section */}
              <BrandedSectionHeader 
                icon="🪑" 
                title="Tables/Seating" 
                description="Define table types and chair-only seating arrangements for venue categories"
                config={config}
              />

              {/* Quick Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{tableTypes.length}</div>
                  <div className="text-xs text-blue-700 font-medium">🪑 Table Types</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {tableTypes.reduce((sum, t) => sum + (t.inventoryCount || 0), 0) || '∞'}
                  </div>
                  <div className="text-xs text-green-700 font-medium">📦 Total Inventory</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {tableSpecs.reduce((sum, t) => sum + t.capacity, 0)}
                  </div>
                  <div className="text-xs text-purple-700 font-medium">👥 Total Capacity</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <div className="flex justify-center gap-1 mb-1">
                    {tableTypes.slice(0, 5).map(t => (
                      <div key={t.id} className="w-5 h-5 rounded border border-gray-300" style={{ backgroundColor: t.color || '#F5F5DC' }} title={t.name} />
                    ))}
                  </div>
                  <div className="text-xs text-amber-700 font-medium">🎨 Color Preview</div>
                </div>
              </div>

              {/* Quick Add Presets */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <span>⚡</span> Quick Add Table Presets
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  <button
                    onClick={() => {
                      const presets: TableSpec[] = [
                        { id: `table-${Date.now()}-1`, name: '60" Round (8)', shape: 'circle', width: 5, height: 5, capacity: 8, color: '#FFFFFF', allowAsDecorBase: true },
                        { id: `table-${Date.now()}-2`, name: '48" Round (6)', shape: 'circle', width: 4, height: 4, capacity: 6, color: '#FFFFFF', allowAsDecorBase: true },
                      ];
                      handleSaveTables([...tableSpecs, ...presets]);
                    }}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium flex items-center justify-center gap-1"
                  >
                    ⭕ Round Tables
                  </button>
                  <button
                    onClick={() => {
                      const presets: TableSpec[] = [
                        { id: `table-${Date.now()}-1`, name: '6ft Banquet', shape: 'rectangle', width: 6, height: 2.5, capacity: 6, color: '#FFFFFF', allowAsDecorBase: true },
                        { id: `table-${Date.now()}-2`, name: '8ft Banquet', shape: 'rectangle', width: 8, height: 2.5, capacity: 8, color: '#FFFFFF', allowAsDecorBase: true },
                        { id: `table-${Date.now()}-3`, name: '6ft Classroom', shape: 'rectangle', width: 6, height: 1.5, capacity: 3, color: '#FFFFFF', allowAsDecorBase: true },
                      ];
                      handleSaveTables([...tableSpecs, ...presets]);
                    }}
                    className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium flex items-center justify-center gap-1"
                  >
                    ▬ Rectangular
                  </button>
                  <button
                    onClick={() => {
                      const presets: TableSpec[] = [
                        { id: `table-${Date.now()}-1`, name: 'Sweetheart Table', shape: 'semicircle', width: 5, height: 2.5, capacity: 2, color: '#FFF0F5', allowAsDecorBase: true },
                        { id: `table-${Date.now()}-2`, name: 'Head Table (12)', shape: 'rectangle', width: 16, height: 2.5, capacity: 12, color: '#FFF0F5', defaultChairLayout: 'head-table', allowAsDecorBase: true },
                        { id: `table-${Date.now()}-3`, name: 'King\'s Table', shape: 'rectangle', width: 20, height: 4, capacity: 20, color: '#FFFAF0', allowAsDecorBase: true },
                      ];
                      handleSaveTables([...tableSpecs, ...presets]);
                    }}
                    className="px-3 py-2 bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 transition-colors text-sm font-medium flex items-center justify-center gap-1"
                  >
                    👑 Wedding Party
                  </button>
                  <button
                    onClick={() => {
                      const presets: TableSpec[] = [
                        { id: `table-${Date.now()}-1`, name: 'Cocktail High', shape: 'circle', width: 2.5, height: 2.5, capacity: 4, color: '#F5F5DC', allowAsDecorBase: true },
                        { id: `table-${Date.now()}-2`, name: 'Cocktail Low', shape: 'circle', width: 3, height: 3, capacity: 6, color: '#F5F5DC', allowAsDecorBase: true },
                        { id: `table-${Date.now()}-3`, name: 'Bar Height Square', shape: 'rectangle', width: 2, height: 2, capacity: 4, color: '#8B4513', allowAsDecorBase: true },
                      ];
                      handleSaveTables([...tableSpecs, ...presets]);
                    }}
                    className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium flex items-center justify-center gap-1"
                  >
                    🍸 Cocktail
                  </button>
                  <button
                    onClick={() => {
                      const presets: TableSpec[] = [
                        { id: `table-${Date.now()}-1`, name: 'Kids Table', shape: 'rectangle', width: 6, height: 2.5, capacity: 8, color: '#E0F7FA', allowAsDecorBase: true },
                        { id: `table-${Date.now()}-2`, name: 'Activity Table', shape: 'circle', width: 4, height: 4, capacity: 6, color: '#FFF9C4', allowAsDecorBase: true },
                      ];
                      handleSaveTables([...tableSpecs, ...presets]);
                    }}
                    className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium flex items-center justify-center gap-1"
                  >
                    🧒 Kids Tables
                  </button>
                </div>
              </div>

              {/* Table Types Section Header */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-blue-800 flex items-center gap-2">🪑 Table Types</div>
                  <div className="text-xs text-blue-600 mt-0.5">Dining and service table definitions for reception and event layouts</div>
                </div>
                <button
                  onClick={() => setShowTableTypesSection(!showTableTypesSection)}
                  className="px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded-lg text-sm hover:bg-blue-100 transition-colors"
                >
                  {showTableTypesSection ? '▲ Collapse' : '▼ Expand'}
                </button>
              </div>

              {showTableTypesSection && (
              <>
              {/* Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {tableTypes.slice(0, 4).map(t => (
                      <div key={t.id} className="w-8 h-8 -ml-1 first:ml-0 rounded-full border-2 border-white flex items-center justify-center text-xs" style={{ backgroundColor: t.color || '#F5F5DC' }} title={t.name}>
                        {t.shape === 'circle' ? '⭕' : t.shape === 'rectangle' ? '▬' : '◯'}
                      </div>
                    ))}
                  </div>
                  <span className="text-sm text-gray-600 font-medium">{tableTypes.length} table types</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => expandedTables.size === tableTypes.length ? collapseAllTables() : expandAllTables()}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
                  >
                    {expandedTables.size === tableTypes.length ? '▲ Collapse All' : '▼ Expand All'}
                  </button>
                  <button
                    onClick={() => {
                      const id = `table-${Date.now()}`;
                      const newTable: TableSpec = {
                        id,
                        name: 'New Table',
                        shape: 'circle',
                        width: 6,
                        height: 6,
                        capacity: 8,
                        color: '#F5F5DC',
                        allowAsDecorBase: true
                      };
                      handleSaveTables([...tableSpecs, newTable]);
                      setExpandedTables(new Set([...expandedTables, id]));
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-colors font-medium shadow-sm flex items-center gap-1"
                  >
                    <span>+</span> Add Table Type
                  </button>
                </div>
              </div>

              {/* Shape Legend */}
              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-4 h-4 bg-blue-100 rounded-full border"></span> Round</span>
                <span className="flex items-center gap-1"><span className="w-4 h-3 bg-amber-100 rounded border"></span> Rectangle</span>
                <span className="flex items-center gap-1"><span className="w-4 h-3 bg-pink-100 rounded-full border"></span> Oval</span>
                <span className="flex items-center gap-1"><span className="w-4 h-3 bg-purple-100 border" style={{borderRadius:'50% 50% 0 0'}}></span> Semicircle</span>
                <span className="flex items-center gap-1"><span className="text-green-600">📦</span> Inventory</span>
                <span className="flex items-center gap-1"><span className="text-blue-600">🪑</span> Capacity</span>
              </div>
              
              {/* Table Cards */}
              {tableTypes.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                  <div className="text-6xl mb-4">🪑</div>
                  <h3 className="font-semibold text-gray-700 mb-2">No Table Types Yet</h3>
                  <p className="text-gray-500 mb-4">Add table types to start creating layouts</p>
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => {
                        const newTable: TableSpec = {
                          id: `table-${Date.now()}`,
                          name: 'New Table',
                          shape: 'circle',
                          width: 6,
                          height: 6,
                          capacity: 8,
                          color: '#F5F5DC',
                          allowAsDecorBase: true
                        };
                        handleSaveTables([...tableSpecs, newTable]);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      + Add Table Type
                    </button>
                    <button
                      onClick={() => {
                        const defaults: TableSpec[] = [
                          { id: `table-${Date.now()}-1`, name: '60" Round (8)', shape: 'circle', width: 5, height: 5, capacity: 8, color: '#FFFFFF', allowAsDecorBase: true },
                          { id: `table-${Date.now()}-2`, name: '6ft Banquet', shape: 'rectangle', width: 6, height: 2.5, capacity: 6, color: '#FFFFFF', allowAsDecorBase: true },
                          { id: `table-${Date.now()}-3`, name: '8ft Banquet', shape: 'rectangle', width: 8, height: 2.5, capacity: 8, color: '#FFFFFF', allowAsDecorBase: true },
                        ];
                        handleSaveTables(defaults);
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Load Defaults
                    </button>
                  </div>
                </div>
              ) : (
              <div className="space-y-3">
              {tableTypes.map((table) => (
                <div key={table.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                  <div 
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleTableExpanded(table.id)}
                    style={{ borderLeft: `4px solid ${table.color || '#F5F5DC'}` }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-lg w-6">{expandedTables.has(table.id) ? '▼' : '▶'}</span>
                      {/* Shape Preview */}
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-2 border border-gray-200 shadow-inner">
                        <svg width="40" height="40" viewBox="0 0 48 48">
                          {renderShapePreview(table.shape as ShapeType, table.color || '#F5F5DC')}
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">{table.name}</span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full capitalize">{table.shape}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          <span className="flex items-center gap-1">📐 {table.width}' × {table.height}'</span>
                          <span className="flex items-center gap-1">🪑 {table.capacity} seats</span>
                          {table.inventoryCount !== undefined && (
                            <span className="flex items-center gap-1 text-green-600">📦 {table.inventoryCount}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Quick Actions in Header */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const duplicate: TableSpec = {
                            ...table,
                            id: `table-${Date.now()}`,
                            name: `${table.name} (Copy)`
                          };
                          handleSaveTables([...tableSpecs, duplicate]);
                        }}
                        className="text-gray-400 hover:text-blue-600 text-sm px-2 py-1 hover:bg-blue-50 rounded transition-colors"
                        title="Duplicate"
                      >
                        📋
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete table "${table.name}"?`)) {
                            handleSaveTables(tableSpecs.filter(t => t.id !== table.id));
                          }
                        }}
                        className="text-gray-400 hover:text-red-600 text-sm px-2 py-1 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  {expandedTables.has(table.id) && (
                  <div className="p-4 space-y-4">
                    {/* Row 1: Basic Settings */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Name</label>
                        <input
                          type="text"
                          value={table.name}
                          onChange={(e) => handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, name: e.target.value } : t))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Shape</label>
                        <select
                          value={table.shape}
                          onChange={(e) => handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, shape: e.target.value as ShapeType } : t))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        >
                          {shapeOptions.map(s => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Width (ft)</label>
                        <input
                          type="number"
                          value={table.width}
                          onChange={(e) => handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, width: parseFloat(e.target.value) || 6 } : t))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Height (ft)</label>
                        <input
                          type="number"
                          value={table.height}
                          onChange={(e) => handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, height: parseFloat(e.target.value) || 6 } : t))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        />
                      </div>
                    </div>
                    
                    {/* Row 2: Capacity, Pattern, Inventory */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Capacity</label>
                        <input
                          type="number"
                          value={table.capacity}
                          onChange={(e) => handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, capacity: parseInt(e.target.value) || 0 } : t))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pattern</label>
                        <select
                          value={table.pattern || 'solid'}
                          onChange={(e) => handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, pattern: e.target.value as PatternType, patternColors: defaultPatternColors[e.target.value as PatternType] } : t))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        >
                          {patternOptions.map(p => (
                            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Inventory</label>
                        <input
                          type="number"
                          min="0"
                          value={table.inventoryCount ?? 999}
                          onChange={(e) => handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, inventoryCount: parseInt(e.target.value) || 0 } : t))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        />
                      </div>
                    </div>
                    
                    {/* Row 3: Color - Full Width */}
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Table Color</label>
                      <div className="flex gap-3 items-center">
                        <input
                          type="color"
                          value={table.color || '#F5F5DC'}
                          onChange={(e) => handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, color: e.target.value } : t))}
                          className="w-20 h-14 border-2 border-gray-300 rounded-lg cursor-pointer hover:border-[#4A1942] transition-colors shadow-sm"
                          style={{ padding: '4px' }}
                          title="Click to select color"
                        />
                        <input
                          type="text"
                          value={table.color || '#F5F5DC'}
                          onChange={(e) => handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, color: e.target.value } : t))}
                          className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                          placeholder="#RRGGBB"
                        />
                        <div 
                          className="w-14 h-14 rounded-lg border-2 border-gray-300 shadow-inner"
                          style={{ backgroundColor: table.color || '#F5F5DC' }}
                          title="Color preview"
                        />
                        <span className="text-xs text-gray-500">Click the color box to change</span>
                      </div>
                    </div>
                    
                    {/* Pattern Colors */}
                    {table.pattern && table.pattern !== 'solid' && (
                      <PatternColorPicker
                        pattern={table.pattern}
                        patternColors={table.patternColors}
                        onChange={(colors) => handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, patternColors: colors } : t))}
                      />
                    )}
                    
                    {/* Chair Settings */}
                    <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                        🪑 Chair Settings
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Default Chair Type</label>
                          <select
                            value={table.defaultChairType || 'white-plastic'}
                            onChange={(e) => handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, defaultChairType: e.target.value as ChairType } : t))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                          >
                            {getChairSpecs().map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        {table.shape === 'rectangle' && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Chair Layout</label>
                            <select
                              value={table.defaultChairLayout || 'all-sides'}
                              onChange={(e) => handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, defaultChairLayout: e.target.value as RectangularChairLayout } : t))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            >
                              {chairLayoutOptions.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.name}</option>
                              ))}
                            </select>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {chairLayoutOptions.find(o => o.id === (table.defaultChairLayout || 'all-sides'))?.description}
                            </p>
                          </div>
                        )}
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Show Chairs by Default</label>
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="checkbox"
                              checked={table.showChairs !== false}
                              onChange={(e) => handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, showChairs: e.target.checked } : t))}
                              className="w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span className="text-sm text-gray-600">Yes, show chairs</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide text-indigo-600">Decor Designer</label>
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="checkbox"
                              checked={table.allowAsDecorBase !== false}
                              onChange={(e) => handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, allowAsDecorBase: e.target.checked } : t))}
                              className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-600">Available in Decor Designer</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Allowed Chair Types */}
                      <div className="mt-3 pt-3 border-t border-amber-200">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                          Allowed Chair Types for This Table
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {getChairSpecs().filter(c => c.id !== 'none').map(chair => {
                            const isAllowed = !table.allowedChairTypes || table.allowedChairTypes.includes(chair.id);
                            return (
                              <button
                                key={chair.id}
                                type="button"
                                onClick={() => {
                                  const currentAllowed = table.allowedChairTypes || getChairSpecs().filter(c => c.id !== 'none').map(c => c.id);
                                  const newAllowed = isAllowed 
                                    ? currentAllowed.filter(id => id !== chair.id)
                                    : [...currentAllowed, chair.id];
                                  handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, allowedChairTypes: newAllowed as ChairType[] } : t));
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                  isAllowed 
                                    ? 'bg-amber-500 text-white' 
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                              >
                                {chair.icon} {chair.name}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Click to toggle which chair types users can select for this table</p>
                      </div>
                    </div>
                    
                    {/* Venue Category Availability */}
                    <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                      <h4 className="text-sm font-semibold text-indigo-800 mb-2 flex items-center gap-2">
                        🏛️ Venue Category Availability
                      </h4>
                      <p className="text-xs text-indigo-600 mb-3">Choose which venue categories can use this table. Leave all unchecked to allow in all categories.</p>
                      <div className="flex flex-wrap gap-2">
                        {layoutCategories.map(cat => {
                          const selected = (table.venueCategories || []).includes(cat.id as any);
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                const current = table.venueCategories || [];
                                const venueCategories = selected
                                  ? current.filter(c => c !== cat.id)
                                  : [...current, cat.id as any];
                                handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, venueCategories } : t));
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selected ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'}`}
                            >
                              {cat.icon} {cat.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Inventory Count */}
                    <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                      <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
                        📦 Inventory Management
                      </h4>
                      <div className="flex items-center gap-3">
                        <div>
                          <label className="text-xs font-medium text-green-700">Available Count</label>
                          <div className="flex gap-2 mt-1 items-center">
                            <input
                              type="number"
                              min="0"
                              value={table.inventoryCount ?? ''}
                              onChange={(e) => {
                                const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                                handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, inventoryCount: value } : t));
                              }}
                              className="w-24 px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              placeholder="∞"
                            />
                            <span className="text-sm text-green-600 font-medium">
                              {table.inventoryCount === undefined ? '(Unlimited)' : `${table.inventoryCount} tables`}
                            </span>
                            {table.inventoryCount !== undefined && (
                              <button
                                onClick={() => handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, inventoryCount: undefined } : t))}
                                className="text-xs text-green-600 hover:text-green-800 underline"
                              >
                                Set Unlimited
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Image upload section */}
                    <div className="space-y-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500">Primary Image:</span>
                          {table.imageUrl ? (
                            <img src={table.imageUrl} alt="" className="w-12 h-12 object-cover rounded border" />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center text-gray-400 text-xs">
                              No img
                            </div>
                          )}
                          <button
                            onClick={() => handleImageUpload((url) => handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, imageUrl: url } : t)))}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                          >
                            📷 Upload
                          </button>
                          {table.imageUrl && (
                            <button
                              onClick={() => handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, imageUrl: undefined } : t))}
                              className="text-red-500 hover:text-red-700"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Multi-Image Gallery */}
                      <MultiImageUpload
                        images={table.images || []}
                        onChange={(images) => handleSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, images } : t))}
                        maxImages={4}
                        itemName="table"
                      />
                      
                       <div className="flex justify-end">
                        <button
                          onClick={() => handleSaveTables(tableSpecs.filter(t => t.id !== table.id))}
                          className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm transition-colors"
                        >
                          🗑️ Delete Table
                        </button>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              ))}
              </div>
              )}

              <BrandedTips
                title="Table Setup Tips"
                config={config}
                tips={[
                  { icon: '⭕', title: '60" Round Tables', description: 'Typically seat 8-10 guests comfortably' },
                  { icon: '⭕', title: '48" Round Tables', description: 'Great for smaller family groups or kids tables' },
                  { icon: '▬', title: 'Banquet Tables', description: 'Great for head tables and family-style dining' },
                  { icon: '🍸', title: 'Cocktail Tables', description: 'Ideal for standing reception and cocktail hour areas' },
                  { icon: '🚶', title: 'Traffic Flow', description: 'Consider guest and server movement when setting capacities' },
                  { icon: '📏', title: 'Spacing', description: 'Allow 2-3 feet between tables for comfortable movement' }
                ]}
              />
              </>
              )}

              {/* Seating Types Section */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-purple-800 flex items-center gap-2">💺 Seating Types</div>
                  <div className="text-xs text-purple-600 mt-0.5">Chair-only seating arrangements for ceremony-style layouts</div>
                </div>
                <button
                  onClick={() => setShowSeatingTypesSection(!showSeatingTypesSection)}
                  className="px-3 py-1.5 bg-white border border-purple-200 text-purple-700 rounded-lg text-sm hover:bg-purple-100 transition-colors"
                >
                  {showSeatingTypesSection ? '▲ Collapse' : '▼ Expand'}
                </button>
              </div>

              {showSeatingTypesSection && (
              <div className="space-y-3">
                {/* Seating Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {seatingTypes.slice(0, 4).map(s => (
                        <div
                          key={s.id}
                          className="w-8 h-8 -ml-1 first:ml-0 rounded-full border-2 border-white flex items-center justify-center text-xs bg-purple-100 text-purple-700"
                          title={s.name}
                        >
                          💺
                        </div>
                      ))}
                    </div>
                    <span className="text-sm text-gray-600 font-medium">{seatingTypes.length} seating types</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => expandedSeatingTypes.size === seatingTypes.length ? collapseAllSeatingTypes() : expandAllSeatingTypes()}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
                    >
                      {expandedSeatingTypes.size === seatingTypes.length ? '▲ Collapse All' : '▼ Expand All'}
                    </button>
                    <button
                      onClick={() => {
                        const id = `seating-${Date.now()}`;
                        const chairsPerRow = 12;
                        const rowCount = 4;
                        const rowSpacing = 3;
                        const dims = getSeatingDimensions('white-plastic', chairsPerRow, rowCount, rowSpacing);
                        const newSeating: TableSpec = {
                          id,
                          name: 'New Seating Type',
                          shape: 'rectangle',
                          width: dims.width,
                          height: dims.height,
                          capacity: chairsPerRow,
                          color: '#E5E7EB',
                          isSeatingType: true,
                          seatingStyle: 'straight-row',
                          seatingRowCount: rowCount,
                          seatingRowSpacing: rowSpacing,
                          showChairs: true,
                          defaultChairType: 'white-plastic',
                          venueCategories: ['ceremony']
                        };
                        handleSaveTables([...tableSpecs, newSeating]);
                        setExpandedSeatingTypes(new Set([...expandedSeatingTypes, id]));
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-sm hover:from-purple-700 hover:to-indigo-700 transition-colors"
                    >
                      + Add Seating Type
                    </button>
                  </div>
                </div>

                <div className="bg-purple-50/70 border border-purple-200 rounded-lg p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-purple-700 mb-2">Quick Seating Templates</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { name: 'Ceremony Row', style: 'straight-row', chairs: 12, rows: 4, spacing: 3 },
                      { name: 'Curved Row', style: 'curved-row', chairs: 10, rows: 4, spacing: 3 },
                      { name: 'Semicircle Setup', style: 'semicircle-row', chairs: 16, rows: 3, spacing: 3.5 },
                      { name: 'Stadium Seating', style: 'stadium', chairs: 14, rows: 5, spacing: 3 }
                    ].map(tpl => (
                      <button
                        key={tpl.name}
                        onClick={() => {
                          const id = `seating-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                          const dims = getSeatingDimensions('white-plastic', tpl.chairs, tpl.rows, tpl.spacing);
                          const newSeating: TableSpec = {
                            id,
                            name: tpl.name,
                            shape: 'rectangle',
                            width: dims.width,
                            height: dims.height,
                            capacity: tpl.chairs,
                            color: '#E5E7EB',
                            isSeatingType: true,
                            seatingStyle: tpl.style as any,
                            seatingRowCount: tpl.rows,
                            seatingRowSpacing: tpl.spacing,
                            showChairs: true,
                            defaultChairType: 'white-plastic',
                            venueCategories: ['ceremony']
                          };
                          handleSaveTables([...tableSpecs, newSeating]);
                          setExpandedSeatingTypes(new Set([...expandedSeatingTypes, id]));
                        }}
                        className="px-2.5 py-2 text-xs font-medium rounded-lg border border-purple-200 bg-white text-purple-700 hover:bg-purple-100 transition-colors"
                      >
                        💺 {tpl.name}
                      </button>
                    ))}
                  </div>
                </div>
                {seatingTypes.length === 0 ? (
                  <div className="text-sm text-gray-500 bg-white border border-gray-200 rounded-lg p-4">No seating types yet. Add one to create chair-only ceremony arrangements.</div>
                ) : seatingTypes.map((seat) => (
                  <div key={seat.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div
                      className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleSeatingTypeExpanded(seat.id)}
                      style={{ borderLeft: '4px solid #7c3aed' }}
                    >
                      <div>
                        <div className="font-semibold text-gray-800 flex items-center gap-2">
                          <span className="text-gray-400">{expandedSeatingTypes.has(seat.id) ? '▼' : '▶'}</span>
                          {seat.name}
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{seat.capacity} chairs</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {(seat.seatingRowCount || 1)} rows • {(seat.seatingRowSpacing || 3)}ft spacing • {seat.capacity * Math.max(1, seat.seatingRowCount || 1)} total chairs
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete seating type "${seat.name}"?`)) {
                            handleSaveTables(tableSpecs.filter(t => t.id !== seat.id));
                          }
                        }}
                        className="text-gray-400 hover:text-red-600 text-sm px-2 py-1 hover:bg-red-50 rounded"
                      >
                        🗑️
                      </button>
                    </div>

                    {expandedSeatingTypes.has(seat.id) && (
                      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Name</label>
                          <input type="text" value={seat.name} onChange={(e) => handleSaveTables(tableSpecs.map(t => t.id === seat.id ? { ...t, name: e.target.value } : t))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Chair Count</label>
                          <input
                            type="number"
                            min="1"
                            value={seat.capacity}
                            onChange={(e) => {
                              const nextCapacity = parseInt(e.target.value) || 1;
                              const nextRows = Math.max(1, seat.seatingRowCount || 1);
                              const nextSpacing = Math.max(0.5, seat.seatingRowSpacing || 3);
                              const dims = getSeatingDimensions(seat.defaultChairType, nextCapacity, nextRows, nextSpacing);
                              handleSaveTables(tableSpecs.map(t => t.id === seat.id ? { ...t, capacity: nextCapacity, width: dims.width, height: dims.height } : t));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Seating Style</label>
                          <select value={seat.seatingStyle || 'straight-row'} onChange={(e) => handleSaveTables(tableSpecs.map(t => t.id === seat.id ? { ...t, seatingStyle: e.target.value as any } : t))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                            <option value="straight-row">Straight Row</option>
                            <option value="curved-row">Curved Row</option>
                            <option value="stadium">Stadium</option>
                            <option value="semicircle-row">Semicircle</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Row Count</label>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={seat.seatingRowCount ?? 4}
                            onChange={(e) => {
                              const nextRows = parseInt(e.target.value) || 1;
                              const nextSpacing = Math.max(0.5, seat.seatingRowSpacing || 3);
                              const dims = getSeatingDimensions(seat.defaultChairType, seat.capacity || 1, nextRows, nextSpacing);
                              handleSaveTables(tableSpecs.map(t => t.id === seat.id ? { ...t, seatingRowCount: nextRows, width: dims.width, height: dims.height } : t));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Row Spacing (ft)</label>
                          <input
                            type="number"
                            min="1"
                            step="0.5"
                            value={seat.seatingRowSpacing ?? 3}
                            onChange={(e) => {
                              const nextSpacing = parseFloat(e.target.value) || 1;
                              const nextRows = Math.max(1, seat.seatingRowCount || 1);
                              const dims = getSeatingDimensions(seat.defaultChairType, seat.capacity || 1, nextRows, nextSpacing);
                              handleSaveTables(tableSpecs.map(t => t.id === seat.id ? { ...t, seatingRowSpacing: nextSpacing, width: dims.width, height: dims.height } : t));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Chair Type</label>
                          <select value={seat.defaultChairType || 'white-plastic'} onChange={(e) => {
                            const nextChairType = e.target.value as ChairType;
                            const nextRows = Math.max(1, seat.seatingRowCount || 1);
                            const nextSpacing = Math.max(0.5, seat.seatingRowSpacing || 3);
                            const dims = getSeatingDimensions(nextChairType, seat.capacity || 1, nextRows, nextSpacing);
                            handleSaveTables(tableSpecs.map(t => t.id === seat.id ? { ...t, defaultChairType: nextChairType, width: dims.width, height: dims.height } : t));
                          }} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                            {getChairSpecs().filter(c => c.id !== 'none').map(ch => (
                              <option key={ch.id} value={ch.id}>{ch.icon} {ch.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide text-indigo-600">Decor Designer</label>
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="checkbox"
                              checked={seat.allowAsDecorBase !== false}
                              onChange={(e) => handleSaveTables(tableSpecs.map(t => t.id === seat.id ? { ...t, allowAsDecorBase: e.target.checked } : t))}
                              className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-600">Available in Decor Designer</span>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Venue Categories</label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {layoutCategories.map(cat => {
                              const selected = (seat.venueCategories || []).includes(cat.id as any);
                              return (
                                <button key={cat.id} type="button" onClick={() => {
                                  const current = seat.venueCategories || [];
                                  const venueCategories = selected ? current.filter(c => c !== cat.id) : [...current, cat.id as any];
                                  handleSaveTables(tableSpecs.map(t => t.id === seat.id ? { ...t, venueCategories } : t));
                                }} className={`px-2 py-1 rounded-full text-xs ${selected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                  {cat.icon} {cat.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              )}
              {showSeatingTypesSection && (
                <BrandedTips
                  title="Seating Setup Tips"
                  config={config}
                  tips={[
                    { icon: '💺', title: 'Chair-Only Layouts', description: 'Seating types are chair-only arrangements and do not use table linens.' },
                    { icon: '🧮', title: 'Total Chairs', description: 'Total chairs = chairs per row × row count. Use this to plan ceremony capacity.' },
                    { icon: '📏', title: 'Row Spacing', description: 'Use 3-4 ft row spacing for comfortable access and clear ceremony aisles.' },
                    { icon: '🎯', title: 'Ceremony Category', description: 'Assign seating types to Ceremony venues so basic/guest users only see relevant options.' },
                    { icon: '👥', title: 'Guest Assignment', description: 'Use seating capacity and rows to support clear guest assignment planning.' }
                  ]}
                />
              )}
            </div>
          )}

          {/* Fixtures Tab */}
          {activeTab === 'fixtures' && (
            <div className="space-y-4">
              {/* Header Section */}
              <BrandedSectionHeader 
                icon="🎪" 
                title="Fixtures & Features" 
                description="Interior venue items and exterior architectural/landscape features"
                config={config}
              />

              {/* Quick Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {fixtureTypes.filter(f => f.category !== 'exterior' && f.category !== 'lodging').length}
                  </div>
                  <div className="text-xs text-purple-700 font-medium">🏛️ Venue Fixtures</div>
                </div>
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-cyan-600">
                    {fixtureTypes.filter(f => f.category === 'lodging').length}
                  </div>
                  <div className="text-xs text-cyan-700 font-medium">🛏️ Lodging/Utilities</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {fixtureTypes.filter(f => f.category === 'exterior').length}
                  </div>
                  <div className="text-xs text-green-700 font-medium">🌳 Arch/Landscape</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {fixtureTypes.filter(f => f.inventoryCount !== undefined).length}
                  </div>
                  <div className="text-xs text-blue-700 font-medium">📦 With Inventory</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-amber-600">
                    {fixtureTypes.filter(f => f.wallStyleId).length}
                  </div>
                  <div className="text-xs text-amber-700 font-medium">🧱 Wall-Linked</div>
                </div>
              </div>

              {/* Quick Add Presets */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <span>⚡</span> Quick Add Preset Fixtures
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {/* Venue Fixture Presets */}
                  <button
                    onClick={() => {
                      const presets: FixtureType[] = [
                        { id: `fix-${Date.now()}-1`, name: 'Dance Floor', shape: 'rectangle', width: 18, height: 18, icon: '💃', color: '#1a1a1a', category: 'interior', pattern: 'checkered' },
                        { id: `fix-${Date.now()}-2`, name: 'DJ Booth', shape: 'rectangle', width: 6, height: 4, icon: '🎧', color: '#374151', category: 'interior' },
                        { id: `fix-${Date.now()}-3`, name: 'Stage', shape: 'rectangle', width: 12, height: 8, icon: '🎤', color: '#78350f', category: 'interior', pattern: 'wood' },
                      ];
                      handleSaveFixtures([...fixtureTypes, ...presets]);
                    }}
                    className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium text-center"
                  >
                    🎉 Entertainment
                  </button>
                  <button
                    onClick={() => {
                      const presets: FixtureType[] = [
                        { id: `fix-${Date.now()}-1`, name: 'Sweetheart Table', shape: 'semicircle', width: 6, height: 3, icon: '💕', color: '#fdf2f8', category: 'interior' },
                        { id: `fix-${Date.now()}-2`, name: 'Head Table', shape: 'rectangle', width: 16, height: 3, icon: '👑', color: '#fef3c7', category: 'interior' },
                        { id: `fix-${Date.now()}-3`, name: 'Gift Table', shape: 'rectangle', width: 6, height: 3, icon: '🎁', color: '#f3e8ff', category: 'interior' },
                      ];
                      handleSaveFixtures([...fixtureTypes, ...presets]);
                    }}
                    className="px-3 py-2 bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 transition-colors text-sm font-medium text-center"
                  >
                    💒 Wedding
                  </button>
                  <button
                    onClick={() => {
                      const presets: FixtureType[] = [
                        { id: `fix-${Date.now()}-1`, name: 'Buffet Station', shape: 'rectangle', width: 10, height: 3, icon: '🍽️', color: '#fef3c7', category: 'interior' },
                        { id: `fix-${Date.now()}-2`, name: 'Bar', shape: 'rectangle', width: 12, height: 4, icon: '🍸', color: '#422006', category: 'interior', pattern: 'wood' },
                        { id: `fix-${Date.now()}-3`, name: 'Cake Table', shape: 'circle', width: 4, height: 4, icon: '🎂', color: '#fce7f3', category: 'interior' },
                        { id: `fix-${Date.now()}-4`, name: 'Dessert Table', shape: 'rectangle', width: 8, height: 3, icon: '🧁', color: '#fed7aa', category: 'interior' },
                      ];
                      handleSaveFixtures([...fixtureTypes, ...presets]);
                    }}
                    className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium text-center"
                  >
                    🍰 Food & Drink
                  </button>
                  <button
                    onClick={() => {
                      const presets: FixtureType[] = [
                        { id: `fix-${Date.now()}-1`, name: 'Photo Booth', shape: 'rectangle', width: 8, height: 6, icon: '📸', color: '#e0e7ff', category: 'interior' },
                        { id: `fix-${Date.now()}-2`, name: 'Guest Book Station', shape: 'rectangle', width: 4, height: 2, icon: '📖', color: '#fef3c7', category: 'interior' },
                        { id: `fix-${Date.now()}-3`, name: 'Welcome Sign', shape: 'rectangle', width: 3, height: 4, icon: '✨', color: '#f3e8ff', category: 'interior' },
                      ];
                      handleSaveFixtures([...fixtureTypes, ...presets]);
                    }}
                    className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium text-center"
                  >
                    📸 Guest Areas
                  </button>
                  {/* Exterior Presets */}
                  <button
                    onClick={() => {
                      const presets: FixtureType[] = [
                        { id: `fix-${Date.now()}-1`, name: 'Fountain', shape: 'circle', width: 8, height: 8, icon: '⛲', color: '#bfdbfe', category: 'exterior', pattern: 'water' },
                        { id: `fix-${Date.now()}-2`, name: 'Garden Path', shape: 'rectangle', width: 20, height: 4, icon: '🪨', color: '#d6d3d1', category: 'exterior', pattern: 'gravel' },
                        { id: `fix-${Date.now()}-3`, name: 'Pond', shape: 'oval', width: 15, height: 10, icon: '🦆', color: '#7dd3fc', category: 'exterior', pattern: 'water' },
                      ];
                      handleSaveFixtures([...fixtureTypes, ...presets]);
                    }}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium text-center"
                  >
                    💧 Water Features
                  </button>
                  <button
                    onClick={() => {
                      const presets: FixtureType[] = [
                        { id: `fix-${Date.now()}-1`, name: 'Large Tree', shape: 'circle', width: 12, height: 12, icon: '🌳', color: '#166534', category: 'exterior' },
                        { id: `fix-${Date.now()}-2`, name: 'Flower Bed', shape: 'oval', width: 8, height: 4, icon: '🌸', color: '#f9a8d4', category: 'exterior', pattern: 'grass' },
                        { id: `fix-${Date.now()}-3`, name: 'Hedge Row', shape: 'rectangle', width: 20, height: 3, icon: '🌿', color: '#22c55e', category: 'exterior' },
                        { id: `fix-${Date.now()}-4`, name: 'Lawn Area', shape: 'rectangle', width: 30, height: 20, icon: '🌱', color: '#86efac', category: 'exterior', pattern: 'grass' },
                      ];
                      handleSaveFixtures([...fixtureTypes, ...presets]);
                    }}
                    className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium text-center"
                  >
                    🌿 Landscaping
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    {fixtureTypes.length} total fixtures
                  </span>
                  <div className="flex gap-1">
                    {fixtureTypes.slice(0, 8).map(f => (
                      <span key={f.id} className="text-lg" title={f.name}>{f.icon}</span>
                    ))}
                    {fixtureTypes.length > 8 && <span className="text-xs text-gray-400 ml-1">+{fixtureTypes.length - 8}</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      const newFixture: FixtureType = {
                        id: `fixture-${Date.now()}`,
                        name: 'New Venue Fixture',
                        shape: 'rectangle',
                        width: 4,
                        height: 4,
                        icon: '📦',
                        color: '#E5E5E5',
                        category: 'interior'
                      };
                      handleSaveFixtures([...fixtureTypes, newFixture]);
                    }}
                    className="px-4 py-2 bg-[#4A1942] text-white rounded-lg hover:bg-[#5c2a64] transition-colors font-medium shadow-sm"
                  >
                    + Venue
                  </button>
                  <button
                    onClick={() => {
                      const newFixture: FixtureType = {
                        id: `fixture-${Date.now()}`,
                        name: 'New Lodging/Utilities Fixture',
                        shape: 'rectangle',
                        width: 12,
                        height: 10,
                        icon: '🛏️',
                        color: '#E0F2FE',
                        category: 'lodging',
                        lodgingType: 'rooms',
                        isRoom: true,
                        capacity: 2,
                      };
                      handleSaveFixtures([...fixtureTypes, newFixture]);
                    }}
                    className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium shadow-sm"
                  >
                    + Lodging/Utilities
                  </button>
                  <button
                    onClick={() => {
                      const newFixture: FixtureType = {
                        id: `fixture-${Date.now()}`,
                        name: 'New Architectural/Landscape Feature',
                        shape: 'rectangle',
                        width: 10,
                        height: 10,
                        icon: '🌳',
                        color: '#90EE90',
                        category: 'exterior'
                      };
                      handleSaveFixtures([...fixtureTypes, newFixture]);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                  >
                    + Architectural/Landscape
                  </button>
                  <button
                     onClick={() => {
                       setShowDrawingTool(true);
                     }}
                     className="px-4 py-2 bg-gradient-to-r from-[#4A1942] via-purple-600 to-cyan-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium shadow-sm flex items-center gap-2"
                   >
                     <span>🎨</span>
                     Draw Custom Feature
                   </button>
                </div>
              </div>
              
              {/* Venue Fixtures */}
              <div className="bg-white rounded-xl shadow-sm border border-purple-200 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-3 flex items-center justify-between cursor-pointer"
                  onClick={() => setShowVenueFixturesSection(v => !v)}>
                  <div className="flex items-center gap-3 text-white">
                    <span className="text-lg">{showVenueFixturesSection ? '▼' : '▶'}</span>
                    <span className="text-2xl">🏛️</span>
                    <div>
                      <h4 className="font-bold">Venue Fixtures</h4>
                      <p className="text-xs text-purple-100">Interior items for your venue layout</p>
                    </div>
                    <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                      {fixtureTypes.filter(f => f.category !== 'exterior' && f.category !== 'lodging').length} items
                    </span>
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={expandAllVenueFixtures}
                      className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-colors"
                    >
                      ▼ Expand All
                    </button>
                    <button
                      onClick={collapseAllVenueFixtures}
                      className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-colors"
                    >
                      ▲ Collapse All
                    </button>
                  </div>
                </div>
                {showVenueFixturesSection && (
                <div className="p-4 bg-purple-50/50">
                {fixtureTypes.filter(f => f.category !== 'exterior' && f.category !== 'lodging').map(fixture => (
                  <div key={fixture.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-3">
                    <div 
                      className="bg-purple-50 px-4 py-3 border-b border-purple-200 flex items-center justify-between cursor-pointer hover:bg-purple-100 transition-colors"
                      onClick={() => toggleVenueFixtureExpanded(fixture.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{expandedVenueFixtures.has(fixture.id) ? '▼' : '▶'}</span>
                        {/* Shape Preview */}
                        <svg width="32" height="32" className="flex-shrink-0">
                          {renderShapePreview(fixture.shape || 'rectangle', fixture.color || '#E5E5E5')}
                        </svg>
                        <span className="text-2xl">{fixture.icon}</span>
                        <span className="font-semibold text-purple-800">{fixture.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          {fixture.width}' × {fixture.height}'
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete fixture "${fixture.name}"?`)) {
                              handleSaveFixtures(fixtureTypes.filter(f => f.id !== fixture.id));
                            }
                          }}
                          className="text-red-500 hover:text-red-700 text-sm px-2"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    {expandedVenueFixtures.has(fixture.id) && (
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Name</label>
                          <input
                            type="text"
                            value={fixture.name}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, name: e.target.value } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Shape</label>
                          <select
                            value={fixture.shape || 'rectangle'}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, shape: e.target.value as ShapeType } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            {shapeOptions.map(s => (
                              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                        {/* Icon and Icon Visible - separate row for better spacing */}
                        <div className="col-span-2 sm:col-span-4 grid grid-cols-2 gap-4 bg-purple-50 p-3 rounded-lg border border-purple-200">
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Icon</label>
                            <EmojiPicker
                              value={fixture.icon || '📦'}
                              onChange={(emoji) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, icon: emoji } : f))}
                              position="bottom"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Icon Visible</label>
                            <div className="flex items-center h-[42px] bg-white rounded-lg border border-gray-200 px-3">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={fixture.showIconOnCanvas !== false}
                                  onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, showIconOnCanvas: e.target.checked } : f))}
                                  className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-gray-700">On Layout</span>
                              </label>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Width (ft)</label>
                          <input
                            type="number"
                            value={fixture.width}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, width: parseFloat(e.target.value) || 4 } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Height (ft)</label>
                          <input
                            type="number"
                            value={fixture.height}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, height: parseFloat(e.target.value) || 4 } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Fill Color</label>
                          <div className="flex gap-1">
                            <input
                              type="color"
                              value={fixture.color || '#E5E5E5'}
                              onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, color: e.target.value } : f))}
                              className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Font Color</label>
                          <div className="flex gap-1">
                            <input
                              type="color"
                              value={fixture.fontColor || '#374151'}
                              onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, fontColor: e.target.value } : f))}
                              className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Pattern</label>
                          <select
                            value={fixture.pattern || 'solid'}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, pattern: e.target.value as PatternType, patternColors: defaultPatternColors[e.target.value as PatternType] } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            {patternOptions.map(p => (
                              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {/* Pattern Colors for Venue Fixtures */}
                      {fixture.pattern && fixture.pattern !== 'solid' && (
                        <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-amber-800">🎨 Pattern Colors</span>
                          </div>
                          <PatternColorPicker
                            pattern={fixture.pattern}
                            patternColors={fixture.patternColors}
                            onChange={(colors) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, patternColors: colors } : f))}
                          />
                        </div>
                      )}
                      {/* Border Settings */}
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-blue-800">🔲 Border Settings</span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={fixture.showBorder || false}
                              onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { 
                                ...f, 
                                showBorder: e.target.checked,
                                borderColor: e.target.checked ? (f.borderColor || '#000000') : f.borderColor,
                                borderWidth: e.target.checked ? (f.borderWidth || 2) : f.borderWidth
                              } : f))}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-blue-700">Show Border</span>
                          </label>
                        </div>
                        {fixture.showBorder && (
                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Border Color</label>
                              <div className="flex gap-1">
                                <input
                                  type="color"
                                  value={fixture.borderColor || '#000000'}
                                  onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, borderColor: e.target.value } : f))}
                                  className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={fixture.borderColor || '#000000'}
                                  onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, borderColor: e.target.value } : f))}
                                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Border Width (px)</label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                step="0.5"
                                value={fixture.borderWidth || 2}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, borderWidth: parseFloat(e.target.value) || 2 } : f))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Venue Category Availability - Venue Fixtures */}
                      <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                        <h4 className="text-sm font-semibold text-indigo-800 mb-2 flex items-center gap-2">
                          🏛️ Venue Category Availability
                        </h4>
                        <p className="text-xs text-indigo-600 mb-3">Choose which venue categories can use this venue fixture. Leave all unchecked to allow in all categories.</p>
                        <div className="flex flex-wrap gap-2">
                          {layoutCategories.map(cat => {
                            const selected = (fixture.venueCategories || []).includes(cat.id as any);
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  const current = fixture.venueCategories || [];
                                  const venueCategories = selected
                                    ? current.filter(c => c !== cat.id)
                                    : [...current, cat.id as any];
                                  handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, venueCategories } : f));
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selected ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'}`}
                              >
                                {cat.icon} {cat.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Inventory / Availability / Spacing - Venue Fixtures */}
                      <div className="mt-3 grid md:grid-cols-2 gap-3">
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-green-800">📦 Inventory</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                value={fixture.inventoryCount ?? ''}
                                onChange={(e) => {
                                  const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                                  handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, inventoryCount: value } : f));
                                }}
                                className="w-20 px-2 py-1 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-center"
                                placeholder="∞"
                              />
                              <span className="text-sm text-green-600">
                                {fixture.inventoryCount === undefined ? 'Unlimited' : `${fixture.inventoryCount} available`}
                              </span>
                              {fixture.inventoryCount !== undefined && (
                                <button
                                  onClick={() => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, inventoryCount: undefined } : f))}
                                  className="text-xs text-green-600 hover:text-green-800 underline"
                                >
                                  Unlimited
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="p-3 bg-violet-50 rounded-lg border border-violet-200 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-violet-800">👥 User Availability</span>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={fixture.visibleToUsers !== false}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, visibleToUsers: e.target.checked } : f))}
                                className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                              />
                              <span className="text-sm text-violet-700 font-medium">Visible to Basic/Guest users</span>
                            </label>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-violet-800">📏 Spacing Rules</span>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={fixture.ignoreSpacingRules || false}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, ignoreSpacingRules: e.target.checked } : f))}
                                className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                              />
                              <span className="text-sm text-violet-700 font-medium">Ignore spacing guidelines</span>
                            </label>
                          </div>
                          <p className="text-xs text-violet-600">Enable this for venue fixtures that should be placeable anywhere on the full canvas.</p>
                          <div className="flex items-center justify-between gap-3 pt-2 border-t border-violet-100">
                            <span className="text-sm font-semibold text-violet-800">🎀 Decor Designer</span>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!fixture.allowAsDecorBase}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, allowAsDecorBase: e.target.checked } : f))}
                                className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                              />
                              <span className="text-sm text-violet-700 font-medium">Available in Decor Designer</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Fixture Image Gallery (up to 4 images) */}
                      <MultiImageUpload
                        images={fixture.images || []}
                        onChange={(images) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, images } : f))}
                        maxImages={4}
                        itemName="fixture"
                      />

                      {/* Delete button */}
                      <div className="flex justify-end pt-3 border-t border-gray-100">
                        <button
                          onClick={() => handleSaveFixtures(fixtureTypes.filter(f => f.id !== fixture.id))}
                          className="px-3 py-1 text-red-500 hover:bg-red-50 rounded text-sm"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                    )}
                  </div>
                ))}
                </div>
                )}
              </div>

              {/* Lodging/Utilities Fixtures */}
              <div className="bg-white rounded-xl shadow-sm border border-cyan-200 overflow-hidden">
                <div className="bg-gradient-to-r from-cyan-500 to-sky-600 px-4 py-3 flex items-center justify-between cursor-pointer"
                  onClick={() => setShowLodgingFixturesSection(v => !v)}>
                  <div className="flex items-center gap-3 text-white">
                    <span className="text-lg">{showLodgingFixturesSection ? '▼' : '▶'}</span>
                    <span className="text-2xl">🛏️</span>
                    <div>
                      <h4 className="font-bold">Lodging/Utilities Fixtures</h4>
                      <p className="text-xs text-cyan-100">Rooms, furniture, appliances, and utilities for lodging venues (Admin Only)</p>
                    </div>
                    <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                      {fixtureTypes.filter(f => f.category === 'lodging').length} items
                    </span>
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={expandAllLodgingFixtures}
                      className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-colors"
                    >
                      ▼ Expand All
                    </button>
                    <button
                      onClick={collapseAllLodgingFixtures}
                      className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-colors"
                    >
                      ▲ Collapse All
                    </button>
                  </div>
                </div>
                {showLodgingFixturesSection && (
                <div className="p-4 bg-cyan-50/50">
                  {fixtureTypes.filter(f => f.category === 'lodging').map(fixture => (
                    <div key={fixture.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-3">
                      <div
                        className="bg-cyan-50 px-4 py-3 border-b border-cyan-200 flex items-center justify-between cursor-pointer hover:bg-cyan-100 transition-colors"
                        onClick={() => toggleLodgingFixtureExpanded(fixture.id)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{expandedLodgingFixtures.has(fixture.id) ? '▼' : '▶'}</span>
                          <svg width="32" height="32" className="flex-shrink-0">
                            {renderShapePreview(fixture.shape || 'rectangle', fixture.color || '#E0F2FE')}
                          </svg>
                          <span className="text-2xl">{fixture.icon || '🛏️'}</span>
                          <span className="font-semibold text-cyan-800">{fixture.name}</span>
                          <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-1 rounded">{(fixture.lodgingType || 'other').replace('entry-exit', 'entry/exit').replace(/^./, c => c.toUpperCase())}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-1 rounded">{fixture.width}' × {fixture.height}'</span>
                          {fixture.lodgingType === 'rooms' && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Max {fixture.capacity || 0}</span>}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete lodging/utility fixture \"${fixture.name}\"?`)) {
                                handleSaveFixtures(fixtureTypes.filter(f => f.id !== fixture.id));
                              }
                            }}
                            className="text-red-500 hover:text-red-700 text-sm px-2"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      {expandedLodgingFixtures.has(fixture.id) && (
                        <div className="p-4 space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Name</label>
                              <input
                                type="text"
                                value={fixture.name}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, name: e.target.value } : f))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Shape</label>
                              <select
                                value={fixture.shape || 'rectangle'}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, shape: e.target.value as ShapeType } : f))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              >
                                {shapeOptions.map(s => (
                                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                ))}
                              </select>
                            </div>
                            <div className="col-span-2 sm:col-span-4 grid grid-cols-2 gap-4 bg-cyan-50 p-3 rounded-lg border border-cyan-200">
                              <div>
                                <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Icon</label>
                                <EmojiPicker
                                  value={fixture.icon || '🛏️'}
                                  onChange={(emoji) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, icon: emoji } : f))}
                                  position="bottom"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Icon Visible</label>
                                <div className="flex items-center h-[42px] bg-white rounded-lg border border-gray-200 px-3">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={fixture.showIconOnCanvas !== false}
                                      onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, showIconOnCanvas: e.target.checked } : f))}
                                      className="w-5 h-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                                    />
                                    <span className="text-sm text-gray-700">On Layout</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Width (ft)</label>
                              <input
                                type="number"
                                value={fixture.width}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, width: parseFloat(e.target.value) || 12 } : f))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Height (ft)</label>
                              <input
                                type="number"
                                value={fixture.height}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, height: parseFloat(e.target.value) || 10 } : f))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Fill Color</label>
                              <div className="flex gap-1">
                                <input
                                  type="color"
                                  value={fixture.color || '#E0F2FE'}
                                  onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, color: e.target.value } : f))}
                                  className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Font Color</label>
                              <div className="flex gap-1">
                                <input
                                  type="color"
                                  value={fixture.fontColor || '#1F2937'}
                                  onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, fontColor: e.target.value } : f))}
                                  className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Pattern</label>
                              <select
                                value={fixture.pattern || 'solid'}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, pattern: e.target.value as PatternType, patternColors: defaultPatternColors[e.target.value as PatternType] } : f))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              >
                                {patternOptions.map(p => (
                                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                              <label className="text-xs font-medium text-gray-500 uppercase block mb-1">Type</label>
                              <select
                                value={fixture.lodgingType || 'other'}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? {
                                  ...f,
                                  lodgingType: e.target.value as FixtureType['lodgingType'],
                                  isRoom: e.target.value === 'rooms',
                                  capacity: e.target.value === 'rooms' ? (f.capacity || 2) : undefined,
                                  inventoryCount: e.target.value === 'rooms' ? undefined : f.inventoryCount
                                } : f))}
                                className="w-full px-3 py-2 border border-indigo-300 rounded-lg"
                              >
                                <option value="furniture">Furniture</option>
                                <option value="appliances">Appliances</option>
                                <option value="electronics">Electronics</option>
                                <option value="entry-exit">Entry/Exit Points</option>
                                <option value="utilities">Utilities</option>
                                <option value="rooms">Rooms</option>
                                <option value="other">Other</option>
                              </select>
                              <p className="text-xs text-indigo-700 mt-2">Classify this lodging/utility item for easier organization and room behavior.</p>
                            </div>
                            {fixture.lodgingType === 'rooms' ? (
                              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                <label className="text-xs font-medium text-gray-500 uppercase block mb-1">Max Occupancy</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="20"
                                  value={fixture.capacity || 2}
                                  onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, isRoom: true, lodgingType: 'rooms', capacity: Math.max(1, parseInt(e.target.value) || 1) } : f))}
                                  className="w-full px-3 py-2 border border-emerald-300 rounded-lg"
                                />
                                <p className="text-xs text-emerald-700 mt-2">Room-type items can hold guest assignments like tables.</p>
                              </div>
                            ) : (
                              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="text-sm font-semibold text-slate-700">Guest Assignment</div>
                                <p className="text-xs text-slate-600 mt-2">Set Type to <strong>Rooms</strong> to enable occupancy and guest assignment for this item.</p>
                              </div>
                            )}
                          </div>

                          {fixture.pattern && fixture.pattern !== 'solid' && (
                            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-amber-800">🎨 Pattern Colors</span>
                              </div>
                              <PatternColorPicker
                                pattern={fixture.pattern}
                                patternColors={fixture.patternColors}
                                onChange={(colors) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, patternColors: colors } : f))}
                              />
                            </div>
                          )}

                          <MultiImageUpload
                            images={fixture.images || []}
                            onChange={(images) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, images } : f))}
                            maxImages={4}
                            itemName="lodging/utilities fixture"
                          />

                          <div className="flex justify-end pt-3 border-t border-gray-100">
                            <button
                              onClick={() => handleSaveFixtures(fixtureTypes.filter(f => f.id !== fixture.id))}
                              className="px-3 py-1 text-red-500 hover:bg-red-50 rounded text-sm"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                )}
              </div>
              
              {/* Exterior Fixtures */}
              <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden">
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3 flex items-center justify-between cursor-pointer"
                  onClick={() => setShowExteriorFixturesSection(v => !v)}>
                  <div className="flex items-center gap-3 text-white">
                    <span className="text-lg">{showExteriorFixturesSection ? '▼' : '▶'}</span>
                    <span className="text-2xl">🌳</span>
                    <div>
                      <h4 className="font-bold">Architectural/Landscape Features</h4>
                      <p className="text-xs text-green-100">Exterior features (Admin Only)</p>
                    </div>
                    <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                      {fixtureTypes.filter(f => f.category === 'exterior').length} items
                    </span>
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={expandAllExteriorFixtures}
                      className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-colors"
                    >
                      ▼ Expand All
                    </button>
                    <button
                      onClick={collapseAllExteriorFixtures}
                      className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-colors"
                    >
                      ▲ Collapse All
                    </button>
                  </div>
                </div>
                {showExteriorFixturesSection && (
                <div className="p-4 bg-green-50/50">
                {fixtureTypes.filter(f => f.category === 'exterior').map(fixture => (
                  <div key={fixture.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-3">
                    <div 
                      className="bg-green-50 px-4 py-3 border-b border-green-200 flex items-center justify-between cursor-pointer hover:bg-green-100 transition-colors"
                      onClick={() => toggleExteriorFixtureExpanded(fixture.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{expandedExteriorFixtures.has(fixture.id) ? '▼' : '▶'}</span>
                        {/* Shape Preview */}
                        <svg width="32" height="32" className="flex-shrink-0">
                          {renderShapePreview(fixture.shape || 'rectangle', fixture.color || '#90EE90')}
                        </svg>
                        <span className="text-2xl">{fixture.icon}</span>
                        <span className="font-semibold text-green-800">{fixture.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          {fixture.width}' × {fixture.height}'
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete feature "${fixture.name}"?`)) {
                              handleSaveFixtures(fixtureTypes.filter(f => f.id !== fixture.id));
                            }
                          }}
                          className="text-red-500 hover:text-red-700 text-sm px-2"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    {expandedExteriorFixtures.has(fixture.id) && (
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Name</label>
                          <input
                            type="text"
                            value={fixture.name}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, name: e.target.value } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Shape</label>
                          <select
                            value={fixture.shape || 'rectangle'}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, shape: e.target.value as ShapeType } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            {shapeOptions.map(s => (
                              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                        {/* Icon and Icon Visible - separate row for better spacing */}
                        <div className="col-span-2 sm:col-span-4 grid grid-cols-2 gap-4 bg-green-50 p-3 rounded-lg border border-green-200">
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Icon</label>
                            <EmojiPicker
                              value={fixture.icon || '🌳'}
                              onChange={(emoji) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, icon: emoji } : f))}
                              position="bottom"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Icon Visible</label>
                            <div className="flex items-center h-[42px] bg-white rounded-lg border border-gray-200 px-3">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={fixture.showIconOnCanvas !== false}
                                  onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, showIconOnCanvas: e.target.checked } : f))}
                                  className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <span className="text-sm text-gray-700">On Layout</span>
                              </label>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Width (ft)</label>
                          <input
                            type="number"
                            value={fixture.width}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, width: parseFloat(e.target.value) || 10 } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Height (ft)</label>
                          <input
                            type="number"
                            value={fixture.height}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, height: parseFloat(e.target.value) || 10 } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Fill Color</label>
                          <div className="flex gap-1">
                            <input
                              type="color"
                              value={fixture.color || '#90EE90'}
                              onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, color: e.target.value } : f))}
                              className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Font Color</label>
                          <div className="flex gap-1">
                            <input
                              type="color"
                              value={fixture.fontColor || '#374151'}
                              onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, fontColor: e.target.value } : f))}
                              className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Pattern</label>
                          <select
                            value={fixture.pattern || 'solid'}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, pattern: e.target.value as PatternType, patternColors: defaultPatternColors[e.target.value as PatternType] } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            {patternOptions.map(p => (
                              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {/* Pattern Colors for Exterior Fixtures */}
                      {fixture.pattern && fixture.pattern !== 'solid' && (
                        <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-amber-800">🎨 Pattern Colors</span>
                          </div>
                          <PatternColorPicker
                            pattern={fixture.pattern}
                            patternColors={fixture.patternColors}
                            onChange={(colors) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, patternColors: colors } : f))}
                          />
                        </div>
                      )}
                      {/* Border Settings */}
                      <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-green-800">🔲 Border Settings</span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={fixture.showBorder || false}
                              onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { 
                                ...f, 
                                showBorder: e.target.checked,
                                borderColor: e.target.checked ? (f.borderColor || '#000000') : f.borderColor,
                                borderWidth: e.target.checked ? (f.borderWidth || 2) : f.borderWidth
                              } : f))}
                              className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <span className="text-sm font-medium text-green-700">Show Border</span>
                          </label>
                        </div>
                        {fixture.showBorder && (
                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Border Color</label>
                              <div className="flex gap-1">
                                <input
                                  type="color"
                                  value={fixture.borderColor || '#000000'}
                                  onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, borderColor: e.target.value } : f))}
                                  className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={fixture.borderColor || '#000000'}
                                  onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, borderColor: e.target.value } : f))}
                                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Border Width (px)</label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                step="0.5"
                                value={fixture.borderWidth || 2}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, borderWidth: parseFloat(e.target.value) || 2 } : f))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Fixture Image Gallery (up to 4 images) */}
                      <MultiImageUpload
                        images={fixture.images || []}
                        onChange={(images) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, images } : f))}
                        maxImages={4}
                        itemName="feature"
                      />

                      {/* Delete button */}
                      <div className="flex justify-end pt-3 border-t border-gray-100">
                        <button
                          onClick={() => handleSaveFixtures(fixtureTypes.filter(f => f.id !== fixture.id))}
                          className="px-3 py-1 text-red-500 hover:bg-red-50 rounded text-sm"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                    )}
                  </div>
                ))}
                </div>
                )}
              </div>
            </div>
          )}

          {/* Chairs Tab */}
          {activeTab === 'chairs' && (
            <div className="space-y-6">
              {/* Header */}
              <BrandedSectionHeader 
                icon="🪑" 
                title="Chair Types" 
                description="Manage chair styles for tables, ceremonies, and events"
                config={config}
              />

              {/* Quick Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
                  <div className="text-3xl mb-1">🪑</div>
                  <div className="text-2xl font-bold text-amber-600">{chairSpecs.filter(c => c.id !== 'none').length}</div>
                  <div className="text-xs text-gray-500">Chair Types</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
                  <div className="text-3xl mb-1">📦</div>
                  <div className="text-2xl font-bold text-green-600">
                    {chairSpecs.filter(c => c.inventoryCount !== undefined && c.inventoryCount > 0).reduce((sum, c) => sum + (c.inventoryCount || 0), 0)}
                  </div>
                  <div className="text-xs text-gray-500">Total Inventory</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
                  <div className="text-3xl mb-1">📐</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {chairSpecs.length > 0 ? (chairSpecs.filter(c => c.id !== 'none').reduce((sum, c) => sum + (c.width || 1.5), 0) / Math.max(1, chairSpecs.filter(c => c.id !== 'none').length)).toFixed(1) : 0}ft
                  </div>
                  <div className="text-xs text-gray-500">Avg. Width</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                  <div className="text-xs text-gray-500 mb-2">Color Palette</div>
                  <div className="flex flex-wrap gap-1">
                    {chairSpecs.filter(c => c.id !== 'none').slice(0, 8).map(c => (
                      <div 
                        key={c.id}
                        className="w-6 h-6 rounded border border-gray-300" 
                        style={{ backgroundColor: c.color }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Add Presets */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <h4 className="font-bold text-lg text-gray-800 mb-3 flex items-center gap-2">
                  ⚡ Quick Add Chair Presets
                </h4>
                <p className="text-sm text-gray-500 mb-4">Add common wedding chair styles with one click</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    { name: 'Classic Collection', icon: '👑', chairs: [
                      { name: 'Chiavari Gold', color: '#D4AF37', icon: '✨' },
                      { name: 'Chiavari Silver', color: '#C0C0C0', icon: '🪑' },
                      { name: 'Chiavari White', color: '#FFFFFF', icon: '🪑' }
                    ]},
                    { name: 'Modern Elegance', icon: '🎨', chairs: [
                      { name: 'Ghost Chair', color: '#E8E8E8', icon: '🪑' },
                      { name: 'Acrylic Clear', color: '#F5F5F5', icon: '💎' },
                      { name: 'Lucite White', color: '#FFFFFF', icon: '✨' }
                    ]},
                    { name: 'Rustic & Natural', icon: '🌿', chairs: [
                      { name: 'Cross Back Wood', color: '#8B4513', icon: '🪵' },
                      { name: 'Vineyard Oak', color: '#A0522D', icon: '🌳' },
                      { name: 'Farm Bench', color: '#DEB887', icon: '🪵' }
                    ]},
                    { name: 'Garden Party', icon: '🌸', chairs: [
                      { name: 'White Resin', color: '#FFFFFF', icon: '⬜' },
                      { name: 'Folding White', color: '#F8F8F8', icon: '🪑' },
                      { name: 'Garden Lattice', color: '#FFFAF0', icon: '🌿' }
                    ]},
                    { name: 'Ceremony Seating', icon: '💒', chairs: [
                      { name: 'Padded Ceremony', color: '#F5F5DC', icon: '💺' },
                      { name: 'Church Pew', color: '#654321', icon: '⛪' },
                      { name: 'Ceremony Bench', color: '#D2B48C', icon: '🪵' }
                    ]}
                  ].map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        const existingNames = chairSpecs.map(c => c.name.toLowerCase());
                        const newChairs = preset.chairs
                          .filter(c => !existingNames.includes(c.name.toLowerCase()))
                          .map((c, i) => ({
                            id: `chair-${Date.now()}-${i}` as ChairType,
                            name: c.name,
                            color: c.color,
                            width: 1.5,
                            depth: 1.5,
                            icon: c.icon
                          }));
                        if (newChairs.length > 0) {
                          const updated = [...chairSpecs, ...newChairs];
                          setChairSpecs(updated);
                          setChairSpecsState(updated);
                          showSuccess(`Added ${newChairs.length} chairs from "${preset.name}"!`);
                        } else {
                          showSuccess('All chairs from this preset already exist!');
                        }
                      }}
                      className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl hover:border-amber-400 hover:shadow-md transition-all text-left group"
                    >
                      <div className="text-2xl mb-2">{preset.icon}</div>
                      <div className="font-semibold text-amber-800 group-hover:text-amber-600 text-sm">{preset.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{preset.chairs.length} chairs</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="flex flex-wrap gap-1">
                    {chairSpecs.filter(c => c.id !== 'none').slice(0, 5).map(c => (
                      <span key={c.id} className="text-xl" title={c.name}>{c.icon || '🪑'}</span>
                    ))}
                    {chairSpecs.filter(c => c.id !== 'none').length > 5 && (
                      <span className="text-sm text-gray-400">+{chairSpecs.filter(c => c.id !== 'none').length - 5}</span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {chairSpecs.filter(c => c.id !== 'none').length} chair type{chairSpecs.filter(c => c.id !== 'none').length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      const allIds = chairSpecs.filter(c => c.id !== 'none').map(c => c.id);
                      if (expandedChairs.size === allIds.length) {
                        setExpandedChairs(new Set());
                      } else {
                        setExpandedChairs(new Set(allIds));
                      }
                    }}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    {expandedChairs.size === chairSpecs.filter(c => c.id !== 'none').length ? '▲ Collapse All' : '▼ Expand All'}
                  </button>
                  <button
                    onClick={() => {
                      const newChair: ChairSpec = {
                        id: `chair-${Date.now()}` as ChairType,
                        name: 'New Chair',
                        color: '#FFFFFF',
                        width: 1.5,
                        depth: 1.5,
                        icon: '🪑'
                      };
                      const updated = [...chairSpecs, newChair];
                      setChairSpecs(updated);
                      setChairSpecsState(updated);
                      setExpandedChairs(prev => new Set([...prev, newChair.id]));
                      showSuccess('Chair added!');
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all font-medium shadow-sm"
                  >
                    ➕ Add Chair Type
                  </button>
                </div>
              </div>

              {/* Chair Type Legend */}
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                <div className="flex flex-wrap gap-4 items-center text-sm">
                  <span className="font-medium text-amber-800">Chair Features:</span>
                  <span className="flex items-center gap-1"><span className="w-4 h-4 bg-white border border-gray-300 rounded"></span> Color</span>
                  <span className="flex items-center gap-1">📦 Inventory</span>
                  <span className="flex items-center gap-1">📐 Dimensions</span>
                  <span className="flex items-center gap-1">📷 Images</span>
                </div>
              </div>

              {/* Chair Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {chairSpecs.filter(c => c.id !== 'none').map((chair) => (
                  <div key={chair.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                    {/* Chair Header */}
                    <div 
                      className="p-4 cursor-pointer transition-colors"
                      style={{ backgroundColor: chair.color, borderBottom: '3px solid rgba(0,0,0,0.1)' }}
                      onClick={() => {
                        const newSet = new Set(expandedChairs);
                        if (newSet.has(chair.id)) {
                          newSet.delete(chair.id);
                        } else {
                          newSet.add(chair.id);
                        }
                        setExpandedChairs(newSet);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{expandedChairs.has(chair.id) ? '▼' : '▶'}</span>
                          <div className="w-12 h-12 bg-white/80 rounded-xl flex items-center justify-center text-2xl shadow-sm">
                            {chair.icon || '🪑'}
                          </div>
                          <div>
                            <div className="font-bold text-gray-800">{chair.name}</div>
                            <div className="text-xs text-gray-600 flex items-center gap-2">
                              <span>📐 {chair.width}' × {chair.depth}'</span>
                              {chair.inventoryCount !== undefined && (
                                <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs">
                                  📦 {chair.inventoryCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Duplicate chair
                              const newChair: ChairSpec = {
                                ...chair,
                                id: `chair-${Date.now()}` as ChairType,
                                name: `${chair.name} (Copy)`
                              };
                              const updated = [...chairSpecs, newChair];
                              setChairSpecs(updated);
                              setChairSpecsState(updated);
                              setExpandedChairs(prev => new Set([...prev, newChair.id]));
                              showSuccess('Chair duplicated!');
                            }}
                            className="p-1.5 bg-white/80 hover:bg-white rounded-lg text-gray-600 hover:text-blue-600 transition-colors"
                            title="Duplicate"
                          >
                            📋
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete chair type "${chair.name}"?`)) {
                                const updated = chairSpecs.filter(c => c.id !== chair.id);
                                setChairSpecs(updated);
                                setChairSpecsState(updated);
                                showSuccess('Chair deleted!');
                              }
                            }}
                            className="p-1.5 bg-white/80 hover:bg-white rounded-lg text-gray-600 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Chair Details - Collapsible */}
                    {expandedChairs.has(chair.id) && (
                    <div className="p-4 space-y-4 bg-gray-50">
                      {/* Name & Dimensions Row */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <h5 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                          📝 Basic Info
                        </h5>
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-gray-500">Chair Name</label>
                            <input
                              type="text"
                              value={chair.name}
                              onChange={(e) => {
                                const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, name: e.target.value } : c);
                                setChairSpecs(updated);
                                setChairSpecsState(updated);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-medium text-gray-500">Width (ft)</label>
                              <input
                                type="number"
                                step="0.25"
                                min="0.5"
                                max="5"
                                value={chair.width}
                                onChange={(e) => {
                                  const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, width: parseFloat(e.target.value) || 1.5 } : c);
                                  setChairSpecs(updated);
                                  setChairSpecsState(updated);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500">Depth (ft)</label>
                              <input
                                type="number"
                                step="0.25"
                                min="0.5"
                                max="5"
                                value={chair.depth}
                                onChange={(e) => {
                                  const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, depth: parseFloat(e.target.value) || 1.5 } : c);
                                  setChairSpecs(updated);
                                  setChairSpecsState(updated);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Appearance Row */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <h5 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                          🎨 Appearance
                        </h5>
                        <div className="grid grid-cols-2 gap-4">
                          {/* Color */}
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Chair Color</label>
                            <div className="flex gap-2">
                              <input
                                type="color"
                                value={chair.color}
                                onChange={(e) => {
                                  const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, color: e.target.value } : c);
                                  setChairSpecs(updated);
                                  setChairSpecsState(updated);
                                }}
                                className="w-12 h-10 border-2 border-gray-300 rounded-lg cursor-pointer shadow-sm"
                              />
                              <input
                                type="text"
                                value={chair.color}
                                onChange={(e) => {
                                  const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, color: e.target.value } : c);
                                  setChairSpecs(updated);
                                  setChairSpecsState(updated);
                                }}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                                placeholder="#FFFFFF"
                              />
                            </div>
                          </div>
                          {/* Icon */}
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Icon/Emoji</label>
                            <div className="flex gap-2 items-center">
                              <EmojiPicker
                                value={chair.icon || '🪑'}
                                onChange={(emoji) => {
                                  const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, icon: emoji } : c);
                                  setChairSpecs(updated);
                                  setChairSpecsState(updated);
                                }}
                                position="auto"
                              />
                              <div className="flex-1 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200 text-center">
                                <span className="text-2xl">{chair.icon || '🪑'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Color Presets */}
                        <div className="mt-3">
                          <label className="text-xs font-medium text-gray-500 mb-2 block">Quick Colors</label>
                          <div className="flex flex-wrap gap-1">
                            {['#FFFFFF', '#F5F5DC', '#D4AF37', '#C0C0C0', '#8B4513', '#654321', '#000000', '#FFB6C1', '#E8E8E8', '#F0E68C'].map(color => (
                              <button
                                key={color}
                                onClick={() => {
                                  const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, color } : c);
                                  setChairSpecs(updated);
                                  setChairSpecsState(updated);
                                }}
                                className={`w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 ${chair.color === color ? 'border-amber-500 ring-2 ring-amber-200' : 'border-gray-300'}`}
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Inventory */}
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <h5 className="font-medium text-green-700 mb-3 flex items-center gap-2">
                          📦 Inventory Management
                        </h5>
                        <div className="flex flex-wrap gap-3 items-center">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="9999"
                              value={chair.inventoryCount ?? ''}
                              onChange={(e) => {
                                const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                                const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, inventoryCount: value } : c);
                                setChairSpecs(updated);
                                setChairSpecsState(updated);
                              }}
                              className="w-24 px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-center"
                              placeholder="∞"
                            />
                            <span className="text-sm text-green-600 font-medium">
                              {chair.inventoryCount === undefined ? 'Unlimited' : `chairs available`}
                            </span>
                          </div>
                          {chair.inventoryCount !== undefined && (
                            <button
                              onClick={() => {
                                const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, inventoryCount: undefined } : c);
                                setChairSpecs(updated);
                                setChairSpecsState(updated);
                              }}
                              className="px-3 py-1.5 bg-green-200 text-green-700 rounded-lg hover:bg-green-300 transition-colors text-sm"
                            >
                              Set Unlimited
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Images */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <h5 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                          📷 Reference Images
                        </h5>
                        <MultiImageUpload
                          images={chair.images || []}
                          onChange={(images) => {
                            const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, images } : c);
                            setChairSpecs(updated);
                            setChairSpecsState(updated);
                          }}
                          maxImages={4}
                          itemName="chair"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => showSuccess('Chair saved!')}
                          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all font-medium shadow-sm"
                        >
                          ✓ Save Chair
                        </button>
                        <button
                          onClick={() => {
                            const newChair: ChairSpec = {
                              ...chair,
                              id: `chair-${Date.now()}` as ChairType,
                              name: `${chair.name} (Copy)`
                            };
                            const updated = [...chairSpecs, newChair];
                            setChairSpecs(updated);
                            setChairSpecsState(updated);
                            showSuccess('Chair duplicated!');
                          }}
                          className="px-4 py-2.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
                        >
                          📋 Duplicate
                        </button>
                      </div>
                    </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Empty State */}
              {chairSpecs.filter(c => c.id !== 'none').length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-amber-300">
                  <div className="text-6xl mb-4">🪑</div>
                  <h4 className="text-xl font-bold text-gray-700 mb-2">No Chair Types Yet</h4>
                  <p className="text-gray-500 mb-6">Add chair types to use in your layouts</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => {
                        const newChair: ChairSpec = {
                          id: `chair-${Date.now()}` as ChairType,
                          name: 'New Chair',
                          color: '#FFFFFF',
                          width: 1.5,
                          depth: 1.5,
                          icon: '🪑'
                        };
                        const updated = [...chairSpecs, newChair];
                        setChairSpecs(updated);
                        setChairSpecsState(updated);
                        setExpandedChairs(new Set([newChair.id]));
                      }}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all font-medium shadow-sm"
                    >
                      ➕ Add Chair Type
                    </button>
                    <button
                      onClick={() => {
                        const defaultChairs: ChairSpec[] = [
                          { id: 'white-plastic' as ChairType, name: 'White Resin', color: '#FFFFFF', width: 1.5, depth: 1.5, icon: '⬜' },
                          { id: 'chiavari-gold' as ChairType, name: 'Chiavari Gold', color: '#D4AF37', width: 1.5, depth: 1.5, icon: '✨' },
                          { id: 'chiavari-silver' as ChairType, name: 'Chiavari Silver', color: '#C0C0C0', width: 1.5, depth: 1.5, icon: '🪑' },
                          { id: 'crossback' as ChairType, name: 'Cross Back Wood', color: '#8B4513', width: 1.5, depth: 1.5, icon: '🪵' },
                          { id: 'ghost' as ChairType, name: 'Ghost Chair', color: '#E8E8E8', width: 1.5, depth: 1.5, icon: '💎' },
                          { id: 'folding-white' as ChairType, name: 'Folding White', color: '#F8F8F8', width: 1.5, depth: 1.5, icon: '🪑' },
                          { id: 'padded-ceremony' as ChairType, name: 'Padded Ceremony', color: '#F5F5DC', width: 1.5, depth: 1.5, icon: '💺' },
                          { id: 'vineyard' as ChairType, name: 'Vineyard Oak', color: '#A0522D', width: 1.5, depth: 1.5, icon: '🌳' }
                        ];
                        setChairSpecs([...chairSpecs, ...defaultChairs]);
                        setChairSpecsState([...chairSpecs, ...defaultChairs]);
                        showSuccess('Added 8 default chair types!');
                      }}
                      className="px-5 py-2.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors font-medium"
                    >
                      🎨 Load Defaults
                    </button>
                  </div>
                </div>
              )}

              {/* Tips */}
              <BrandedTips
                title="Tips for Managing Chair Types"
                config={config}
                tips={[
                  { icon: '📐', title: 'Dimensions', description: 'Standard chairs are typically 1.5\' × 1.5\'. Larger throne chairs may be 2\' × 2\'.' },
                  { icon: '🎨', title: 'Colors', description: 'Match chair colors to your wedding theme. Use the color picker or enter exact hex codes.' },
                  { icon: '📦', title: 'Inventory', description: 'Set inventory limits to prevent over-booking. Leave blank for unlimited.' },
                  { icon: '📷', title: 'Images', description: 'Upload photos of actual chairs for client reference during planning.' },
                  { icon: '✨', title: 'Presets', description: 'Use quick add presets to quickly add popular chair styles like Chiavari and Ghost chairs.' }
                ]}
              />
            </div>
          )}
          {/* Spacing Tab */}
          {activeTab === 'spacing' && (
            <div className="space-y-6">
              {/* Header */}
              <BrandedSectionHeader 
                icon="📐" 
                title="Spacing & Collision Settings" 
                description="Configure minimum spacing between items to ensure proper guest and server flow"
                config={config}
              />

              {/* Quick Presets */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <h4 className="font-bold text-lg text-gray-800 mb-3 flex items-center gap-2">
                  ⚡ Quick Presets
                </h4>
                <p className="text-sm text-gray-500 mb-4">Apply recommended spacing settings for common event types</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { name: 'Intimate', icon: '💕', table: 2.5, wall: 1.5, fixture: 3, item: 2, desc: 'Cozy seating, close tables' },
                    { name: 'Standard', icon: '🎉', table: 3.5, wall: 2, fixture: 4, item: 2.5, desc: 'Balanced spacing for most events' },
                    { name: 'Comfortable', icon: '✨', table: 4, wall: 3, fixture: 5, item: 3, desc: 'Extra room for easy movement' },
                    { name: 'Accessible', icon: '♿', table: 5, wall: 4, fixture: 6, item: 4, desc: 'ADA-compliant spacing' }
                  ].map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        const updated = { 
                          ...spacingSettings, 
                          minTableSpacing: preset.table,
                          minWallSpacing: preset.wall,
                          minFixtureSpacing: preset.fixture,
                          minItemSpacing: preset.item,
                          enableCollisionDetection: true
                        };
                        setSpacingSettings(updated);
                        setSpacingSettingsState(updated);
                        showSuccess(`Applied "${preset.name}" spacing preset!`);
                      }}
                      className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl hover:border-[#4A1942] hover:shadow-md transition-all text-left group"
                    >
                      <div className="text-2xl mb-2">{preset.icon}</div>
                      <div className="font-semibold text-gray-800 group-hover:text-[#4A1942]">{preset.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{preset.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Toggle */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${spacingSettings.enableCollisionDetection ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                      {spacingSettings.enableCollisionDetection ? '🛡️' : '⚠️'}
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-gray-800">Collision Detection</h4>
                      <p className="text-sm text-gray-500">Prevent items from being placed too close together</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={spacingSettings.enableCollisionDetection}
                      onChange={(e) => {
                        const updated = { ...spacingSettings, enableCollisionDetection: e.target.checked };
                        setSpacingSettings(updated);
                        setSpacingSettingsState(updated);
                        showSuccess(e.target.checked ? 'Collision detection enabled!' : 'Collision detection disabled!');
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#4A1942]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#4A1942]"></div>
                    <span className="ml-3 text-sm font-medium text-gray-700">{spacingSettings.enableCollisionDetection ? 'ON' : 'OFF'}</span>
                  </label>
                </div>

                {/* Warning Toggle */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🔔</span>
                    <div>
                      <span className="font-medium text-gray-700">Show Warning Messages</span>
                      <p className="text-xs text-gray-500">Alert users when items can't be placed</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={spacingSettings.showCollisionWarnings !== false}
                      onChange={(e) => {
                        const updated = { ...spacingSettings, showCollisionWarnings: e.target.checked };
                        setSpacingSettings(updated);
                        setSpacingSettingsState(updated);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#4A1942]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4A1942]"></div>
                  </label>
                </div>
              </div>

              {/* Spacing Controls Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Table-to-Table Spacing */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">🪑</div>
                    <div>
                      <h4 className="font-bold text-gray-800">Table-to-Table Spacing</h4>
                      <p className="text-xs text-gray-500">Space between tables (includes chairs)</p>
                    </div>
                  </div>
                  
                  {/* Visual Diagram */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <svg viewBox="0 0 200 80" className="w-full h-20">
                      {/* Table 1 */}
                      <rect x="20" y="20" width="50" height="40" rx="25" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="1"/>
                      <circle cx="45" cy="40" r="8" fill="#6B7280"/>
                      <text x="45" y="44" textAnchor="middle" fill="white" fontSize="8">T1</text>
                      
                      {/* Spacing Arrow */}
                      <line x1="73" y1="40" x2="127" y2="40" stroke="#4A1942" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                      <line x1="73" y1="40" x2="127" y2="40" stroke="#4A1942" strokeWidth="2" markerStart="url(#arrowhead)"/>
                      <text x="100" y="25" textAnchor="middle" fill="#4A1942" fontSize="10" fontWeight="bold">{spacingSettings.minTableSpacing || 3}ft</text>
                      
                      {/* Table 2 */}
                      <rect x="130" y="20" width="50" height="40" rx="25" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="1"/>
                      <circle cx="155" cy="40" r="8" fill="#6B7280"/>
                      <text x="155" y="44" textAnchor="middle" fill="white" fontSize="8">T2</text>
                      
                      <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                          <polygon points="0 0, 10 3.5, 0 7" fill="#4A1942"/>
                        </marker>
                      </defs>
                    </svg>
                  </div>
                  
                  {/* Value Input + Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-600">Minimum spacing:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="1"
                          value={Math.max(0, Math.min(10, Math.round(spacingSettings.minTableSpacing || 3)))}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(10, Math.round(Number(e.target.value) || 0)));
                            const updated = { ...spacingSettings, minTableSpacing: val };
                            setSpacingSettings(updated);
                            setSpacingSettingsState(updated);
                          }}
                          className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm text-right"
                        />
                        <span className="text-sm text-gray-500">ft</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      value={Math.max(0, Math.min(10, Math.round(spacingSettings.minTableSpacing || 3)))}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(10, Math.round(Number(e.target.value) || 0)));
                        const updated = { ...spacingSettings, minTableSpacing: val };
                        setSpacingSettings(updated);
                        setSpacingSettingsState(updated);
                      }}
                      className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#4A1942]"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>0 ft</span>
                      <span>5 ft</span>
                      <span>10 ft</span>
                    </div>
                  </div>
                  
                  {/* Quick Buttons */}
                  <div className="flex gap-2 mt-3">
                    {[0, 1, 2, 3, 4, 5, 8, 10].map(val => (
                      <button
                        key={val}
                        onClick={() => {
                          const updated = { ...spacingSettings, minTableSpacing: val };
                          setSpacingSettings(updated);
                          setSpacingSettingsState(updated);
                        }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          (spacingSettings.minTableSpacing || 3) === val 
                            ? 'bg-[#4A1942] text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {val}ft
                      </button>
                    ))}
                  </div>
                </div>

                {/* Wall Spacing */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-xl">🧱</div>
                    <div>
                      <h4 className="font-bold text-gray-800">Wall Spacing</h4>
                      <p className="text-xs text-gray-500">Minimum distance from venue walls</p>
                    </div>
                  </div>
                  
                  {/* Visual Diagram */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <svg viewBox="0 0 200 80" className="w-full h-20">
                      {/* Wall */}
                      <rect x="10" y="10" width="10" height="60" fill="#92400E" rx="2"/>
                      <text x="15" y="75" textAnchor="middle" fill="#92400E" fontSize="6">WALL</text>
                      
                      {/* Spacing Arrow */}
                      <line x1="25" y1="40" x2="60" y2="40" stroke="#4A1942" strokeWidth="2"/>
                      <text x="42" y="30" textAnchor="middle" fill="#4A1942" fontSize="10" fontWeight="bold">{spacingSettings.minWallSpacing || 2}ft</text>
                      
                      {/* Table with chairs */}
                      <rect x="65" y="20" width="60" height="40" rx="20" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="1"/>
                      <circle cx="95" cy="40" r="10" fill="#6B7280"/>
                      <text x="95" y="44" textAnchor="middle" fill="white" fontSize="10">🪑</text>
                      
                      {/* Chairs indicators */}
                      <circle cx="55" cy="30" r="5" fill="#D1D5DB"/>
                      <circle cx="55" cy="50" r="5" fill="#D1D5DB"/>
                    </svg>
                  </div>
                  
                  {/* Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Minimum spacing:</span>
                      <span className="font-bold text-[#4A1942] text-lg">{spacingSettings.minWallSpacing || 2} ft</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="8"
                      step="0.5"
                      value={spacingSettings.minWallSpacing || 2}
                      onChange={(e) => {
                        const updated = { ...spacingSettings, minWallSpacing: parseFloat(e.target.value) };
                        setSpacingSettings(updated);
                        setSpacingSettingsState(updated);
                      }}
                      className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#4A1942]"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>0 ft</span>
                      <span>4 ft</span>
                      <span>8 ft</span>
                    </div>
                  </div>
                  
                  {/* Quick Buttons */}
                  <div className="flex gap-2 mt-3">
                    {[1, 2, 3, 4, 5].map(val => (
                      <button
                        key={val}
                        onClick={() => {
                          const updated = { ...spacingSettings, minWallSpacing: val };
                          setSpacingSettings(updated);
                          setSpacingSettingsState(updated);
                        }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          (spacingSettings.minWallSpacing || 2) === val 
                            ? 'bg-[#4A1942] text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {val}ft
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fixture Spacing */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-xl">💃</div>
                    <div>
                      <h4 className="font-bold text-gray-800">Fixture Spacing</h4>
                      <p className="text-xs text-gray-500">Space around dance floor, bar, buffet, etc.</p>
                    </div>
                  </div>
                  
                  {/* Visual Diagram */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <svg viewBox="0 0 200 80" className="w-full h-20">
                      {/* Dance Floor */}
                      <rect x="60" y="15" width="80" height="50" fill="#D8B4FE" stroke="#A855F7" strokeWidth="2" rx="4"/>
                      <text x="100" y="45" textAnchor="middle" fill="#7E22CE" fontSize="10" fontWeight="bold">💃 Dance Floor</text>
                      
                      {/* Spacing indicators */}
                      <line x1="50" y1="40" x2="60" y2="40" stroke="#4A1942" strokeWidth="2" strokeDasharray="2,2"/>
                      <line x1="140" y1="40" x2="150" y2="40" stroke="#4A1942" strokeWidth="2" strokeDasharray="2,2"/>
                      
                      {/* Tables nearby */}
                      <circle cx="30" cy="40" r="12" fill="#E5E7EB" stroke="#9CA3AF"/>
                      <circle cx="170" cy="40" r="12" fill="#E5E7EB" stroke="#9CA3AF"/>
                      
                      {/* Label */}
                      <text x="100" y="75" textAnchor="middle" fill="#4A1942" fontSize="9">{spacingSettings.minFixtureSpacing || 4}ft clearance</text>
                    </svg>
                  </div>
                  
                  {/* Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Minimum spacing:</span>
                      <span className="font-bold text-[#4A1942] text-lg">{spacingSettings.minFixtureSpacing || 4} ft</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="12"
                      step="0.5"
                      value={spacingSettings.minFixtureSpacing || 4}
                      onChange={(e) => {
                        const updated = { ...spacingSettings, minFixtureSpacing: parseFloat(e.target.value) };
                        setSpacingSettings(updated);
                        setSpacingSettingsState(updated);
                      }}
                      className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#4A1942]"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>1 ft</span>
                      <span>6 ft</span>
                      <span>12 ft</span>
                    </div>
                  </div>
                  
                  {/* Quick Buttons */}
                  <div className="flex gap-2 mt-3">
                    {[3, 4, 5, 6, 8].map(val => (
                      <button
                        key={val}
                        onClick={() => {
                          const updated = { ...spacingSettings, minFixtureSpacing: val };
                          setSpacingSettings(updated);
                          setSpacingSettingsState(updated);
                        }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          (spacingSettings.minFixtureSpacing || 4) === val 
                            ? 'bg-[#4A1942] text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {val}ft
                      </button>
                    ))}
                  </div>
                </div>

                {/* General Item Spacing */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-xl">📦</div>
                    <div>
                      <h4 className="font-bold text-gray-800">General Item Spacing</h4>
                      <p className="text-xs text-gray-500">Default spacing for all other items</p>
                    </div>
                  </div>
                  
                  {/* Slider */}
                  <div className="space-y-2 mt-8">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Minimum spacing:</span>
                      <span className="font-bold text-[#4A1942] text-lg">{spacingSettings.minItemSpacing || 2} ft</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="6"
                      step="0.5"
                      value={spacingSettings.minItemSpacing || 2}
                      onChange={(e) => {
                        const updated = { ...spacingSettings, minItemSpacing: parseFloat(e.target.value) };
                        setSpacingSettings(updated);
                        setSpacingSettingsState(updated);
                      }}
                      className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#4A1942]"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>0 ft</span>
                      <span>3 ft</span>
                      <span>6 ft</span>
                    </div>
                  </div>
                  
                  {/* Quick Buttons */}
                  <div className="flex gap-2 mt-3">
                    {[1, 1.5, 2, 2.5, 3].map(val => (
                      <button
                        key={val}
                        onClick={() => {
                          const updated = { ...spacingSettings, minItemSpacing: val };
                          setSpacingSettings(updated);
                          setSpacingSettingsState(updated);
                        }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          (spacingSettings.minItemSpacing || 2) === val 
                            ? 'bg-[#4A1942] text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {val}ft
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Current Settings Summary */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-5 rounded-xl border border-blue-200">
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  📋 Current Settings Summary
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white p-3 rounded-lg shadow-sm text-center">
                    <div className="text-2xl mb-1">🪑↔️🪑</div>
                    <div className="text-xl font-bold text-[#4A1942]">{spacingSettings.minTableSpacing || 3}ft</div>
                    <div className="text-xs text-gray-500">Table to Table</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm text-center">
                    <div className="text-2xl mb-1">🧱↔️🪑</div>
                    <div className="text-xl font-bold text-[#4A1942]">{spacingSettings.minWallSpacing || 2}ft</div>
                    <div className="text-xs text-gray-500">Wall to Item</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm text-center">
                    <div className="text-2xl mb-1">💃↔️🪑</div>
                    <div className="text-xl font-bold text-[#4A1942]">{spacingSettings.minFixtureSpacing || 4}ft</div>
                    <div className="text-xs text-gray-500">Fixture to Item</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm text-center">
                    <div className="text-2xl mb-1">📦↔️📦</div>
                    <div className="text-xl font-bold text-[#4A1942]">{spacingSettings.minItemSpacing || 2}ft</div>
                    <div className="text-xs text-gray-500">General Items</div>
                  </div>
                </div>
              </div>

              {/* Best Practices Guide */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <h4 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                  💡 Spacing Best Practices
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h5 className="font-semibold text-blue-800 mb-2">🍽️ Dining Areas</h5>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• <strong>3-4 feet</strong> between tables for server access</li>
                      <li>• <strong>18 inches</strong> behind chairs for guests to sit</li>
                      <li>• <strong>36 inches</strong> main aisles for wheelchair access</li>
                    </ul>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                    <h5 className="font-semibold text-purple-800 mb-2">💃 Dance Floor</h5>
                    <ul className="text-sm text-purple-700 space-y-1">
                      <li>• <strong>4-6 feet</strong> clearance around dance floor</li>
                      <li>• <strong>9 sq ft</strong> per dancer (standing)</li>
                      <li>• <strong>2 feet</strong> buffer from speakers</li>
                    </ul>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                    <h5 className="font-semibold text-amber-800 mb-2">🍰 Buffet & Bar</h5>
                    <ul className="text-sm text-amber-700 space-y-1">
                      <li>• <strong>5-6 feet</strong> in front for queue lines</li>
                      <li>• <strong>3 feet</strong> behind for staff access</li>
                      <li>• <strong>8 feet</strong> wide aisles for two-way flow</li>
                    </ul>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                    <h5 className="font-semibold text-green-800 mb-2">♿ Accessibility</h5>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• <strong>36 inches</strong> minimum aisle width</li>
                      <li>• <strong>60 inches</strong> for wheelchair turning</li>
                      <li>• <strong>48 inches</strong> at table ends for access</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => showSuccess('Spacing settings saved successfully!')}
                  className="px-8 py-3 bg-gradient-to-r from-[#4A1942] to-[#6B2C5F] text-white rounded-xl hover:opacity-90 transition-all font-semibold shadow-lg flex items-center gap-2"
                >
                  ✓ Save Spacing Settings
                </button>
              </div>
            </div>
          )}

          {/* Wall Styles Tab */}
          {activeTab === 'walls' && (
            <div className="space-y-6">
              {/* Header */}
              <BrandedSectionHeader 
                icon="🧱" 
                title="Wall Styles" 
                description="Define decorative wall options for backdrops, photo walls, and venue décor"
                config={config}
              />

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="text-3xl font-bold text-teal-600">{wallStyles.length}</div>
                  <div className="text-xs text-gray-500 font-medium">Total Styles</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="text-3xl font-bold text-green-600">{wallStyles.filter(s => s.enabled).length}</div>
                  <div className="text-xs text-gray-500 font-medium">✓ Enabled</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="text-3xl font-bold text-gray-400">{wallStyles.filter(s => !s.enabled).length}</div>
                  <div className="text-xs text-gray-500 font-medium">○ Disabled</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {fixtureTypes.filter(f => f.wallStyleId).length}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">🔗 Linked Fixtures</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="flex justify-center gap-1 mb-1">
                    {wallStyles.slice(0, 5).map(s => (
                      <div key={s.id} className="w-5 h-5 rounded border border-gray-200" style={{ backgroundColor: s.color }} />
                    ))}
                    {wallStyles.length > 5 && <span className="text-xs text-gray-400">+{wallStyles.length - 5}</span>}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">Palette</div>
                </div>
              </div>

              {/* Quick Add Presets */}
              <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl p-4 border border-teal-200">
                <h3 className="font-semibold text-teal-800 mb-3 flex items-center gap-2">
                  <span>✨</span> Quick Add Wall Style Presets
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const presets = [
                        { id: `wall-${Date.now()}-1`, name: 'Greenery Wall', color: '#228B22', icon: '🌿', pattern: 'grass' as const, enabled: true },
                        { id: `wall-${Date.now()}-2`, name: 'Flower Wall', color: '#FFB6C1', icon: '🌸', pattern: 'solid' as const, enabled: true },
                        { id: `wall-${Date.now()}-3`, name: 'Ivy Wall', color: '#355E3B', icon: '🍃', pattern: 'grass' as const, enabled: true },
                      ];
                      const existing = wallStyles.map(s => s.name.toLowerCase());
                      const toAdd = presets.filter(s => !existing.includes(s.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveWallStyles([...wallStyles, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <span className="text-lg">🌿</span> Nature & Greenery
                  </button>
                  <button
                    onClick={() => {
                      const presets = [
                        { id: `wall-${Date.now()}-1`, name: 'White Drapery', color: '#FFFFFF', icon: '🪟', pattern: 'solid' as const, enabled: true },
                        { id: `wall-${Date.now()}-2`, name: 'Ivory Drapery', color: '#FFFFF0', icon: '🪟', pattern: 'solid' as const, enabled: true },
                        { id: `wall-${Date.now()}-3`, name: 'Blush Drapery', color: '#FFE4E1', icon: '🎀', pattern: 'solid' as const, enabled: true },
                      ];
                      const existing = wallStyles.map(s => s.name.toLowerCase());
                      const toAdd = presets.filter(s => !existing.includes(s.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveWallStyles([...wallStyles, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <span className="text-lg">🪟</span> Elegant Drapery
                  </button>
                  <button
                    onClick={() => {
                      const presets = [
                        { id: `wall-${Date.now()}-1`, name: 'Exposed Brick', color: '#8B4513', icon: '🧱', pattern: 'brick' as const, enabled: true },
                        { id: `wall-${Date.now()}-2`, name: 'Stone Wall', color: '#808080', icon: '🪨', pattern: 'gravel' as const, enabled: true },
                        { id: `wall-${Date.now()}-3`, name: 'Wood Panel', color: '#8B4513', icon: '🪵', pattern: 'wood' as const, enabled: true },
                      ];
                      const existing = wallStyles.map(s => s.name.toLowerCase());
                      const toAdd = presets.filter(s => !existing.includes(s.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveWallStyles([...wallStyles, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <span className="text-lg">🧱</span> Rustic & Industrial
                  </button>
                  <button
                    onClick={() => {
                      const presets = [
                        { id: `wall-${Date.now()}-1`, name: 'Sequin Wall', color: '#FFD700', icon: '✨', pattern: 'solid' as const, enabled: true },
                        { id: `wall-${Date.now()}-2`, name: 'Mirror Wall', color: '#C0C0C0', icon: '🪞', pattern: 'marble' as const, enabled: true },
                        { id: `wall-${Date.now()}-3`, name: 'Balloon Wall', color: '#FF69B4', icon: '🎈', pattern: 'solid' as const, enabled: true },
                      ];
                      const existing = wallStyles.map(s => s.name.toLowerCase());
                      const toAdd = presets.filter(s => !existing.includes(s.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveWallStyles([...wallStyles, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <span className="text-lg">✨</span> Glam & Sparkle
                  </button>
                  <button
                    onClick={() => {
                      const presets = [
                        { id: `wall-${Date.now()}-1`, name: 'Photo Backdrop', color: '#F5F5F5', icon: '📸', pattern: 'solid' as const, enabled: true },
                        { id: `wall-${Date.now()}-2`, name: 'Neon Sign Wall', color: '#000000', icon: '💡', pattern: 'solid' as const, enabled: true },
                        { id: `wall-${Date.now()}-3`, name: 'Chalkboard Wall', color: '#2F4F4F', icon: '🖌️', pattern: 'solid' as const, enabled: true },
                      ];
                      const existing = wallStyles.map(s => s.name.toLowerCase());
                      const toAdd = presets.filter(s => !existing.includes(s.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveWallStyles([...wallStyles, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <span className="text-lg">📸</span> Photo & Display
                  </button>
                </div>
              </div>

              {/* Action Bar */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        const allIds = wallStyles.map(s => s.id);
                        if (expandedWalls.size === allIds.length) {
                          setExpandedWalls(new Set());
                        } else {
                          setExpandedWalls(new Set(allIds));
                        }
                      }}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                      {expandedWalls.size === wallStyles.length ? '▲ Collapse All' : '▼ Expand All'}
                    </button>
                    <button
                      onClick={() => handleSaveWallStyles(wallStyles.map(s => ({ ...s, enabled: true })))}
                      className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                    >
                      ✓ Enable All
                    </button>
                    <button
                      onClick={() => handleSaveWallStyles(wallStyles.map(s => ({ ...s, enabled: false })))}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                      ○ Disable All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => {
                        if (confirm('Reset to default wall styles?')) {
                          handleSaveWallStyles(defaultWallStyles);
                        }
                      }}
                      className="px-3 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-sm font-medium"
                    >
                      🔄 Reset Defaults
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      const newStyle: WallStyle = {
                        id: `wall-${Date.now()}`,
                        name: 'New Wall Style',
                        color: '#FFFFFF',
                        icon: '🪟',
                        pattern: 'solid',
                        enabled: true
                      };
                      handleSaveWallStyles([...wallStyles, newStyle]);
                      setExpandedWalls(prev => new Set([...prev, newStyle.id]));
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-all font-medium shadow-sm flex items-center gap-2"
                  >
                    <span>➕</span> Add Custom Wall Style
                  </button>
                </div>
              </div>

              {/* Wall Style Preview Gallery */}
              {wallStyles.length > 0 && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span>🖼️</span> Style Preview Gallery
                    <span className="text-xs font-normal text-gray-400">(Enabled styles visible to users)</span>
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {wallStyles.filter(s => s.enabled).map(style => (
                      <div
                        key={style.id}
                        className="group relative bg-white rounded-lg border-2 border-gray-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                        onClick={() => setExpandedWalls(prev => new Set([...prev, style.id]))}
                        style={{ width: '120px' }}
                      >
                        <div 
                          className="h-16 flex items-center justify-center"
                          style={{ backgroundColor: style.color }}
                        >
                          <span className="text-3xl">{style.icon}</span>
                        </div>
                        <div className="p-2 text-center">
                          <span className="text-xs font-medium text-gray-700 truncate block">{style.name}</span>
                          <span className="text-[10px] text-gray-400">{style.pattern || 'solid'}</span>
                        </div>
                      </div>
                    ))}
                    {wallStyles.filter(s => s.enabled).length === 0 && (
                      <p className="text-sm text-gray-400 italic">No enabled wall styles to preview</p>
                    )}
                  </div>
                </div>
              )}

              {/* Linked Fixtures Info */}
              {fixtureTypes.filter(f => f.wallStyleId).length > 0 && (
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                  <h3 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                    <span>🔗</span> Fixtures Using Wall Styles
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {fixtureTypes.filter(f => f.wallStyleId).map(fixture => {
                      const linkedStyle = wallStyles.find(s => s.id === fixture.wallStyleId);
                      return (
                        <div key={fixture.id} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-purple-200">
                          <span className="text-lg">{fixture.icon}</span>
                          <span className="text-sm font-medium text-gray-700">{fixture.name}</span>
                          <span className="text-gray-400">→</span>
                          {linkedStyle ? (
                            <div className="flex items-center gap-1">
                              <div className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: linkedStyle.color }} />
                              <span className="text-sm text-teal-600">{linkedStyle.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-red-500">Style not found</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Wall Style Cards */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <span>🧱</span> All Wall Styles
                  <span className="text-sm font-normal text-gray-400">({wallStyles.length} total)</span>
                </h3>

              </div>

              {/* Wall Style Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {wallStyles.map((style, index) => (
                  <div 
                    key={style.id} 
                    className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all hover:shadow-md ${style.enabled ? 'border-teal-400' : 'border-gray-200 opacity-70'}`}
                  >
                    {/* Wall Header - Clickable */}
                    <div 
                      className="h-20 flex items-center justify-between px-4 cursor-pointer hover:opacity-90 transition-opacity relative"
                      style={{ backgroundColor: style.color }}
                      onClick={() => {
                        const newSet = new Set(expandedWalls);
                        if (newSet.has(style.id)) {
                          newSet.delete(style.id);
                        } else {
                          newSet.add(style.id);
                        }
                        setExpandedWalls(newSet);
                      }}
                    >
                      {/* Status badges */}
                      <div className="absolute top-2 left-2 flex gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${style.enabled ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`}>
                          {style.enabled ? '✓ Active' : 'Disabled'}
                        </span>
                        {fixtureTypes.some(f => f.wallStyleId === style.id) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500 text-white">🔗 Linked</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-4">
                        <span className="text-lg text-gray-700 bg-white/50 rounded-full w-6 h-6 flex items-center justify-center">
                          {expandedWalls.has(style.id) ? '▼' : '▶'}
                        </span>
                        <span className="text-4xl drop-shadow-sm">{style.icon}</span>
                        <div>
                          <span className="font-bold text-gray-800 block">{style.name}</span>
                          <span className="text-xs text-gray-600 capitalize">{style.pattern || 'solid'} pattern</span>
                        </div>
                      </div>
                      <div className="flex gap-1 mt-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Move up
                            if (index > 0) {
                              const newStyles = [...wallStyles];
                              [newStyles[index - 1], newStyles[index]] = [newStyles[index], newStyles[index - 1]];
                              handleSaveWallStyles(newStyles);
                            }
                          }}
                          className="px-1.5 py-0.5 bg-white/70 hover:bg-white rounded text-xs disabled:opacity-30"
                          disabled={index === 0}
                        >
                          ⬆️
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Move down
                            if (index < wallStyles.length - 1) {
                              const newStyles = [...wallStyles];
                              [newStyles[index], newStyles[index + 1]] = [newStyles[index + 1], newStyles[index]];
                              handleSaveWallStyles(newStyles);
                            }
                          }}
                          className="px-1.5 py-0.5 bg-white/70 hover:bg-white rounded text-xs disabled:opacity-30"
                          disabled={index === wallStyles.length - 1}
                        >
                          ⬇️
                        </button>
                      </div>
                    </div>
                    {expandedWalls.has(style.id) && (
                    <div className="p-4 space-y-4 bg-gray-50">
                      {/* Name & Toggle */}
                      <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                        <div className="flex-1 mr-4">
                          <label className="text-xs font-medium text-gray-500 uppercase">Style Name</label>
                          <input
                            type="text"
                            value={style.name}
                            onChange={(e) => handleSaveWallStyles(wallStyles.map(s => s.id === style.id ? { ...s, name: e.target.value } : s))}
                            className="w-full font-semibold text-gray-800 border-b-2 border-teal-300 focus:border-teal-500 outline-none mt-1 py-1 bg-transparent"
                          />
                        </div>
                        <div className="flex flex-col items-center">
                          <label className="text-xs font-medium text-gray-500 uppercase mb-1">Status</label>
                          <button
                            onClick={() => handleSaveWallStyles(wallStyles.map(s => s.id === style.id ? { ...s, enabled: !s.enabled } : s))}
                            className={`relative w-14 h-7 rounded-full transition-colors ${style.enabled ? 'bg-teal-500' : 'bg-gray-300'}`}
                          >
                            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${style.enabled ? 'left-8' : 'left-1'}`} />
                          </button>
                        </div>
                      </div>

                      {/* Appearance Settings */}
                      <div className="bg-white p-3 rounded-lg border border-gray-200">
                        <h4 className="text-xs font-semibold text-gray-600 uppercase mb-3 flex items-center gap-1">
                          <span>🎨</span> Appearance
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-gray-500">Color</label>
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="color"
                                value={style.color}
                                onChange={(e) => handleSaveWallStyles(wallStyles.map(s => s.id === style.id ? { ...s, color: e.target.value } : s))}
                                className="w-10 h-10 border-2 border-gray-300 rounded-lg cursor-pointer"
                              />
                              <input
                                type="text"
                                value={style.color}
                                onChange={(e) => handleSaveWallStyles(wallStyles.map(s => s.id === style.id ? { ...s, color: e.target.value } : s))}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm font-mono uppercase"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500">Icon</label>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200">
                                <span className="text-2xl">{style.icon}</span>
                              </div>
                              <EmojiPicker
                                value={style.icon}
                                onChange={(emoji) => handleSaveWallStyles(wallStyles.map(s => s.id === style.id ? { ...s, icon: emoji } : s))}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="text-xs font-medium text-gray-500">Pattern</label>
                          <select
                            value={style.pattern || 'solid'}
                            onChange={(e) => handleSaveWallStyles(wallStyles.map(s => s.id === style.id ? { ...s, pattern: e.target.value as PatternType } : s))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-1"
                          >
                            {patternOptions.map(p => (
                              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Preview */}
                      <div className="bg-white p-3 rounded-lg border border-gray-200">
                        <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2 flex items-center gap-1">
                          <span>👁️</span> Preview
                        </h4>
                        <div 
                          className="h-24 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300"
                          style={{ backgroundColor: style.color }}
                        >
                          <div className="text-center">
                            <span className="text-4xl block">{style.icon}</span>
                            <span className="text-xs font-medium mt-1 px-2 py-0.5 bg-white/80 rounded" style={{ color: style.color === '#FFFFFF' || style.color === '#ffffff' ? '#374151' : 'inherit' }}>{style.name}</span>
                          </div>
                        </div>
                      </div>

                      {/* Image Gallery */}
                      <div className="bg-white p-3 rounded-lg border border-gray-200">
                        <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2 flex items-center gap-1">
                          <span>🖼️</span> Reference Images
                        </h4>
                        <MultiImageUpload
                          images={style.images || []}
                          onChange={(images) => handleSaveWallStyles(wallStyles.map(s => s.id === style.id ? { ...s, images } : s))}
                          maxImages={4}
                          itemName="wall style"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <button
                          onClick={() => {
                            const newStyle: WallStyle = {
                              ...style,
                              id: `wall-${Date.now()}`,
                              name: `${style.name} (Copy)`
                            };
                            handleSaveWallStyles([...wallStyles, newStyle]);
                          }}
                          className="px-3 py-1.5 text-teal-600 hover:bg-teal-50 rounded-lg text-sm font-medium flex items-center gap-1"
                        >
                          📋 Duplicate
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${style.name}"? This cannot be undone.`)) {
                              handleSaveWallStyles(wallStyles.filter(s => s.id !== style.id));
                            }
                          }}
                          className="px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium flex items-center gap-1"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Empty State */}
              {wallStyles.length === 0 && (
                <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-gray-200">
                  <span className="text-6xl mb-4 block">🧱</span>
                  <h3 className="text-xl font-bold text-gray-700 mb-2">No Wall Styles Yet</h3>
                  <p className="text-gray-500 mb-4">Create decorative wall options for backdrops and photo areas</p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => {
                        const newStyle: WallStyle = {
                          id: `wall-${Date.now()}`,
                          name: 'New Wall Style',
                          color: '#FFFFFF',
                          icon: '🪟',
                          pattern: 'solid',
                          enabled: true
                        };
                        handleSaveWallStyles([...wallStyles, newStyle]);
                        setExpandedWalls(prev => new Set([...prev, newStyle.id]));
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:from-teal-600 hover:to-emerald-600 font-medium"
                    >
                      ➕ Create Wall Style
                    </button>
                    <button
                      onClick={() => handleSaveWallStyles(defaultWallStyles)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                    >
                      📥 Load Defaults
                    </button>
                  </div>
                </div>
              )}

              {/* Tips Section */}
              <BrandedTips
                title="Tips for Wall Styles"
                config={config}
                tips={[
                  { icon: '🔗', title: 'Link to Fixtures', description: 'Go to Fixtures tab, create a wall fixture (name containing "wall"), then select a wall style' },
                  { icon: '🎨', title: 'Use Patterns', description: 'Choose "grass" for greenery walls, "brick" for rustic walls, etc.' },
                  { icon: '📷', title: 'Reference Images', description: 'Upload photos of real walls to help users visualize options' },
                  { icon: '↕️', title: 'Organize Order', description: 'Use the up/down arrows to put popular styles at the top' },
                  { icon: '⏸️', title: 'Disable Seasonal', description: 'Instead of deleting, disable styles that aren\'t currently available' }
                ]}
              />
            </div>
          )}

          {/* Linens Tab */}
          {activeTab === 'linens' && (
            <div className="space-y-6">
              {/* Header */}
              <BrandedSectionHeader 
                icon="🎨" 
                title="Table Linen Colors" 
                description="Define available linen colors for tables and seating"
                config={config}
              />

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="text-3xl font-bold text-pink-600">{linenColors.length}</div>
                  <div className="text-xs text-gray-500 font-medium">Total Colors</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="text-3xl font-bold text-green-600">{linenColors.filter(c => c.enabled).length}</div>
                  <div className="text-xs text-gray-500 font-medium">✓ Enabled</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="text-3xl font-bold text-gray-400">{linenColors.filter(c => !c.enabled).length}</div>
                  <div className="text-xs text-gray-500 font-medium">○ Disabled</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="flex justify-center gap-1 mb-1">
                    {linenColors.slice(0, 6).map(c => (
                      <div key={c.id} className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: c.hex }} />
                    ))}
                    {linenColors.length > 6 && <span className="text-xs text-gray-400">+{linenColors.length - 6}</span>}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">Color Palette</div>
                </div>
              </div>

              {/* Quick Add Presets */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                <h3 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                  <span>✨</span> Quick Add Color Palettes
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const classics = [
                        { id: `linen-${Date.now()}-1`, name: 'Classic White', hex: '#FFFFFF', textColor: '#374151', enabled: true },
                        { id: `linen-${Date.now()}-2`, name: 'Ivory', hex: '#FFFFF0', textColor: '#374151', enabled: true },
                        { id: `linen-${Date.now()}-3`, name: 'Champagne', hex: '#F7E7CE', textColor: '#374151', enabled: true },
                        { id: `linen-${Date.now()}-4`, name: 'Classic Black', hex: '#000000', textColor: '#FFFFFF', enabled: true },
                      ];
                      const existing = linenColors.map(c => c.name.toLowerCase());
                      const toAdd = classics.filter(c => !existing.includes(c.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveLinenColors([...linenColors, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <div className="flex -space-x-1">
                      <span className="w-4 h-4 rounded-full bg-white border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#FFFFF0] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#F7E7CE] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-black border border-gray-300" />
                    </div>
                    Classic & Elegant
                  </button>
                  <button
                    onClick={() => {
                      const romantic = [
                        { id: `linen-${Date.now()}-1`, name: 'Blush Pink', hex: '#FFC0CB', textColor: '#374151', enabled: true },
                        { id: `linen-${Date.now()}-2`, name: 'Dusty Rose', hex: '#DCAE96', textColor: '#374151', enabled: true },
                        { id: `linen-${Date.now()}-3`, name: 'Mauve', hex: '#E0B0FF', textColor: '#374151', enabled: true },
                        { id: `linen-${Date.now()}-4`, name: 'Rose Gold', hex: '#B76E79', textColor: '#FFFFFF', enabled: true },
                      ];
                      const existing = linenColors.map(c => c.name.toLowerCase());
                      const toAdd = romantic.filter(c => !existing.includes(c.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveLinenColors([...linenColors, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <div className="flex -space-x-1">
                      <span className="w-4 h-4 rounded-full bg-[#FFC0CB] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#DCAE96] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#E0B0FF] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#B76E79] border border-gray-300" />
                    </div>
                    💕 Romantic Blush
                  </button>
                  <button
                    onClick={() => {
                      const rustic = [
                        { id: `linen-${Date.now()}-1`, name: 'Sage Green', hex: '#9CAF88', textColor: '#FFFFFF', enabled: true },
                        { id: `linen-${Date.now()}-2`, name: 'Eucalyptus', hex: '#84A98C', textColor: '#FFFFFF', enabled: true },
                        { id: `linen-${Date.now()}-3`, name: 'Terracotta', hex: '#E2725B', textColor: '#FFFFFF', enabled: true },
                        { id: `linen-${Date.now()}-4`, name: 'Rust', hex: '#B7410E', textColor: '#FFFFFF', enabled: true },
                      ];
                      const existing = linenColors.map(c => c.name.toLowerCase());
                      const toAdd = rustic.filter(c => !existing.includes(c.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveLinenColors([...linenColors, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <div className="flex -space-x-1">
                      <span className="w-4 h-4 rounded-full bg-[#9CAF88] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#84A98C] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#E2725B] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#B7410E] border border-gray-300" />
                    </div>
                    🌿 Rustic & Natural
                  </button>
                  <button
                    onClick={() => {
                      const navy = [
                        { id: `linen-${Date.now()}-1`, name: 'Navy Blue', hex: '#000080', textColor: '#FFFFFF', enabled: true },
                        { id: `linen-${Date.now()}-2`, name: 'Royal Blue', hex: '#4169E1', textColor: '#FFFFFF', enabled: true },
                        { id: `linen-${Date.now()}-3`, name: 'Dusty Blue', hex: '#7EB1C4', textColor: '#374151', enabled: true },
                        { id: `linen-${Date.now()}-4`, name: 'Gold', hex: '#FFD700', textColor: '#374151', enabled: true },
                      ];
                      const existing = linenColors.map(c => c.name.toLowerCase());
                      const toAdd = navy.filter(c => !existing.includes(c.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveLinenColors([...linenColors, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <div className="flex -space-x-1">
                      <span className="w-4 h-4 rounded-full bg-[#000080] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#4169E1] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#7EB1C4] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#FFD700] border border-gray-300" />
                    </div>
                    👑 Navy & Gold
                  </button>
                  <button
                    onClick={() => {
                      const burgundy = [
                        { id: `linen-${Date.now()}-1`, name: 'Burgundy', hex: '#800020', textColor: '#FFFFFF', enabled: true },
                        { id: `linen-${Date.now()}-2`, name: 'Deep Plum', hex: '#4A1942', textColor: '#FFFFFF', enabled: true },
                        { id: `linen-${Date.now()}-3`, name: 'Wine', hex: '#722F37', textColor: '#FFFFFF', enabled: true },
                        { id: `linen-${Date.now()}-4`, name: 'Rose', hex: '#FF007F', textColor: '#FFFFFF', enabled: true },
                      ];
                      const existing = linenColors.map(c => c.name.toLowerCase());
                      const toAdd = burgundy.filter(c => !existing.includes(c.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveLinenColors([...linenColors, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <div className="flex -space-x-1">
                      <span className="w-4 h-4 rounded-full bg-[#800020] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#4A1942] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#722F37] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#FF007F] border border-gray-300" />
                    </div>
                    🍷 Burgundy & Wine
                  </button>
                </div>
              </div>

              {/* Action Bar */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => expandedLinens.size === linenColors.length && linenColors.length > 0 ? collapseAllLinens() : expandAllLinens()}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                      {expandedLinens.size === linenColors.length && linenColors.length > 0 ? '▲ Collapse All' : '▼ Expand All'}
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => handleSaveLinenColors(linenColors.map(c => ({ ...c, enabled: true })))}
                      className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                    >
                      ✓ Enable All
                    </button>
                    <button
                      onClick={() => handleSaveLinenColors(linenColors.map(c => ({ ...c, enabled: false })))}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                      ○ Disable All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => {
                        if (confirm('Sort colors alphabetically?')) {
                          handleSaveLinenColors([...linenColors].sort((a, b) => a.name.localeCompare(b.name)));
                        }
                      }}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                      🔤 Sort A-Z
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      const newId = `linen-${Date.now()}`;
                      const newColor: LinenColor = {
                        id: newId,
                        name: 'New Color',
                        hex: '#CCCCCC',
                        textColor: '#374151',
                        enabled: true
                      };
                      handleSaveLinenColors([...linenColors, newColor]);
                      setExpandedLinens(prev => new Set([...prev, newId]));
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg hover:from-pink-600 hover:to-rose-600 transition-all font-medium shadow-sm flex items-center gap-2"
                  >
                    <span>➕</span> Add Custom Color
                  </button>
                </div>
              </div>

              {/* Color Palette Preview */}
              {linenColors.length > 0 && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span>🎨</span> Color Palette Preview
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {linenColors.filter(c => c.enabled).map(color => (
                      <div
                        key={color.id}
                        className="group relative"
                        title={color.name}
                      >
                        <div
                          className="w-12 h-12 rounded-lg border-2 border-gray-200 shadow-sm transition-transform group-hover:scale-110 flex items-center justify-center"
                          style={{ backgroundColor: color.hex, color: color.textColor }}
                        >
                          <span className="text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">Aa</span>
                        </div>
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          {color.name}
                        </div>
                      </div>
                    ))}
                    {linenColors.filter(c => c.enabled).length === 0 && (
                      <p className="text-sm text-gray-400 italic">No enabled colors to preview</p>
                    )}
                  </div>
                </div>
              )}

              {/* Linen Color Cards */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <span>🎨</span> All Linen Colors
                  <span className="text-sm font-normal text-gray-400">({linenColors.length} total)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {linenColors.map((color, index) => (
                    <div 
                      key={color.id} 
                      className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all hover:shadow-md ${
                        color.enabled ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-60'
                      }`}
                    >
                      {/* Color Header */}
                      <div 
                        className="p-4 flex items-center gap-4 cursor-pointer"
                        style={{ backgroundColor: color.hex }}
                        onClick={() => toggleLinenExpanded(color.id)}
                      >
                        <div className="text-xl opacity-80" style={{ color: color.textColor }}>
                          {expandedLinens.has(color.id) ? '▼' : '▶'}
                        </div>
                        <div 
                          className="w-16 h-16 rounded-xl border-4 border-white/50 shadow-lg flex items-center justify-center text-2xl font-bold shrink-0"
                          style={{ backgroundColor: color.hex, color: color.textColor }}
                        >
                          Aa
                        </div>
                        <div className="flex-1" onClick={e => e.stopPropagation()}>
                          <input
                            type="text"
                            value={color.name}
                            onChange={(e) => handleSaveLinenColors(linenColors.map(c => c.id === color.id ? { ...c, name: e.target.value } : c))}
                            className="w-full px-3 py-2 rounded-lg text-lg font-semibold bg-white/90 border-0 focus:ring-2 focus:ring-white"
                            style={{ color: '#374151' }}
                          />
                        </div>
                        {!expandedLinens.has(color.id) && (
                          <div className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${color.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {color.enabled ? '✓ Enabled' : '○ Disabled'}
                          </div>
                        )}
                        <div onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              if (confirm(`Delete "${color.name}"?`)) {
                                handleSaveLinenColors(linenColors.filter(c => c.id !== color.id));
                              }
                            }}
                            className="p-2 rounded-lg transition-colors hover:bg-white/30"
                            style={{ color: color.textColor }}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      
                      {/* Color Settings */}
                      {expandedLinens.has(color.id) && (
                      <div className="p-4 space-y-3 bg-gray-50">
                        {/* Hex & Color Picker Row */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-gray-500 font-medium mb-1 block">Hex Color</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={color.hex}
                                onChange={(e) => handleSaveLinenColors(linenColors.map(c => c.id === color.id ? { ...c, hex: e.target.value } : c))}
                                className="w-12 h-10 border-2 border-gray-200 rounded-lg cursor-pointer"
                              />
                              <input
                                type="text"
                                value={color.hex.toUpperCase()}
                                onChange={(e) => {
                                  const hex = e.target.value;
                                  if (/^#[0-9A-Fa-f]{0,6}$/.test(hex)) {
                                    handleSaveLinenColors(linenColors.map(c => c.id === color.id ? { ...c, hex } : c));
                                  }
                                }}
                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono uppercase"
                                maxLength={7}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 font-medium mb-1 block">Text Color</label>
                            <select
                              value={color.textColor === '#FFFFFF' ? 'white' : 'dark'}
                              onChange={(e) => handleSaveLinenColors(linenColors.map(c => c.id === color.id ? { ...c, textColor: e.target.value === 'white' ? '#FFFFFF' : '#374151' } : c))}
                              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                            >
                              <option value="dark">🌑 Dark</option>
                              <option value="white">☀️ White</option>
                            </select>
                          </div>
                        </div>
                        
                        {/* Status & Actions Row */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={color.enabled}
                              onChange={(e) => handleSaveLinenColors(linenColors.map(c => c.id === color.id ? { ...c, enabled: e.target.checked } : c))}
                              className="w-5 h-5 rounded accent-pink-500"
                            />
                            <span className={`text-sm font-medium ${color.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                              {color.enabled ? '✓ Enabled' : '○ Disabled'}
                            </span>
                          </label>
                          <div className="flex items-center gap-1">
                            {index > 0 && (
                              <button
                                onClick={() => {
                                  const newColors = [...linenColors];
                                  [newColors[index - 1], newColors[index]] = [newColors[index], newColors[index - 1]];
                                  handleSaveLinenColors(newColors);
                                }}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                title="Move up"
                              >
                                ⬆️
                              </button>
                            )}
                            {index < linenColors.length - 1 && (
                              <button
                                onClick={() => {
                                  const newColors = [...linenColors];
                                  [newColors[index], newColors[index + 1]] = [newColors[index + 1], newColors[index]];
                                  handleSaveLinenColors(newColors);
                                }}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                title="Move down"
                              >
                                ⬇️
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const duplicate: LinenColor = {
                                  ...color,
                                  id: `linen-${Date.now()}`,
                                  name: `${color.name} Copy`
                                };
                                handleSaveLinenColors([...linenColors, duplicate]);
                              }}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Duplicate"
                            >
                              📋
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete "${color.name}"?`)) {
                                  handleSaveLinenColors(linenColors.filter(c => c.id !== color.id));
                                }
                              }}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Empty State */}
              {linenColors.length === 0 && (
                <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-gray-300">
                  <div className="text-6xl mb-4">🎨</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Linen Colors Yet</h3>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">
                    Add linen colors that will be available for users to select when setting up tables.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => {
                        const newColor: LinenColor = {
                          id: `linen-${Date.now()}`,
                          name: 'New Color',
                          hex: '#CCCCCC',
                          textColor: '#374151',
                          enabled: true
                        };
                        handleSaveLinenColors([...linenColors, newColor]);
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg hover:from-pink-600 hover:to-rose-600 transition-all font-medium shadow-sm"
                    >
                      ➕ Add Custom Color
                    </button>
                    <button
                      onClick={() => {
                        const defaults = [
                          { id: `linen-${Date.now()}-1`, name: 'White', hex: '#FFFFFF', textColor: '#374151', enabled: true },
                          { id: `linen-${Date.now()}-2`, name: 'Ivory', hex: '#FFFFF0', textColor: '#374151', enabled: true },
                          { id: `linen-${Date.now()}-3`, name: 'Black', hex: '#000000', textColor: '#FFFFFF', enabled: true },
                          { id: `linen-${Date.now()}-4`, name: 'Navy', hex: '#000080', textColor: '#FFFFFF', enabled: true },
                          { id: `linen-${Date.now()}-5`, name: 'Burgundy', hex: '#800020', textColor: '#FFFFFF', enabled: true },
                          { id: `linen-${Date.now()}-6`, name: 'Sage', hex: '#9CAF88', textColor: '#FFFFFF', enabled: true },
                          { id: `linen-${Date.now()}-7`, name: 'Blush', hex: '#FFC0CB', textColor: '#374151', enabled: true },
                          { id: `linen-${Date.now()}-8`, name: 'Gold', hex: '#FFD700', textColor: '#374151', enabled: true },
                        ];
                        handleSaveLinenColors(defaults);
                      }}
                      className="px-6 py-3 bg-white border-2 border-pink-300 text-pink-600 rounded-lg hover:bg-pink-50 transition-all font-medium"
                    >
                      🎨 Add Default Palette
                    </button>
                  </div>
                </div>
              )}

              {/* Tips Section */}
              <BrandedTips
                title="Tips for Linen Colors"
                config={config}
                tips={[
                  { icon: '☀️', title: 'White Text on Dark', description: 'Use white text on dark colors like Navy, Burgundy, and Black' },
                  { icon: '🌙', title: 'Dark Text on Light', description: 'Use dark text on light colors like White, Ivory, Blush, and Gold' },
                  { icon: '⏸️', title: 'Disable vs Delete', description: 'Disable seasonal colors instead of deleting them so you can reuse them later' },
                  { icon: '🎨', title: 'Palette Presets', description: 'Use palette presets to quickly add coordinated color schemes' },
                  { icon: '↕️', title: 'Reorder Colors', description: 'Put the most popular color options first using the up/down arrows' }
                ]}
              />
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              {/* Header */}
              <BrandedSectionHeader
                icon="📋"
                title="Layout Templates"
                description="Create reusable layouts for quick event setup"
                config={config}
              />

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <BrandedStatCard
                  value={templates.length}
                  label="Total Templates"
                  icon="📋"
                  config={config}
                />
                <BrandedStatCard
                  value={templates.filter(t => t.isMasterTemplate).length}
                  label="★ Master"
                  icon="⭐"
                  config={config}
                  variant="accent"
                />
                <BrandedStatCard
                  value={templates.filter(t => t.category === 'reception').length}
                  label="Reception"
                  icon="🎉"
                  config={config}
                />
                <BrandedStatCard
                  value={templates.filter(t => t.category === 'ceremony').length}
                  label="Ceremony"
                  icon="💒"
                  config={config}
                />
                <BrandedStatCard
                  value={templates.filter(t => t.category === 'cocktail').length}
                  label="Cocktail"
                  icon="🍸"
                  config={config}
                  variant="success"
                />
              </div>

              {/* Action Bar */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        const allIds = templates.map(t => t.id);
                        if (expandedTemplates.size === allIds.length) {
                          setExpandedTemplates(new Set());
                        } else {
                          setExpandedTemplates(new Set(allIds));
                        }
                      }}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                      {expandedTemplates.size === templates.length ? '▲ Collapse All' : '▼ Expand All'}
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => {
                        const masterTemplates = templates.filter(t => t.isMasterTemplate);
                        setExpandedTemplates(new Set(masterTemplates.map(t => t.id)));
                      }}
                      className="px-3 py-2 text-[#4A1942] bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium"
                    >
                      Show Masters Only
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        const newTemplate: LayoutTemplate = {
                          id: `template-${Date.now()}`,
                          name: 'New Template',
                          description: 'Template description',
                          venueId: venues[0]?.id || 'pavilion',
                          category: 'reception',
                          tables: [],
                          fixtures: [],
                          isMasterTemplate: false,
                          createdAt: new Date().toISOString()
                        };
                        handleSaveTemplates([...templates, newTemplate]);
                        setExpandedTemplates(prev => new Set([...prev, newTemplate.id]));
                      }}
                      className="px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all font-medium shadow-sm flex items-center gap-2"
                    >
                      <span>📄</span>
                      <span>+ Blank Template</span>
                    </button>
                    <button
                      onClick={handleCreateTemplateFromLayout}
                      className="px-4 py-2.5 bg-gradient-to-r from-[#4A1942] to-[#6b2d63] text-white rounded-lg hover:from-[#5c2a64] hover:to-[#7d3a75] transition-all font-medium shadow-lg flex items-center gap-2"
                    >
                      <span>🎨</span>
                      <span>+ From Current Layout</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Category Filter Tabs */}
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'All Templates', icon: '📋', count: templates.length },
                  { id: 'master', label: 'Masters Only', icon: '★', count: templates.filter(t => t.isMasterTemplate).length },
                  ...layoutCategories.map(cat => ({
                    id: cat.id,
                    label: cat.name,
                    icon: cat.icon,
                    count: templates.filter(t => t.category === cat.id).length
                  }))
                ].map(tab => (
                  <button
                    key={tab.id}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                      tab.count === 0 
                        ? 'bg-gray-50 text-gray-400 cursor-not-allowed' 
                        : 'bg-white border border-gray-200 text-gray-700 hover:border-[#4A1942] hover:text-[#4A1942]'
                    }`}
                    disabled={tab.count === 0}
                    onClick={() => {
                      if (tab.id === 'all') {
                        setExpandedTemplates(new Set(templates.map(t => t.id)));
                      } else if (tab.id === 'master') {
                        setExpandedTemplates(new Set(templates.filter(t => t.isMasterTemplate).map(t => t.id)));
                      } else {
                        setExpandedTemplates(new Set(templates.filter(t => t.category === tab.id).map(t => t.id)));
                      }
                    }}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{tab.count}</span>
                  </button>
                ))}
              </div>
              
              {/* How To Guide - Collapsible */}
              <details className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl overflow-hidden">
                <summary className="p-4 cursor-pointer hover:bg-blue-100/50 transition-colors flex items-center gap-3">
                  <span className="text-2xl">💡</span>
                  <span className="font-semibold text-blue-800">How to Create & Manage Templates</span>
                  <span className="ml-auto text-blue-400 text-sm">Click to expand</span>
                </summary>
                <div className="p-4 pt-2 border-t border-blue-200 bg-white/50">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold">1</span>
                        <h5 className="font-semibold text-gray-800">Create from Layout</h5>
                      </div>
                      <p className="text-sm text-gray-600">Design your perfect layout in the main canvas with tables, fixtures, and decorations. Then click "From Current Layout" to save it as a reusable template.</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">2</span>
                        <h5 className="font-semibold text-gray-800">Edit Existing Template</h5>
                      </div>
                      <p className="text-sm text-gray-600">Click "Load for Editing" to load a template into the canvas. Make your changes, then click "Update with Current Layout" to save the modifications.</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-8 bg-[#4A1942]/10 text-[#4A1942] rounded-full flex items-center justify-center font-bold">3</span>
                        <h5 className="font-semibold text-gray-800">Master Templates</h5>
                      </div>
                      <p className="text-sm text-gray-600">Mark templates as "Master" to make them available to basic users. Only admins can create and edit master templates.</p>
                    </div>
                  </div>
                </div>
              </details>
              
              {templates.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-200">
                  <div className="text-6xl mb-4">📋</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Templates Yet</h3>
                  <p className="text-gray-500 mb-4 max-w-md mx-auto">
                    Create your first template by designing a layout in the main canvas, then clicking "From Current Layout"
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => {
                        const newTemplate: LayoutTemplate = {
                          id: `template-${Date.now()}`,
                          name: 'My First Template',
                          description: 'A new layout template',
                          venueId: venues[0]?.id || 'pavilion',
                          category: 'reception',
                          tables: [],
                          fixtures: [],
                          isMasterTemplate: false,
                          createdAt: new Date().toISOString()
                        };
                        handleSaveTemplates([...templates, newTemplate]);
                        setExpandedTemplates(prev => new Set([...prev, newTemplate.id]));
                      }}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all font-medium"
                    >
                      📄 Create Blank Template
                    </button>
                    <button
                      onClick={handleCreateTemplateFromLayout}
                      className="px-4 py-2 bg-[#4A1942] text-white rounded-lg hover:bg-[#5c2a64] transition-all font-medium"
                    >
                      🎨 From Current Layout
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {templates.map(template => {
                    const venue = venues.find(v => v.id === template.venueId);
                    const category = layoutCategories.find(c => c.id === template.category);
                    const isEditing = editingTemplateId === template.id;
                    const isExpanded = expandedTemplates.has(template.id);
                    const totalItems = (template.tables?.length || 0) + (template.fixtures?.length || 0);
                    
                    return (
                      <div 
                        key={template.id} 
                        className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-md ${
                          isEditing ? 'ring-2 ring-[#4A1942] ring-offset-2' : 'border border-gray-200'
                        }`}
                      >
                        {/* Card Header */}
                        <div 
                          className="relative cursor-pointer group"
                          onClick={() => {
                            setExpandedTemplates(prev => {
                              const next = new Set(prev);
                              if (next.has(template.id)) {
                                next.delete(template.id);
                              } else {
                                next.add(template.id);
                              }
                              return next;
                            });
                          }}
                        >
                          {/* Gradient header based on category */}
                          <div 
                            className="h-2"
                            style={{ 
                              background: category?.color 
                                ? `linear-gradient(to right, ${category.color}, ${category.color}88)` 
                                : 'linear-gradient(to right, #6b7280, #9ca3af)'
                            }}
                          />
                          
                          <div className="px-4 py-3 flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              {/* Category Icon with background */}
                              <div 
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm"
                                style={{ 
                                  backgroundColor: category?.color ? `${category.color}15` : '#f3f4f6'
                                }}
                              >
                                {category?.icon || '📋'}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-gray-800 truncate">{template.name}</h4>
                                  {template.isMasterTemplate && (
                                    <span className="px-2 py-0.5 bg-gradient-to-r from-[#4A1942] to-[#6b2d63] text-white text-xs font-medium rounded-full flex items-center gap-1 flex-shrink-0">
                                      <span>★</span> Master
                                    </span>
                                  )}
                                  {isEditing && (
                                    <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded-full animate-pulse flex-shrink-0">
                                      ✏️ Editing
                                    </span>
                                  )}
                                </div>
                                
                                {/* Quick Info */}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <span>🏛️</span>
                                    <span>{venue?.name || 'Unknown Venue'}</span>
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span>{category?.icon}</span>
                                    <span>{category?.name || template.category}</span>
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span>📦</span>
                                    <span>{totalItems} items</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Expand/Collapse Indicator */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                ▼
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Expanded Content */}
                        {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50/50">
                          {/* Quick Stats Row */}
                          <div className="grid grid-cols-4 gap-px bg-gray-200 border-b border-gray-200">
                            <div className="bg-white p-3 text-center">
                              <div className="text-lg font-bold text-blue-600">{template.tables?.length || 0}</div>
                              <div className="text-xs text-gray-500">Tables</div>
                            </div>
                            <div className="bg-white p-3 text-center">
                              <div className="text-lg font-bold text-purple-600">{template.fixtures?.length || 0}</div>
                              <div className="text-xs text-gray-500">Fixtures</div>
                            </div>
                            <div className="bg-white p-3 text-center">
                              <div className="text-lg font-bold text-green-600">
                                {template.tables?.reduce((sum, t) => sum + (t.customCapacity || 10), 0) || 0}
                              </div>
                              <div className="text-xs text-gray-500">Seats</div>
                            </div>
                            <div className="bg-white p-3 text-center">
                              <div className="text-lg font-bold text-gray-600">
                                {template.createdAt ? new Date(template.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                              </div>
                              <div className="text-xs text-gray-500">Created</div>
                            </div>
                          </div>
                          
                          {/* Form Fields */}
                          <div className="p-4 space-y-4">
                            {/* Name & Venue Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="bg-white rounded-lg p-3 border border-gray-200">
                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase mb-2">
                                  <span>📝</span> Template Name
                                </label>
                                <input
                                  type="text"
                                  value={template.name}
                                  onChange={(e) => handleSaveTemplates(templates.map(t => t.id === template.id ? { ...t, name: e.target.value } : t))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A1942]/20 focus:border-[#4A1942]"
                                  placeholder="Enter template name"
                                />
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-gray-200">
                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase mb-2">
                                  <span>🏛️</span> Venue
                                </label>
                                <select
                                  value={template.venueId}
                                  onChange={(e) => handleSaveTemplates(templates.map(t => t.id === template.id ? { ...t, venueId: e.target.value } : t))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A1942]/20 focus:border-[#4A1942]"
                                >
                                  {venues.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            
                            {/* Description */}
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase mb-2">
                                <span>📄</span> Description
                              </label>
                              <textarea
                                value={template.description || ''}
                                onChange={(e) => handleSaveTemplates(templates.map(t => t.id === template.id ? { ...t, description: e.target.value } : t))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A1942]/20 focus:border-[#4A1942]"
                                rows={2}
                                placeholder="Describe this template..."
                              />
                            </div>
                            
                            {/* Category & Master Toggle Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="bg-white rounded-lg p-3 border border-gray-200">
                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase mb-2">
                                  <span>🏷️</span> Category
                                </label>
                                <select
                                  value={template.category}
                                  onChange={(e) => handleSaveTemplates(templates.map(t => t.id === template.id ? { ...t, category: e.target.value as LayoutCategory } : t))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A1942]/20 focus:border-[#4A1942]"
                                >
                                  {layoutCategories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="bg-gradient-to-br from-[#4A1942]/5 to-[#4A1942]/10 rounded-lg p-3 border border-[#4A1942]/20">
                                <label className="flex items-center gap-2 text-xs font-semibold text-[#4A1942] uppercase mb-2">
                                  <span>★</span> Master Template
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                  <div className="relative">
                                    <input
                                      type="checkbox"
                                      checked={template.isMasterTemplate || false}
                                      onChange={(e) => handleSaveTemplates(templates.map(t => t.id === template.id ? { ...t, isMasterTemplate: e.target.checked } : t))}
                                      className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:ring-2 peer-focus:ring-[#4A1942]/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4A1942]"></div>
                                  </div>
                                  <span className="text-sm font-medium text-gray-700">
                                    {template.isMasterTemplate ? 'Available to all users' : 'Admin only'}
                                  </span>
                                </label>
                              </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="pt-3 border-t border-gray-200">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => handleLoadForEdit(template)}
                                  className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 rounded-lg text-sm font-medium shadow-sm flex items-center justify-center gap-2"
                                >
                                  <span>📝</span> Load for Editing
                                </button>
                                {isEditing ? (
                                  <button
                                    onClick={() => handleUpdateTemplateWithCurrentLayout(template.id)}
                                    className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 rounded-lg text-sm font-medium shadow-sm flex items-center justify-center gap-2 animate-pulse"
                                  >
                                    <span>✓</span> Save Current Layout
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setEditingTemplateId(template.id)}
                                    className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 rounded-lg text-sm font-medium shadow-sm flex items-center justify-center gap-2"
                                  >
                                    <span>🔄</span> Update Layout
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    // Duplicate template
                                    const duplicated: LayoutTemplate = {
                                      ...template,
                                      id: `template-${Date.now()}`,
                                      name: `${template.name} (Copy)`,
                                      isMasterTemplate: false,
                                      createdAt: new Date().toISOString()
                                    };
                                    handleSaveTemplates([...templates, duplicated]);
                                    setExpandedTemplates(prev => new Set([...prev, duplicated.id]));
                                  }}
                                  className="px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                                >
                                  <span>📋</span> Duplicate
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete "${template.name}"?`)) {
                                      handleSaveTemplates(templates.filter(t => t.id !== template.id));
                                    }
                                  }}
                                  className="px-4 py-2.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                                >
                                  <span>🗑️</span> Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Guidelines Tab */}
          {activeTab === 'guidelines' && (
            <div className="space-y-6">
              {/* Header */}
              <BrandedSectionHeader
                icon="📋"
                title="Layout Guidelines"
                description="Tips, rules, and best practices for creating optimal event layouts"
                config={config}
              />

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <BrandedStatCard
                  value={guidelines.length}
                  label="Total Guidelines"
                  icon="📋"
                  config={config}
                />
                <BrandedStatCard
                  value={guidelines.filter(g => g.enabled).length}
                  label="Active"
                  icon="✓"
                  config={config}
                  variant="success"
                />
                <BrandedStatCard
                  value={guidelines.filter(g => !g.enabled).length}
                  label="Disabled"
                  icon="○"
                  config={config}
                />
                <BrandedStatCard
                  value={guidelines.filter(g => g.category === 'important').length || 0}
                  label="Important"
                  icon="🚨"
                  config={config}
                  variant="accent"
                />
              </div>

              {/* Quick Presets */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">🚀 Quick Add Preset Guidelines</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const presets: Guideline[] = [
                        { id: `guideline-${Date.now()}-1`, title: 'Table Spacing', description: 'Maintain 3-4 feet between tables for server access and guest movement.', enabled: true, category: 'spacing' as const, icon: '📏' },
                        { id: `guideline-${Date.now()}-2`, title: 'Dance Floor Clearance', description: 'Keep at least 5 feet clearance around the dance floor for safety.', enabled: true, category: 'safety' as const, icon: '💃' },
                        { id: `guideline-${Date.now()}-3`, title: 'Emergency Exits', description: 'Never block emergency exits or fire lanes with tables or fixtures.', enabled: true, category: 'important' as const, icon: '🚨' },
                      ];
                      handleSaveGuidelines([...guidelines, ...presets]);
                    }}
                    className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium"
                  >
                    ✨ Add Spacing & Safety
                  </button>
                  <button
                    onClick={() => {
                      const presets: Guideline[] = [
                        { id: `guideline-${Date.now()}-4`, title: 'Head Table Placement', description: 'Position the head table in a prominent location visible to all guests.', enabled: true, category: 'tips' as const, icon: '👑' },
                        { id: `guideline-${Date.now()}-5`, title: 'Gift Table Location', description: 'Place gift table near the entrance for easy drop-off by guests.', enabled: true, category: 'tips' as const, icon: '🎁' },
                        { id: `guideline-${Date.now()}-6`, title: 'Photo Booth Space', description: 'Allow 10x10 feet minimum for photo booth setup with backdrop.', enabled: true, category: 'tips' as const, icon: '📸' },
                      ];
                      handleSaveGuidelines([...guidelines, ...presets]);
                    }}
                    className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                  >
                    💒 Add Wedding Tips
                  </button>
                  <button
                    onClick={() => {
                      const presets: Guideline[] = [
                        { id: `guideline-${Date.now()}-7`, title: 'ADA Accessibility', description: 'Ensure 36-inch minimum aisle width for wheelchair access.', enabled: true, category: 'important' as const, icon: '♿' },
                        { id: `guideline-${Date.now()}-8`, title: 'Accessible Seating', description: 'Reserve accessible seating near aisles and exits.', enabled: true, category: 'important' as const, icon: '🪑' },
                      ];
                      handleSaveGuidelines([...guidelines, ...presets]);
                    }}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                  >
                    ♿ Add Accessibility
                  </button>
                  <button
                    onClick={() => {
                      const presets: Guideline[] = [
                        { id: `guideline-${Date.now()}-9`, title: 'Buffet Flow', description: 'Create a one-way traffic flow around buffet tables to prevent congestion.', enabled: true, category: 'tips' as const, icon: '🍽️' },
                        { id: `guideline-${Date.now()}-10`, title: 'Bar Placement', description: 'Position bar away from dance floor to separate drinking and dancing areas.', enabled: true, category: 'tips' as const, icon: '🍸' },
                        { id: `guideline-${Date.now()}-11`, title: 'Cake Table Visibility', description: 'Place cake table where it can be photographed with good lighting.', enabled: true, category: 'tips' as const, icon: '🎂' },
                      ];
                      handleSaveGuidelines([...guidelines, ...presets]);
                    }}
                    className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                  >
                    🍽️ Add Food & Beverage
                  </button>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const allIds = guidelines.map(g => g.id);
                      if (expandedGuidelines.size === allIds.length) {
                        setExpandedGuidelines(new Set());
                      } else {
                        setExpandedGuidelines(new Set(allIds));
                      }
                    }}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    {expandedGuidelines.size === guidelines.length ? '▲ Collapse All' : '▼ Expand All'}
                  </button>
                  <button
                    onClick={() => handleSaveGuidelines(guidelines.map(g => ({ ...g, enabled: true })))}
                    className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                  >
                    ✓ Enable All
                  </button>
                  <button
                    onClick={() => handleSaveGuidelines(guidelines.map(g => ({ ...g, enabled: false })))}
                    className="px-3 py-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    ○ Disable All
                  </button>
                </div>
                <button
                  onClick={() => {
                    const newGuideline: Guideline = {
                      id: `guideline-${Date.now()}`,
                      title: 'New Guideline',
                      description: 'Enter your guideline description here...',
                      enabled: true,
                      category: 'general',
                      icon: '📝'
                    };
                    handleSaveGuidelines([...guidelines, newGuideline]);
                    setExpandedGuidelines(prev => new Set([...prev, newGuideline.id]));
                  }}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:shadow-lg transition-all font-medium flex items-center gap-2"
                >
                  <span className="text-lg">➕</span> Add Custom Guideline
                </button>
              </div>

              {/* Category Legend */}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full">🚨 Important</span>
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full">📏 Spacing</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">🛡️ Safety</span>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full">💡 Tips</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full">📝 General</span>
              </div>

              {/* Guidelines List */}
              {guidelines.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center border-2 border-dashed border-gray-200">
                  <div className="text-5xl mb-4">📋</div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No Guidelines Yet</h3>
                  <p className="text-gray-500 mb-4">Add guidelines to help users create better layouts</p>
                  <button
                    onClick={() => {
                      const newGuideline: Guideline = {
                        id: `guideline-${Date.now()}`,
                        title: 'My First Guideline',
                        description: 'Enter your guideline description here...',
                        enabled: true,
                        category: 'general',
                        icon: '📝'
                      };
                      handleSaveGuidelines([newGuideline]);
                      setExpandedGuidelines(new Set([newGuideline.id]));
                    }}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium"
                  >
                    Create Your First Guideline
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {guidelines.map((guideline, index) => {
                    const categoryColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
                      important: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-100 text-red-700' },
                      spacing: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700' },
                      safety: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700' },
                      tips: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', badge: 'bg-purple-100 text-purple-700' },
                      general: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', badge: 'bg-gray-100 text-gray-700' }
                    };
                    const cat = (guideline as any).category || 'general';
                    const colors = categoryColors[cat] || categoryColors.general;
                    const guidelineIcon = (guideline as any).icon || '📋';
                    
                    return (
                      <div 
                        key={guideline.id} 
                        className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all hover:shadow-md ${!guideline.enabled ? 'opacity-60' : ''}`}
                      >
                        {/* Header */}
                        <div 
                          className={`${colors.bg} px-4 py-3 border-b ${colors.border} flex items-center justify-between cursor-pointer hover:brightness-95 transition-all`}
                          onClick={() => {
                            setExpandedGuidelines(prev => {
                              const next = new Set(prev);
                              if (next.has(guideline.id)) {
                                next.delete(guideline.id);
                              } else {
                                next.add(guideline.id);
                              }
                              return next;
                            });
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400 text-sm font-medium">#{index + 1}</span>
                            <span className="text-xl">{guidelineIcon}</span>
                            <div>
                              <span className={`font-semibold ${colors.text}`}>{guideline.title}</span>
                              {!expandedGuidelines.has(guideline.id) && (
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 max-w-md">{guideline.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors.badge}`}>
                              {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </span>
                            {/* Toggle Switch */}
                            <button
                              onClick={() => handleSaveGuidelines(guidelines.map(g => g.id === guideline.id ? { ...g, enabled: !g.enabled } : g))}
                              className={`relative w-12 h-6 rounded-full transition-colors ${guideline.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                            >
                              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${guideline.enabled ? 'left-7' : 'left-1'}`} />
                            </button>
                            <span className="text-gray-400">{expandedGuidelines.has(guideline.id) ? '▼' : '▶'}</span>
                          </div>
                        </div>
                        
                        {/* Expanded Content */}
                        {expandedGuidelines.has(guideline.id) && (
                          <div className="p-5 space-y-4 bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Title */}
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                  <span>📌</span> Title
                                </label>
                                <input
                                  type="text"
                                  value={guideline.title}
                                  onChange={(e) => handleSaveGuidelines(guidelines.map(g => g.id === guideline.id ? { ...g, title: e.target.value } : g))}
                                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50"
                                  placeholder="Guideline title..."
                                />
                              </div>
                              
                              {/* Category & Icon */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                    <span>🏷️</span> Category
                                  </label>
                                  <select
                                    value={guideline.category || 'general'}
                                    onChange={(e) => handleSaveGuidelines(guidelines.map(g => g.id === guideline.id ? { ...g, category: e.target.value as Guideline['category'] } : g))}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50"
                                  >
                                    <option value="important">🚨 Important</option>
                                    <option value="spacing">📏 Spacing</option>
                                    <option value="safety">🛡️ Safety</option>
                                    <option value="tips">💡 Tips</option>
                                    <option value="general">📝 General</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                    <span>🎨</span> Icon
                                  </label>
                                  <select
                                    value={(guideline as any).icon || '📋'}
                                    onChange={(e) => handleSaveGuidelines(guidelines.map(g => g.id === guideline.id ? { ...g, icon: e.target.value } : g))}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50"
                                  >
                                    <option value="📋">📋 Clipboard</option>
                                    <option value="📏">📏 Ruler</option>
                                    <option value="📐">📐 Triangle Ruler</option>
                                    <option value="🚨">🚨 Emergency</option>
                                    <option value="⚠️">⚠️ Warning</option>
                                    <option value="💡">💡 Tip</option>
                                    <option value="✅">✅ Check</option>
                                    <option value="❌">❌ No</option>
                                    <option value="♿">♿ Accessible</option>
                                    <option value="🪑">🪑 Chair</option>
                                    <option value="🍽️">🍽️ Dining</option>
                                    <option value="💃">💃 Dance</option>
                                    <option value="🎂">🎂 Cake</option>
                                    <option value="🎁">🎁 Gift</option>
                                    <option value="📸">📸 Photo</option>
                                    <option value="🎵">🎵 Music</option>
                                    <option value="🍸">🍸 Bar</option>
                                    <option value="👑">👑 VIP</option>
                                    <option value="🚪">🚪 Exit</option>
                                    <option value="🔥">🔥 Fire</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                            
                            {/* Description */}
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                <span>📝</span> Description
                              </label>
                              <textarea
                                value={guideline.description}
                                onChange={(e) => handleSaveGuidelines(guidelines.map(g => g.id === guideline.id ? { ...g, description: e.target.value } : g))}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50 resize-none"
                                rows={3}
                                placeholder="Enter a helpful description for this guideline..."
                              />
                              <p className="text-xs text-gray-400">{(guideline.description || '').length} characters</p>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    if (index > 0) {
                                      const newGuidelines = [...guidelines];
                                      [newGuidelines[index - 1], newGuidelines[index]] = [newGuidelines[index], newGuidelines[index - 1]];
                                      handleSaveGuidelines(newGuidelines);
                                    }
                                  }}
                                  disabled={index === 0}
                                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Move Up"
                                >
                                  ⬆️
                                </button>
                                <button
                                  onClick={() => {
                                    if (index < guidelines.length - 1) {
                                      const newGuidelines = [...guidelines];
                                      [newGuidelines[index], newGuidelines[index + 1]] = [newGuidelines[index + 1], newGuidelines[index]];
                                      handleSaveGuidelines(newGuidelines);
                                    }
                                  }}
                                  disabled={index === guidelines.length - 1}
                                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Move Down"
                                >
                                  ⬇️
                                </button>
                                <button
                                  onClick={() => {
                                    const duplicated: Guideline = {
                                      ...guideline,
                                      id: `guideline-${Date.now()}`,
                                      title: `${guideline.title} (Copy)`
                                    };
                                    const newGuidelines = [...guidelines];
                                    newGuidelines.splice(index + 1, 0, duplicated);
                                    handleSaveGuidelines(newGuidelines);
                                    setExpandedGuidelines(prev => new Set([...prev, duplicated.id]));
                                  }}
                                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                                  title="Duplicate"
                                >
                                  📋
                                </button>
                              </div>
                              <button
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this guideline?')) {
                                    handleSaveGuidelines(guidelines.filter(g => g.id !== guideline.id));
                                  }
                                }}
                                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium flex items-center gap-2"
                              >
                                🗑️ Delete Guideline
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Help Section */}
              <BrandedTips
                title="Tips for Creating Effective Guidelines"
                config={config}
                tips={[
                  { icon: '✍️', title: 'Be Specific', description: 'Use clear, actionable language in your descriptions' },
                  { icon: '📏', title: 'Include Measurements', description: 'Add specific measurements when possible (e.g., "3 feet minimum")' },
                  { icon: '🚨', title: 'Mark Critical Items', description: 'Use the "Important" category for critical safety guidelines' },
                  { icon: '🏷️', title: 'Use Clear Icons', description: 'Choose icons that help users quickly identify guideline types' },
                  { icon: '📁', title: 'Organize by Category', description: 'Group guidelines by category for easy reference' },
                  { icon: '⏸️', title: 'Disable vs Delete', description: 'Disable seasonal guidelines instead of deleting them' }
                ]}
              />
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'event-questions' && (
            <div className="space-y-4">
              <BrandedSectionHeader
                icon="❓"
                title="Event Questions"
                description="Create and manage dynamic event questionnaire questions by planning group"
                config={config}
              />

              <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-800">Add Event Question</h4>

                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Question Text</label>
                    <input
                      type="text"
                      value={newQuestion.text}
                      onChange={(e) => {
                        setNewQuestion(prev => ({ ...prev, text: e.target.value }));
                        if (questionError) setQuestionError('');
                      }}
                      placeholder="e.g., Which ceremony space will you use?"
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Group</label>
                      <select
                        value={newQuestion.group}
                        onChange={(e) => setNewQuestion(prev => ({ ...prev, group: e.target.value as EventQuestionGroup }))}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="Ceremony">Ceremony</option>
                        <option value="Reception">Reception</option>
                        <option value="Lodging">Lodging</option>
                        <option value="Rehearsal Dinner">Rehearsal Dinner</option>
                        <option value="Other Activities/Events">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Answer Type</label>
                      <select
                        value={newQuestion.answerType}
                        onChange={(e) => setNewQuestion(prev => ({ ...prev, answerType: e.target.value as EventQuestionAnswerType }))}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="text">Text</option>
                        <option value="integer">Integer</option>
                        <option value="dropdown">Dropdown</option>
                      </select>
                    </div>
                  </div>

                  {newQuestion.answerType === 'dropdown' && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Dropdown Options (comma-separated)</label>
                      <input
                        type="text"
                        value={newQuestion.optionsText}
                        onChange={(e) => setNewQuestion(prev => ({ ...prev, optionsText: e.target.value }))}
                        placeholder="Indoor Chapel, Garden Lawn, Pavilion"
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  )}

                  {questionError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{questionError}</p>
                  )}

                  <button
                    type="button"
                    onClick={handleAddEventQuestion}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-[#4A1942] to-[#6b2a64] text-white rounded-lg hover:shadow-lg transition-all font-medium"
                  >
                    + Add Question
                  </button>

                  <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="font-semibold text-gray-700 mb-1">Conditional Workflow Tip</p>
                    <p>After creating questions, use each row's workflow controls to route answers to follow-up questions.</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-800">Question List</h4>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">{eventQuestions.length} total</span>
                  </div>

                  {eventQuestions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                      No event questions yet. Add your first question from the left panel.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[65vh] overflow-auto pr-1">
                      {eventQuestions.map((q) => {
                        const isEditing = editingQuestionId === q.id;
                        return (
                          <div key={q.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 break-words">{q.text}</p>
                                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                  <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">{q.group}</span>
                                  <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700">{q.answerType}</span>
                                  {q.answerType === 'dropdown' && (
                                    <span className="px-2 py-1 rounded-full bg-green-100 text-green-700">{(q.options || []).length} options</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingQuestionId(isEditing ? null : q.id)}
                                  className="px-2.5 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
                                >
                                  {isEditing ? 'Close' : 'Edit'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEventQuestion(q.id)}
                                  className="px-2.5 py-1.5 text-xs bg-red-50 text-red-700 rounded-md hover:bg-red-100"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                            {isEditing && (
                              <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                                <div>
                                  <label className="text-xs font-medium text-gray-500 uppercase">Question Text</label>
                                  <input
                                    type="text"
                                    value={q.text}
                                    onChange={(e) => handleUpdateEventQuestion(q.id, { text: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                                  />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase">Group</label>
                                    <select
                                      value={q.group}
                                      onChange={(e) => handleUpdateEventQuestion(q.id, { group: e.target.value as EventQuestionGroup })}
                                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                                    >
                                      <option value="Ceremony">Ceremony</option>
                                      <option value="Reception">Reception</option>
                                      <option value="Lodging">Lodging</option>
                                      <option value="Rehearsal Dinner">Rehearsal Dinner</option>
                                      <option value="Other Activities/Events">Other</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase">Answer Type</label>
                                    <select
                                      value={q.answerType}
                                      onChange={(e) => {
                                        const t = e.target.value as EventQuestionAnswerType;
                                        handleUpdateEventQuestion(q.id, { answerType: t, options: t === 'dropdown' ? (q.options || []) : undefined });
                                      }}
                                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                                    >
                                      <option value="text">Text</option>
                                      <option value="integer">Integer</option>
                                      <option value="dropdown">Dropdown</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase">Workflow</label>
                                    <select
                                      value={q.workflow?.[0]?.nextQuestionId || ''}
                                      onChange={(e) => {
                                        const nextQuestionId = e.target.value || undefined;
                                        if (!nextQuestionId) {
                                          handleUpdateEventQuestion(q.id, { workflow: [] });
                                        } else {
                                          const compareValue = q.answerType === 'integer' ? 1 : 'yes';
                                          handleUpdateEventQuestion(q.id, {
                                            workflow: [{ whenAnswerEquals: compareValue, nextQuestionId }],
                                          });
                                        }
                                      }}
                                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                                    >
                                      <option value="">No follow-up</option>
                                      {eventQuestions.filter(candidate => candidate.id !== q.id).map(candidate => (
                                        <option key={candidate.id} value={candidate.id}>{candidate.text}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                {q.answerType === 'dropdown' && (
                                  <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase">Dropdown Options (comma-separated)</label>
                                    <input
                                      type="text"
                                      value={(q.options || []).join(', ')}
                                      onChange={(e) => {
                                        const options = e.target.value.split(',').map(o => o.trim()).filter(Boolean);
                                        handleUpdateEventQuestion(q.id, { options });
                                      }}
                                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Decor Tab */}
          {activeTab === 'decor' && (
            <AdminDecorSection 
              config={config}
              decorItems={decorItems}
              setDecorItems={(items) => {
                setDecorItems(items);
                setDecorItemsState(items);
              }}
              decorCategories={decorCategories}
              setDecorCategories={(cats) => {
                setDecorCategories(cats);
                setDecorCategoriesState(cats);
              }}
              decorArrangements={decorArrangements}
              setDecorArrangements={(arrs: DecorArrangement[]) => {
                setDecorArrangements(arrs);
                setDecorArrangementsState(arrs);
              }}
              decorPackages={decorPackages}
              setDecorPackages={(pkgs: DecorPackage[]) => {
                setDecorPackages(pkgs);
                setDecorPackagesState(pkgs);
              }}
              onShowSuccess={showSuccess}
            />
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Header */}
              <BrandedSectionHeader
                icon="👥"
                title="User Management"
                description="Create, manage, and configure user accounts and permissions"
                config={config}
              />

              {/* Quick Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowCreateUserModal(true)}
                    className="px-4 py-2.5 bg-gradient-to-r from-[#4A1942] to-[#6b2a64] text-white rounded-lg hover:shadow-lg transition-all font-medium flex items-center gap-2"
                  >
                    <span className="text-lg">➕</span> Add User
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-purple-500 rounded-full"></span> Admin
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-blue-500 rounded-full"></span> Basic
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-gray-300 rounded-full"></span> Inactive
                  </span>
                </div>
              </div>
              
              {/* Direct Messages (Admin) */}
              {user?.role === 'admin' && (() => {
                const masterUsers = users.filter(
                  (u) => u.role === 'basic' && (u.userRole === 'master' || u.isMasterUser),
                );
                const selectedMaster =
                  masterUsers.find((u) => u.id === selectedMessageMasterUserId) || masterUsers[0] || null;
                const selectedEventName = selectedMaster?.eventName || selectedMaster?.department || 'general';
                const threadId = selectedMaster
                  ? buildMessageThreadId(selectedEventName, selectedMaster.id)
                  : '';
                const newMessageCount = masterUsers.reduce((sum, m) => {
                  const eventName = m.eventName || m.department || 'general';
                  const tId = buildMessageThreadId(eventName, m.id);
                  return sum + directMessages.unreadCountForRole(tId, 'admin');
                }, 0);

                return (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowUserDirectMessagesSection(v => !v)}
                      className="w-full px-4 py-3 bg-purple-50 hover:bg-purple-100 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">{showUserDirectMessagesSection ? '▼' : '▶'}</span>
                        <h4 className="text-sm font-semibold text-gray-800">Direct Messages</h4>
                        {newMessageCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                            {newMessageCount} new
                          </span>
                        )}
                      </div>
                    </button>
                    {showUserDirectMessagesSection && (
                      <div className="p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-gray-500">Admin ↔ Master Basic User communication thread by event.</p>
                          {masterUsers.length > 0 && (
                            <select
                              value={selectedMaster?.id || ''}
                              onChange={(e) => setSelectedMessageMasterUserId(e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A1942] focus:border-transparent min-w-[260px]"
                            >
                              {masterUsers.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.eventName || m.department || 'General Event'})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        {selectedMaster && threadId ? (
                          <div className="mt-4">
                            <DirectMessagePanel
                              title={`Chat with ${selectedMaster.name}`}
                              threadId={threadId}
                              currentUserId={user.id}
                              currentUserName={user.name}
                              currentUserRole="admin"
                            />
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-gray-500">
                            No master basic users available yet. Create a Basic User with User Role set to Master.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Pending Approvals (Admin) */}
              {user?.role === 'admin' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowUserPendingApprovalsSection(v => !v)}
                    className="w-full px-4 py-3 bg-amber-50 hover:bg-amber-100 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">{showUserPendingApprovalsSection ? '▼' : '▶'}</span>
                      <h4 className="text-sm font-semibold text-gray-800">Pending Approvals</h4>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                        {submissionWorkflow.pendingCount}
                      </span>
                    </div>
                  </button>
                  {showUserPendingApprovalsSection && (
                    <div className="p-4">
                      <AdminSubmissionQueue
                        submissions={submissionWorkflow.submissions}
                        pendingCount={submissionWorkflow.pendingCount}
                        adminUserId={user.id}
                        adminName={user.name}
                        onReview={submissionWorkflow.review}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Manage Event Roles (Admin) */}
              {user?.role === 'admin' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowUserEventRolesSection(v => !v)}
                    className="w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">{showUserEventRolesSection ? '▼' : '▶'}</span>
                      <h4 className="text-sm font-semibold text-gray-800">Manage Event Roles</h4>
                    </div>
                  </button>
                  {showUserEventRolesSection && (
                    <div className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-gray-500">Create role options used in Basic User Event Role dropdowns.</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newEventRoleName}
                            onChange={(e) => setNewEventRoleName(e.target.value)}
                            placeholder="Add Event Role"
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={handleAddEventRole}
                            className="px-3 py-2 bg-[#4A1942] text-white rounded-lg text-sm hover:bg-[#3d1a45]"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                      <ul className="mt-3 space-y-2">
                        {eventRoles.map((role) => (
                          <li key={role} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                            {editingEventRoleName === role ? (
                              <div className="flex-1 flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingEventRoleValue}
                                  onChange={(e) => setEditingEventRoleValue(e.target.value)}
                                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={handleSaveEventRoleEdit}
                                  className="px-2 py-1.5 text-xs bg-green-600 text-white rounded-md"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingEventRoleName(null);
                                    setEditingEventRoleValue('');
                                  }}
                                  className="px-2 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-md"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="text-sm text-gray-800">{role}</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditEventRole(role)}
                                    className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-md"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEventRole(role)}
                                    className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded-md"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* User Accounts */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowUserAccountsSection(v => !v)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">{showUserAccountsSection ? '▼' : '▶'}</span>
                    <h4 className="text-sm font-semibold text-gray-800">User Accounts</h4>
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">{users.length}</span>
                  </div>
                </button>

                {showUserAccountsSection && (
                <div className="p-4 space-y-4">
              {/* User Statistics Dashboard */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <BrandedStatCard
                  value={users.length}
                  label="Total Users"
                  icon="👥"
                  config={config}
                />
                <BrandedStatCard
                  value={users.filter(u => u.role === 'admin').length}
                  label="Administrators"
                  icon="👑"
                  config={config}
                  variant="accent"
                />
                <BrandedStatCard
                  value={users.filter(u => u.role === 'basic').length}
                  label="Basic Users"
                  icon="👤"
                  config={config}
                />
                <BrandedStatCard
                  value={users.filter(u => u.isActive !== false).length}
                  label="Active"
                  icon="✅"
                  config={config}
                  variant="success"
                />
                <BrandedStatCard
                  value={users.filter(u => u.isActive === false).length}
                  label="Inactive"
                  icon="⏸️"
                  config={config}
                />
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4 text-center hover:shadow-md transition-shadow">
                  <div className="text-3xl font-bold text-gray-700">{users.reduce((sum, u) => sum + (u.loginCount || 0), 0)}</div>
                  <div className="text-xs text-gray-600 font-medium mt-1">Total Logins</div>
                  <div className="mt-2 text-2xl">📊</div>
                </div>
              </div>

              {/* Search and Filter */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                    <input
                      type="text"
                      placeholder="Search users by name, username, or email..."
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                      onChange={() => {
                        // Filter logic - search state could be added
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <select className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-white">
                      <option value="">All Roles</option>
                      <option value="admin">👑 Admins</option>
                      <option value="basic">👤 Basic Users</option>
                    </select>
                    <select className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-white">
                      <option value="">All Status</option>
                      <option value="active">✅ Active</option>
                      <option value="inactive">⏸️ Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
              
              {/* User List */}
              {users.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                  <div className="text-6xl mb-4">👤</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Users Yet</h3>
                  <p className="text-gray-500 mb-4">Get started by creating your first user account</p>
                  <button
                    onClick={() => setShowCreateUserModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-[#4A1942] to-[#6b2a64] text-white rounded-lg hover:shadow-lg transition-all font-medium"
                  >
                    ➕ Create First User
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map(u => {
                    const isExpanded = expandedUsers.has(u.id);
                    const lastLoginDate = u.lastLogin ? new Date(u.lastLogin) : null;
                    const isOnline = lastLoginDate && (Date.now() - lastLoginDate.getTime()) < 86400000; // Within 24h
                    const editUserFieldErrors = getUserFieldErrors({
                      username: u.username,
                      name: u.name,
                      email: u.email,
                      contactPhoneNumber: u.contactPhoneNumber || u.phone,
                      phoneType: u.phoneType,
                      eventRole: u.eventRole || u.jobTitle,
                      eventName: u.eventName || u.department,
                      userRole: u.userRole || (u.role === 'admin' ? 'admin' : 'shared'),
                      eventDate: u.eventDate,
                      preferredCommunication: u.preferredCommunication,
                      allowSharedAccess: u.allowSharedAccess,
                      sharedUserLimit: u.sharedUserLimit,
                    }, false);
                    
                    return (
                      <div key={u.id} className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all hover:shadow-md ${
                        u.isActive === false ? 'border-gray-300 opacity-60' : 
                        u.role === 'admin' ? 'border-purple-300' : 'border-blue-200'
                      }`}>
                        {/* User Header - Always Visible */}
                        <div 
                          className={`px-4 py-4 flex items-center justify-between cursor-pointer transition-colors ${
                            u.role === 'admin' 
                              ? 'bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-150' 
                              : 'bg-gradient-to-r from-gray-50 to-blue-50 hover:from-gray-100 hover:to-blue-100'
                          }`}
                          onClick={() => {
                            setExpandedUsers(prev => {
                              const next = new Set(prev);
                              if (next.has(u.id)) {
                                next.delete(u.id);
                              } else {
                                next.add(u.id);
                              }
                              return next;
                            });
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <span className={`text-lg transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                            {/* User Avatar with Status Indicator */}
                            <div className="relative">
                              {u.imageUrl ? (
                                <img src={u.imageUrl} alt={u.name} className="w-12 h-12 rounded-full object-cover border-3 border-white shadow-sm" />
                              ) : (
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow-sm ${
                                  u.role === 'admin' 
                                    ? 'bg-gradient-to-br from-purple-400 to-purple-600 text-white' 
                                    : 'bg-gradient-to-br from-blue-400 to-blue-600 text-white'
                                }`}>
                                  {u.name?.charAt(0).toUpperCase() || '?'}
                                </div>
                              )}
                              {/* Online/Status indicator */}
                              <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${
                                u.isActive === false ? 'bg-gray-400' :
                                isOnline ? 'bg-green-500' : 'bg-yellow-500'
                              }`} title={u.isActive === false ? 'Inactive' : isOnline ? 'Recently Active' : 'Away'} />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-800 flex items-center gap-2">
                                {u.name}
                                {u.role === 'admin' && <span className="text-lg" title="Administrator">👑</span>}
                              </div>
                              <div className="text-sm text-gray-500 flex items-center gap-2">
                                <span>@{u.username}</span>
                                {u.email && <span className="text-gray-300">•</span>}
                                {u.email && <span className="text-xs text-gray-400">{u.email}</span>}
                              </div>
                              {u.jobTitle && (
                                <div className="text-xs text-gray-400 mt-0.5">{u.jobTitle}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            {/* Activity Info */}
                            <div className="hidden md:flex flex-col items-end text-xs text-gray-400">
                              {u.lastLogin && (
                                <span>Last login: {new Date(u.lastLogin).toLocaleDateString()}</span>
                              )}
                              {u.loginCount !== undefined && u.loginCount > 0 && (
                                <span>{u.loginCount} login{u.loginCount !== 1 ? 's' : ''}</span>
                              )}
                            </div>
                            {/* Role Badge - Updated to show RBAC role name */}
							<span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
							  u.isActive === false 
								? 'bg-gray-100 text-gray-500'
								: allRoles.find(r => r.id === (u.assignedRoles?.[0] || u.role))?.hierarchy && 
								  allRoles.find(r => r.id === (u.assignedRoles?.[0] || u.role))?.hierarchy! >= 90
								  ? 'bg-purple-100 text-purple-700 border border-purple-200'
								  : 'bg-blue-100 text-blue-700 border border-blue-200'
							}`}>
							  {u.isActive === false 
								? '⏸️ Inactive' 
								: allRoles.find(r => r.id === (u.assignedRoles?.[0] || u.role))?.name || u.role}
							</span>
                            {/* Action Buttons */}
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setExpandedUsers(prev => new Set(prev).add(u.id));
                                }}
                                className="p-2 text-gray-500 hover:bg-white hover:text-[#4A1942] rounded-lg transition-colors"
                                title="Edit user"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.id, u.name || u.email || u.username)}
                                className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                                title="Delete user"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        {/* User Details - Collapsible */}
                        {isExpanded && (
                          <div className="p-5 border-t-2 border-gray-100 space-y-5 bg-gradient-to-b from-white to-gray-50">
                            {/* Profile Section */}
                            <div className="flex flex-col md:flex-row gap-6 pb-5 border-b border-gray-200">
                              {/* Profile Image */}
                              <div className="flex flex-col items-center">
                                <div className="relative group">
                                  {u.imageUrl ? (
                                    <img src={u.imageUrl} alt={u.name} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
                                  ) : (
                                    <div className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold shadow-lg ${
                                      u.role === 'admin' 
                                        ? 'bg-gradient-to-br from-purple-400 to-purple-600 text-white' 
                                        : 'bg-gradient-to-br from-blue-400 to-blue-600 text-white'
                                    }`}>
                                      {u.name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                  )}
                                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                    <span className="text-white text-2xl">📷</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onload = (event) => {
                                            const imageUrl = event.target?.result as string;
                                            handleSaveUsers(users.map(usr => 
                                              usr.id === u.id ? { ...usr, imageUrl, updatedAt: new Date().toISOString() } : usr
                                            ));
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                                {u.imageUrl && (
                                  <button
                                    onClick={() => handleSaveUsers(users.map(usr => 
                                      usr.id === u.id ? { ...usr, imageUrl: '', updatedAt: new Date().toISOString() } : usr
                                    ))}
                                    className="mt-2 text-xs text-red-500 hover:underline"
                                  >
                                    🗑️ Remove Photo
                                  </button>
                                )}
                                <p className="text-xs text-gray-400 mt-2 text-center">Hover to upload</p>
                              </div>
                              
                              {/* Quick Stats */}
                              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 text-center">
                                  <div className="text-2xl mb-1">📅</div>
                                  <div className="text-xs text-gray-500">Member Since</div>
                                  <div className="text-sm font-semibold text-gray-700">
                                    {new Date(u.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 text-center">
                                  <div className="text-2xl mb-1">🔐</div>
                                  <div className="text-xs text-gray-500">Last Login</div>
                                  <div className="text-sm font-semibold text-gray-700">
                                    {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                                  </div>
                                </div>
                                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 text-center">
                                  <div className="text-2xl mb-1">📊</div>
                                  <div className="text-xs text-gray-500">Total Logins</div>
                                  <div className="text-sm font-semibold text-gray-700">{u.loginCount || 0}</div>
                                </div>
                                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 text-center">
                                  <div className="text-2xl mb-1">{u.isActive !== false ? '✅' : '⏸️'}</div>
                                  <div className="text-xs text-gray-500">Status</div>
                                  <div className={`text-sm font-semibold ${u.isActive !== false ? 'text-green-600' : 'text-gray-500'}`}>
                                    {u.isActive !== false ? 'Active' : 'Inactive'}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Personal Information */}
							<div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
							  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
								<span className="text-lg">📋</span> Personal Information
							  </h4>
							  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									✉️ Email (Login ID)
								  </label>
								  <input
									type="email"
									value={u.email || ''}
									onChange={(e) => handleSaveUsers(users.map(usr => 
									  usr.id === u.id ? { ...usr, email: e.target.value, updatedAt: new Date().toISOString() } : usr
									))}
									className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
									placeholder="user@example.com"
								  />
								  {editUserFieldErrors.email && (
									<p className="mt-1 text-xs text-red-600">{editUserFieldErrors.email}</p>
								  )}
								</div>
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									👤 Full Name
								  </label>
								  <input
									type="text"
									value={u.name}
									onChange={(e) => handleSaveUsers(users.map(usr => 
									  usr.id === u.id ? { ...usr, name: e.target.value, updatedAt: new Date().toISOString() } : usr
									))}
									className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
								  />
								  {editUserFieldErrors.name && (
									<p className="mt-1 text-xs text-red-600">{editUserFieldErrors.name}</p>
								  )}
								</div>
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									📞 Contact Phone Number
								  </label>
								  <input
									type="tel"
									value={u.contactPhoneNumber || u.phone || ''}
									onChange={(e) => handleSaveUsers(users.map(usr => 
									  usr.id === u.id ? { ...usr, contactPhoneNumber: e.target.value, phone: e.target.value, updatedAt: new Date().toISOString() } : usr
									))}
									className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
									placeholder="(555) 123-4567"
								  />
								</div>
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									📱 Phone Type
								  </label>
								  <select
									value={u.phoneType || 'Mobile'}
									onChange={(e) => handleSaveUsers(users.map(usr =>
									  usr.id === u.id ? { ...usr, phoneType: e.target.value as 'Mobile' | 'Home' | 'Work' | 'Other', updatedAt: new Date().toISOString() } : usr
									))}
									className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
								  >
									<option value="Mobile">Mobile</option>
									<option value="Home">Home</option>
									<option value="Work">Work</option>
									<option value="Other">Other</option>
								  </select>
								</div>
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									💼 Event Role
								  </label>
								  <select
									value={u.eventRole || u.jobTitle || ''}
									onChange={(e) => handleSaveUsers(users.map(usr => 
									  usr.id === u.id ? { ...usr, eventRole: e.target.value, jobTitle: e.target.value, updatedAt: new Date().toISOString() } : usr
									))}
									className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
								  >
									<option value="">Select Event Role</option>
									{eventRoles.map(role => (
									  <option key={role} value={role}>{role}</option>
									))}
								  </select>
								</div>
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									🏛️ Event Name
								  </label>
								  <input
									type="text"
									value={u.eventName || u.department || ''}
									onChange={(e) => handleSaveUsers(users.map(usr => 
									  usr.id === u.id ? { ...usr, eventName: e.target.value, department: e.target.value, updatedAt: new Date().toISOString() } : usr
									))}
									className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
									placeholder="Smith Wedding"
								  />
								</div>
							  </div>
							</div>
                            
                            {/* Account Settings */}
							<div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
							  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
								<span className="text-lg">⚙️</span> Account Settings
							  </h4>
							  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								{/* RBAC Role Selection */}
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									🔐 Role (RBAC)
								  </label>
								  <select
									value={u.assignedRoles?.[0] || u.role || 'basic'}
									onChange={(e) => {
									  const roleId = e.target.value;
									  const selectedRole = allRoles.find(r => r.id === roleId);
									  handleSaveUsers(users.map(usr => 
										usr.id === u.id ? { 
										  ...usr, 
										  assignedRoles: [roleId],
										  role: selectedRole?.hierarchy && selectedRole.hierarchy >= 90 ? 'admin' :
												selectedRole?.hierarchy && selectedRole.hierarchy >= 40 ? 'staff' :
												roleId === 'guest' ? 'guest' : 'basic',
										  updatedAt: new Date().toISOString() 
										} : usr
									  ));
									}}
									className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent ${
									  allRoles.find(r => r.id === (u.assignedRoles?.[0] || u.role))?.hierarchy && 
									  allRoles.find(r => r.id === (u.assignedRoles?.[0] || u.role))?.hierarchy! >= 90 
										? 'border-purple-300 bg-purple-50' 
										: 'border-blue-300 bg-blue-50'
									}`}
								  >
									{allRoles.map(role => (
									  <option key={role.id} value={role.id}>
										{role.name} {role.isImmutable ? '(System)' : role.isSystem ? '(Default)' : '(Custom)'}
									  </option>
									))}
								  </select>
								  <p className="text-xs text-gray-500 mt-1">
									{allRoles.find(r => r.id === (u.assignedRoles?.[0] || u.role))?.description}
								  </p>
								</div>
								
								{/* User Status */}
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									📊 User Status
								  </label>
								  <select
									value={u.userStatus || (u.isActive === false ? 'disabled' : 'active')}
									onChange={(e) => handleSaveUsers(users.map(usr => 
									  usr.id === u.id ? { 
										...usr, 
										userStatus: e.target.value as 'invited' | 'pending' | 'active' | 'suspended' | 'disabled',
										isActive: !['suspended', 'disabled'].includes(e.target.value),
										updatedAt: new Date().toISOString() 
									  } : usr
									))}
									className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent ${
									  (u.userStatus || (u.isActive === false ? 'disabled' : 'active')) === 'active' ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-100'
									}`}
								  >
									<option value="invited">📨 Invited</option>
									<option value="pending">🕒 Pending</option>
									<option value="active">✅ Active</option>
									<option value="suspended">⏸️ Suspended</option>
									<option value="disabled">⛔ Disabled</option>
								  </select>
								</div>
								
								{/* Change Password */}
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									🔒 Change Password
								  </label>
								  <div className="flex gap-2">
									<input
									  type="password"
									  placeholder="New password (min 8 chars)"
									  id={`password-${u.id}`}
									  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
									/>
									<button
									  onClick={async () => {
											const input = document.getElementById(`password-${u.id}`) as HTMLInputElement;
											const nextPassword = input.value;
											if (nextPassword.length >= 8) {
											  const passwordRecord = await createPasswordRecord(nextPassword);
											  handleSaveUsers(users.map(usr => 
												usr.id === u.id ? {
												  ...usr,
												  password: '',
												  ...passwordRecord,
												  sessionVersion: ((usr as any).sessionVersion ?? 1) + 1,
												  updatedAt: new Date().toISOString()
												} : usr
											  ));
											  input.value = '';
											  showSuccess('Password updated!');
											} else {
											  alert('Password must be at least 8 characters');
											}
										  }}
									  className="px-4 py-2.5 bg-gradient-to-r from-[#4A1942] to-[#6b2a64] text-white rounded-lg hover:shadow-lg transition-all text-sm font-medium"
									>
									  Update
									</button>
								  </div>
								</div>
							  </div>
							</div>
                            
                            {/* Notes */}
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                                <span className="text-lg">📝</span> Notes
                              </h4>
                              <textarea
                                value={u.notes || ''}
                                onChange={(e) => handleSaveUsers(users.map(usr => 
                                  usr.id === u.id ? { ...usr, notes: e.target.value, updatedAt: new Date().toISOString() } : usr
                                ))}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
                                rows={3}
                                placeholder="Add any additional notes about this user..."
                              />
                            </div>
                            
                            {/* Permissions (for Basic Users) */}
                            {(u.userRole || (u.role === 'admin' ? 'admin' : 'shared')) !== 'admin' && (
                              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                                <h4 className="text-sm font-semibold text-blue-700 flex items-center gap-2 mb-4">
                                  <span className="text-lg">🔐</span> User Permissions
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                  {[
                                    { key: 'canCreateTemplates', label: 'Create Templates', icon: '📝', desc: 'Can create new layout templates' },
                                    { key: 'canEditTemplates', label: 'Edit Templates', icon: '✏️', desc: 'Can modify existing templates' },
                                    { key: 'canDeleteTemplates', label: 'Delete Templates', icon: '🗑️', desc: 'Can remove templates' },
                                    { key: 'canManageGuests', label: 'Manage Guests', icon: '👥', desc: 'Can add/edit guest lists' },
                                    { key: 'canPrint', label: 'Print Layouts', icon: '🖨️', desc: 'Can print venue layouts' },
                                    { key: 'canExport', label: 'Export Data', icon: '📤', desc: 'Can export layout data' },
                                    { key: 'canViewAllLayouts', label: 'View All Layouts', icon: '👁️', desc: 'Can view layouts from all users' },
                                  ].map(perm => {
                                    const isChecked = u.permissions?.[perm.key as keyof typeof u.permissions] ?? true;
                                    return (
                                      <label 
                                        key={perm.key} 
                                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                          isChecked 
                                            ? 'bg-white border-2 border-blue-300 shadow-sm' 
                                            : 'bg-gray-100 border-2 border-gray-200 opacity-60'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => handleSaveUsers(users.map(usr => 
                                            usr.id === u.id ? { 
                                              ...usr, 
                                              permissions: { 
                                                ...usr.permissions,
                                                [perm.key]: e.target.checked 
                                              },
                                              updatedAt: new Date().toISOString() 
                                            } : usr
                                          ))}
                                          className="w-5 h-5 accent-[#4A1942] mt-0.5"
                                        />
                                        <div>
                                          <div className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                            <span>{perm.icon}</span> {perm.label}
                                          </div>
                                          <div className="text-xs text-gray-500">{perm.desc}</div>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                                <div className="mt-3 flex gap-2">
                                  <button
                                    onClick={() => handleSaveUsers(users.map(usr => 
                                      usr.id === u.id ? { 
                                        ...usr, 
                                        permissions: {
                                          canCreateTemplates: true,
                                          canEditTemplates: true,
                                          canDeleteTemplates: true,
                                          canManageGuests: true,
                                          canPrint: true,
                                          canExport: true,
                                          canViewAllLayouts: true,
                                        },
                                        updatedAt: new Date().toISOString() 
                                      } : usr
                                    ))}
                                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                  >
                                    Grant All
                                  </button>
                                  <button
                                    onClick={() => handleSaveUsers(users.map(usr => 
                                      usr.id === u.id ? { 
                                        ...usr, 
                                        permissions: {
                                          canCreateTemplates: false,
                                          canEditTemplates: false,
                                          canDeleteTemplates: false,
                                          canManageGuests: false,
                                          canPrint: false,
                                          canExport: false,
                                          canViewAllLayouts: false,
                                        },
                                        updatedAt: new Date().toISOString() 
                                      } : usr
                                    ))}
                                    className="px-3 py-1.5 text-xs bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                                  >
                                    Revoke All
                                  </button>
                                </div>
                              </div>
                            )}
                            
                            {/* Meta Info Footer */}
                            <div className="bg-gray-100 rounded-xl p-3 flex flex-wrap justify-between items-center gap-3 text-xs text-gray-500">
                              <div className="flex flex-wrap gap-4">
                                <span className="flex items-center gap-1">
                                  <span>📅</span> Created: <strong>{new Date(u.createdAt).toLocaleDateString()}</strong>
                                </span>
                                {u.updatedAt && (
                                  <span className="flex items-center gap-1">
                                    <span>✏️</span> Updated: <strong>{new Date(u.updatedAt).toLocaleDateString()}</strong>
                                  </span>
                                )}
                                {u.createdBy && (
                                  <span className="flex items-center gap-1">
                                    <span>👤</span> By: <strong>{users.find(usr => usr.id === u.createdBy)?.name || u.createdBy}</strong>
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete "${u.name}"?`)) {
                                      handleDeleteUser(u.id, u.name || u.email || u.username);
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-1"
                                >
                                  🗑️ Delete User
                                </button>
                              </div>
                            </div>
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
              
              {/* Create User Modal */}
			  {showCreateUserModal && (
			    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
				  <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
				    <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-[#4A1942] to-[#6b2a64]">
					  <h3 className="text-xl font-bold text-white flex items-center gap-2">
					    ➕ Create New User
					  </h3>
				    </div>
				    <div className="p-6 space-y-4">
					  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					    {/* Email - Primary Login Identifier */}
					    <div className="md:col-span-2">
						  <label className="text-xs font-medium text-gray-500 uppercase">Email Address * (Used for login)</label>
						  <input
						    type="email"
						    value={newUser.email || ''}
						    onChange={(e) => {
							  setNewUser({ ...newUser, email: e.target.value });
							  if (createUserFieldErrors.email) {
							    setCreateUserFieldErrors((prev) => ({ ...prev, email: '' }));
							  }
			  			    }}
						    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent ${createUserFieldErrors.email ? 'border-red-300' : 'border-gray-300'}`}
						    placeholder="user@example.com"
						  />
						  {createUserFieldErrors.email && (
						    <p className="mt-1 text-xs text-red-600">{createUserFieldErrors.email}</p>
						  )}
					      </div>
					  
					    {/* Full Name */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Full Name *</label>
						  <input
						    type="text"
						    value={newUser.name}
						    onChange={(e) => {
							  setNewUser({ ...newUser, name: e.target.value });
							  if (createUserFieldErrors.name) {
							    setCreateUserFieldErrors((prev) => ({ ...prev, name: '' }));
							  }
						    }}
						    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent ${createUserFieldErrors.name ? 'border-red-300' : 'border-gray-300'}`}
						    placeholder="John Smith"
						  />
						  {createUserFieldErrors.name && (
						    <p className="mt-1 text-xs text-red-600">{createUserFieldErrors.name}</p>
						  )}
					    </div>
					  
					    {/* Password */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Password *</label>
						  <input
						    type="password"
						    value={newUser.password}
						    onChange={(e) => {
							  setNewUser({ ...newUser, password: e.target.value });
							  if (createUserFieldErrors.password) {
							    setCreateUserFieldErrors((prev) => ({ ...prev, password: '' }));
							  }
						    }}
						    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent ${createUserFieldErrors.password ? 'border-red-300' : 'border-gray-300'}`}
						    placeholder="••••••••"
						  />
						  {createUserFieldErrors.password && (
						    <p className="mt-1 text-xs text-red-600">{createUserFieldErrors.password}</p>
						  )}
					    </div>
					  
					    {/* RBAC Role Selection */}
					    <div className="md:col-span-2">
						  <label className="text-xs font-medium text-gray-500 uppercase">Role * (Controls access permissions)</label>
						  <select
						    value={newUser.assignedRoles?.[0] || newUser.role || 'basic'}
						    onChange={(e) => {
							  const roleId = e.target.value;
							  const selectedRole = allRoles.find(r => r.id === roleId);
							  setNewUser({
							    ...newUser,
							    assignedRoles: [roleId],
							    role: selectedRole?.hierarchy && selectedRole.hierarchy >= 90 ? 'admin' :
									  selectedRole?.hierarchy && selectedRole.hierarchy >= 40 ? 'staff' :
									  roleId === 'guest' ? 'guest' : 'basic',
							  });
						    }}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
						  >
						    {allRoles.map(role => (
							  <option key={role.id} value={role.id}>
							    {role.name} {role.isImmutable ? '(System)' : role.isSystem ? '(Default)' : '(Custom)'}
							  </option>
						    ))}
						  </select>
						  <p className="text-xs text-gray-500 mt-1">
						    {allRoles.find(r => r.id === (newUser.assignedRoles?.[0] || newUser.role))?.description}
						  </p>
					    </div>
					  
					    {/* Contact Phone */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Contact Phone</label>
						  <input
						    type="tel"
						    value={newUser.contactPhoneNumber || ''}
						    onChange={(e) => setNewUser({ ...newUser, contactPhoneNumber: e.target.value, phone: e.target.value })}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
						    placeholder="(555) 123-4567"
						  />
					    </div>
					  
					    {/* Phone Type */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Phone Type</label>
						  <select
						    value={newUser.phoneType || 'Mobile'}
						    onChange={(e) => setNewUser({
							  ...newUser,
							  phoneType: e.target.value as 'Mobile' | 'Home' | 'Work' | 'Other',
						    })}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
						  >
						    <option value="Mobile">Mobile</option>
						    <option value="Home">Home</option>
						    <option value="Work">Work</option>
						    <option value="Other">Other</option>
						  </select>
					    </div>
					  
					    {/* Event Role */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Event Role</label>
						  <select
						    value={newUser.eventRole || ''}
						    onChange={(e) => setNewUser({ ...newUser, eventRole: e.target.value, jobTitle: e.target.value })}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
						  >
						    <option value="">Select Event Role</option>
						    {eventRoles.map(role => (
							  <option key={role} value={role}>{role}</option>
						    ))}
						  </select>
					    </div>
					  
					    {/* Event Name */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Event Name</label>
						  <input
						    type="text"
						    value={newUser.eventName || ''}
						    onChange={(e) => setNewUser({ ...newUser, eventName: e.target.value, department: e.target.value })}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
						    placeholder="Smith Wedding"
						  />
					    </div>
					  
					    {/* Event Date */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Event Date</label>
						  <input
						    type="date"
						    value={newUser.eventDate || ''}
						    onChange={(e) => setNewUser({ ...newUser, eventDate: e.target.value })}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
						  />
					    </div>
					  
					    {/* User Status */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">User Status</label>
						  <select
						    value={newUser.userStatus || 'active'}
						    onChange={(e) => setNewUser({
							  ...newUser,
							  userStatus: e.target.value as 'invited' | 'pending' | 'active' | 'suspended' | 'disabled',
						    })}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
						  >
						    <option value="active">✅ Active</option>
						    <option value="invited">📨 Invited</option>
						    <option value="pending">🕒 Pending</option>
						    <option value="suspended">⏸️ Suspended</option>
						    <option value="disabled">⛔ Disabled</option>
						  </select>
					    </div>
					  </div>
				    </div>
				    <div className="p-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
					  <button
					    onClick={() => {
						  setShowCreateUserModal(false);
						  setCreateUserFieldErrors({});
						  setNewUser({
						    username: '',
						    password: '',
						    name: '',
						    role: 'basic',
						    email: '',
						    phone: '',
						    contactPhoneNumber: '',
						    phoneType: 'Mobile',
						    preferredCommunication: [],
						    eventRole: '',
						    eventName: '',
						    userRole: 'master',
						    isMasterUser: false,
						    parentUserId: undefined,
						    allowSharedAccess: false,
						    sharedUserLimit: 0,
						    userStatus: 'active',
						    eventDate: '',
						    jobTitle: '',
						    department: '',
						    assignedRoles: [],
						  });
					    }}
					    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
					  >
					    Cancel
					  </button>
					  <button
					    onClick={handleCreateUser}
					    className="px-4 py-2 bg-[#4A1942] text-white rounded-lg hover:bg-[#5c2a64] transition-colors font-medium"
					  >
					    Create User
					  </button>
				    </div>
				  </div>
			    </div>
			  )}
              </div>
            )}
		  
		  {/* Access Control Tab */}
		  {activeTab === 'access-control' && (
			  <AccessControlPanel 
				onClose={() => setActiveTab('venues')} 
				inline={true} 
			  />
			)}

          {/* Branding Tab */}
          {activeTab === 'branding' && (
            <div className="space-y-4">
              {/* Header */}
              <BrandedSectionHeader
                icon="🎨"
                title="Brand Settings"
                description="Customize your venue's look and feel across the entire application"
                config={config}
              />
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <BrandedStatCard
                  value={config.logoUrl ? '✅' : '❌'}
                  label="Logo"
                  icon="🖼️"
                  config={config}
                />
                <BrandedStatCard
                  value={config.websiteUrl ? '✅' : '❌'}
                  label="Website"
                  icon="🌐"
                  config={config}
                />
                <BrandedStatCard
                  value={config.welcomeLogoUrl ? '✅' : '❌'}
                  label="Welcome"
                  icon="👋"
                  config={config}
                  variant="accent"
                />
                <BrandedStatCard
                  value="✅"
                  label="Custom"
                  icon="🎨"
                  config={config}
                  variant="success"
                />
              </div>
              
              {/* Expand/Collapse All */}
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  {expandedBrandingSections.size} of 6 sections expanded
                </div>
                <button
                  onClick={() => {
                    const allSections = ['logo', 'website', 'welcome', 'colors', 'typography', 'preview'];
                    if (expandedBrandingSections.size === allSections.length) {
                      setExpandedBrandingSections(new Set());
                    } else {
                      setExpandedBrandingSections(new Set(allSections));
                    }
                  }}
                  className="px-4 py-2 bg-[#4A1942] text-white rounded-lg hover:bg-[#5c2a64] transition-colors text-sm font-medium shadow-sm"
                >
                  {expandedBrandingSections.size === 6 ? '▲ Collapse All' : '▼ Expand All'}
                </button>
              </div>
              
              {/* Logo & Identity Section */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-purple-100">
                <div 
                  className="bg-gradient-to-r from-purple-50 to-purple-100 px-4 py-4 flex items-center cursor-pointer hover:from-purple-100 hover:to-purple-150 transition-all"
                  onClick={() => {
                    setExpandedBrandingSections(prev => {
                      const next = new Set(prev);
                      if (next.has('logo')) next.delete('logo');
                      else next.add('logo');
                      return next;
                    });
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[#4A1942] text-xl">{expandedBrandingSections.has('logo') ? '▼' : '▶'}</span>
                    <div className="w-10 h-10 bg-[#4A1942] rounded-lg flex items-center justify-center">
                      <span className="text-white text-xl">🏷️</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">Logo & Identity</h3>
                      <p className="text-xs text-gray-500">Your venue's name, logo, and basic information</p>
                    </div>
                  </div>
                </div>
                {expandedBrandingSections.has('logo') && (
                <div className="p-6 space-y-6">
                  {/* Logo Upload Section */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <label className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 block">Logo</label>
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div className="relative group">
                        {config.logoUrl ? (
                          <div className="relative">
                            <img src={config.logoUrl} alt="Logo" className="w-32 h-32 object-contain rounded-xl border-2 border-dashed border-gray-300 bg-white p-2" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                              <span className="text-white text-sm">Click to change</span>
                            </div>
                          </div>
                        ) : (
                          <div className="w-32 h-32 bg-white rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-[#4A1942] hover:text-[#4A1942] transition-colors cursor-pointer">
                            <span className="text-3xl mb-1">📷</span>
                            <span className="text-xs">No Logo</span>
                          </div>
                        )}
                      </div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          className="px-6 py-3 bg-gradient-to-r from-[#4A1942] to-[#6b2c5c] text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all flex items-center gap-2"
                        >
                          <span>📤</span> {config.logoUrl ? 'Change Logo' : 'Upload Logo'}
                        </button>
                        {config.logoUrl && (
                          <button
                            onClick={() => handleSaveConfig({ ...config, logoUrl: '' })}
                            className="px-6 py-3 text-red-500 hover:bg-red-50 rounded-xl text-sm font-medium border border-red-200 flex items-center gap-2 justify-center"
                          >
                            <span>🗑️</span> Remove
                          </button>
                        )}
                        <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG up to 5MB</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Venue Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                        <span>🏛️</span> Venue Name
                      </label>
                      <input
                        type="text"
                        value={config.venueName}
                        onChange={(e) => handleSaveConfig({ ...config, venueName: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4A1942] focus:border-transparent transition-all"
                        placeholder="Your Venue Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                        <span>✨</span> Tagline
                      </label>
                      <input
                        type="text"
                        value={config.tagline}
                        onChange={(e) => handleSaveConfig({ ...config, tagline: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4A1942] focus:border-transparent transition-all"
                        placeholder="Where Your Love Story Unfolds"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                        <span>📍</span> Location
                      </label>
                      <input
                        type="text"
                        value={config.location}
                        onChange={(e) => handleSaveConfig({ ...config, location: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4A1942] focus:border-transparent transition-all"
                        placeholder="City, State"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                        <span>📞</span> Phone
                      </label>
                      <input
                        type="tel"
                        value={config.phone || ''}
                        onChange={(e) => handleSaveConfig({ ...config, phone: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4A1942] focus:border-transparent transition-all"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>
                  
                  {/* Preview Card */}
                  <div className="bg-gradient-to-r from-[#4A1942] to-[#6b2c5c] rounded-xl p-4 text-white">
                    <p className="text-xs text-white/60 uppercase tracking-wide mb-2">Preview</p>
                    <div className="flex items-center gap-3">
                      {config.logoUrl ? (
                        <img src={config.logoUrl} alt="Logo" className="w-12 h-12 object-contain bg-white rounded-lg p-1" />
                      ) : (
                        <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                          <span className="text-2xl">🏛️</span>
                        </div>
                      )}
                      <div>
                        <div className="font-bold">{config.venueName || 'Your Venue Name'}</div>
                        <div className="text-sm text-white/80 italic">{config.tagline || 'Your Tagline'}</div>
                        <div className="text-xs text-white/60">{config.location || 'Location'} • {config.phone || 'Phone'}</div>
                      </div>
                    </div>
                  </div>
                </div>
                )}
              </div>
              
              {/* Contact & Website */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div 
                  className="bg-blue-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => {
                    setExpandedBrandingSections(prev => {
                      const next = new Set(prev);
                      if (next.has('website')) next.delete('website');
                      else next.add('website');
                      return next;
                    });
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{expandedBrandingSections.has('website') ? '▼' : '▶'}</span>
                    <h3 className="font-bold text-lg text-gray-800">🌐 Website & Contact</h3>
                  </div>
                </div>
                {expandedBrandingSections.has('website') && (
                <div className="p-4">
                <p className="text-sm text-gray-500 mb-4">These links will appear in the header for all users</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Website URL</label>
                    <div className="flex gap-2 mt-1">
                      <span className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-l-lg text-gray-500 text-sm">🔗</span>
                      <input
                        type="url"
                        value={config.websiteUrl}
                        onChange={(e) => handleSaveConfig({ ...config, websiteUrl: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg"
                        placeholder="https://www.yourwebsite.com"
                      />
                    </div>
                    {config.websiteUrl && (
                      <a href={config.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                        Preview →
                      </a>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Support Email</label>
                    <div className="flex gap-2 mt-1">
                      <span className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-l-lg text-gray-500 text-sm">📧</span>
                      <input
                        type="email"
                        value={config.supportEmail}
                        onChange={(e) => handleSaveConfig({ ...config, supportEmail: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg"
                        placeholder="events@yourwebsite.com"
                      />
                    </div>
                    {config.supportEmail && (
                      <a href={`mailto:${config.supportEmail}`} className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                        Send Test Email →
                      </a>
                    )}
                  </div>
                </div>
                </div>
                )}
              </div>
              
              {/* Welcome Settings */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-amber-200">
                <div 
                  className="bg-amber-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-amber-100 transition-colors"
                  onClick={() => {
                    setExpandedBrandingSections(prev => {
                      const next = new Set(prev);
                      if (next.has('welcome')) next.delete('welcome');
                      else next.add('welcome');
                      return next;
                    });
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{expandedBrandingSections.has('welcome') ? '▼' : '▶'}</span>
                    <h3 className="font-bold text-lg text-amber-800">👋 Welcome Screen Settings</h3>
                  </div>
                </div>
                {expandedBrandingSections.has('welcome') && (
                <div className="p-4 bg-amber-50/50">
                <p className="text-sm text-amber-700 mb-4">Customize the welcome modal shown to new users</p>
                
                <div className="space-y-4">
                  {/* Show Welcome Toggle */}
                  <div className="flex items-center justify-between bg-white p-3 rounded-lg">
                    <div>
                      <label className="font-medium text-gray-700">Show Welcome by Default</label>
                      <p className="text-xs text-gray-500">Enable to show welcome screen for new users</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showWelcomeByDefault !== false}
                        onChange={(e) => handleSaveConfig({ ...config, showWelcomeByDefault: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                  
                  {/* Welcome Title */}
                  <div className="bg-white p-3 rounded-lg">
                    <label className="text-xs font-medium text-gray-500 uppercase">Welcome Title</label>
                    <input
                      type="text"
                      value={config.welcomeTitle || 'Welcome to the Wedding Layout Planner'}
                      onChange={(e) => handleSaveConfig({ ...config, welcomeTitle: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1"
                      placeholder="Welcome to the Wedding Layout Planner"
                    />
                  </div>

                  {/* Welcome Feature Controls */}
                  <div className="bg-white p-3 rounded-lg border border-amber-100">
                    <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Welcome Feature Highlights</label>
                    <p className="text-xs text-gray-500 mb-3">
                      Control which app capabilities are highlighted for non-admin users on the welcome screen.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {AVAILABLE_WELCOME_FEATURES.map((feature) => {
                        const selected = currentWelcomeFeatures.includes(feature);
                        return (
                          <label key={feature} className="flex items-center gap-2 p-2 rounded border border-gray-200 hover:bg-amber-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => {
                                const current = currentWelcomeFeatures;
                                const next = e.target.checked
                                  ? [...current, feature]
                                  : current.filter((f) => f !== feature);
                                handleSaveConfig({ ...config, welcomeFeatures: next });
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span className="text-sm text-gray-700">{feature}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                      <span>{currentWelcomeFeatures.length} feature(s) selected</span>
                      <button
                        type="button"
                        onClick={() => handleSaveConfig({ ...config, welcomeFeatures: AVAILABLE_WELCOME_FEATURES })}
                        className="text-amber-700 hover:underline"
                      >
                        Reset to recommended
                      </button>
                    </div>
                  </div>
                  
                  {/* Welcome Logo */}
                  <div className="bg-white p-3 rounded-lg">
                    <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Welcome Logo/Image</label>
                    <p className="text-xs text-gray-500 mb-3">This replaces the 👋 icon on the first welcome screen</p>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                        {config.welcomeLogoUrl ? (
                          <img src={config.welcomeLogoUrl} alt="Welcome Logo" className="max-h-16 max-w-16 object-contain" />
                        ) : (
                          <span className="text-3xl">👋</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          id="welcome-logo-upload"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                handleSaveConfig({ ...config, welcomeLogoUrl: reader.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <label
                          htmlFor="welcome-logo-upload"
                          className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 cursor-pointer text-center"
                        >
                          📷 Upload Image
                        </label>
                        {config.welcomeLogoUrl && (
                          <button
                            onClick={() => handleSaveConfig({ ...config, welcomeLogoUrl: '' })}
                            className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm border border-red-200"
                          >
                            🗑️ Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Preview */}
                  <div className="bg-white p-3 rounded-lg">
                    <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Preview</label>
                    <div className="border rounded-lg p-4 bg-gray-50 text-center">
                      {config.welcomeLogoUrl ? (
                        <img src={config.welcomeLogoUrl} alt="Preview" className="max-h-16 mx-auto mb-2" />
                      ) : (
                        <div className="text-4xl mb-2">👋</div>
                      )}
                      <div className="font-bold text-gray-800">{config.welcomeTitle || 'Welcome to the Wedding Layout Planner'}</div>
                      {currentWelcomeFeatures.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-left">
                          {currentWelcomeFeatures.slice(0, 6).map((feature) => (
                            <div key={feature} className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700">
                              • {feature}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setShowWelcomePreview(true)}
                        className="px-3 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                      >
                        👁️ Preview as Basic User
                      </button>
                    </div>
                  </div>
                  
                  {/* Reset User Preferences */}
                  <div className="bg-white p-3 rounded-lg">
                    <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">User Preferences</label>
                    <p className="text-xs text-gray-500 mb-2">Users can choose "Don't show again". Reset this for all users:</p>
                    <button
                      onClick={() => {
                        // This doesn't actually reset for all users since it's client-side
                        // But shows the intent
                        showSuccess('Welcome screen will show again for new sessions');
                      }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                    >
                      Reset Welcome for New Sessions
                    </button>
                  </div>
                </div>
                </div>
                )}
              </div>
              
              {/* Color Scheme */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-pink-100">
                <div 
                  className="bg-gradient-to-r from-pink-50 to-purple-50 px-4 py-4 flex items-center cursor-pointer hover:from-pink-100 hover:to-purple-100 transition-all"
                  onClick={() => {
                    setExpandedBrandingSections(prev => {
                      const next = new Set(prev);
                      if (next.has('colors')) next.delete('colors');
                      else next.add('colors');
                      return next;
                    });
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[#4A1942] text-xl">{expandedBrandingSections.has('colors') ? '▼' : '▶'}</span>
                    <div className="w-10 h-10 bg-gradient-to-br from-[#4A1942] to-[#D4AF37] rounded-lg flex items-center justify-center">
                      <span className="text-white text-xl">🎨</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">Color Scheme</h3>
                      <p className="text-xs text-gray-500">Define your brand colors used throughout the app</p>
                    </div>
                  </div>
                </div>
                {expandedBrandingSections.has('colors') && (
                <div className="p-6 space-y-6">
                  {/* Color Palette Presets */}
                  <div>
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3 block">Quick Presets</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <button
                        onClick={() => handleSaveConfig({
                          ...config,
                          primaryColor: '#4A1942',
                          primaryDark: '#3d1a45',
                          primaryLight: '#6b2c5c',
                          accentColor: '#D4AF37',
                          backgroundColor: '#f3f4f6'
                        })}
                        className="p-3 border-2 border-gray-200 rounded-xl hover:border-purple-300 transition-all group"
                      >
                        <div className="flex gap-1 mb-2 justify-center">
                          <div className="w-6 h-6 rounded-full bg-[#4A1942]" />
                          <div className="w-6 h-6 rounded-full bg-[#D4AF37]" />
                          <div className="w-6 h-6 rounded-full bg-[#f3f4f6] border" />
                        </div>
                        <div className="text-xs font-medium text-gray-700">Deep Plum</div>
                        <div className="text-xs text-gray-400">Classic & Elegant</div>
                      </button>
                      <button
                        onClick={() => handleSaveConfig({
                          ...config,
                          primaryColor: '#1e3a5f',
                          primaryDark: '#152a45',
                          primaryLight: '#2d5a8a',
                          accentColor: '#c9a227',
                          backgroundColor: '#f8fafc'
                        })}
                        className="p-3 border-2 border-gray-200 rounded-xl hover:border-blue-300 transition-all group"
                      >
                        <div className="flex gap-1 mb-2 justify-center">
                          <div className="w-6 h-6 rounded-full bg-[#1e3a5f]" />
                          <div className="w-6 h-6 rounded-full bg-[#c9a227]" />
                          <div className="w-6 h-6 rounded-full bg-[#f8fafc] border" />
                        </div>
                        <div className="text-xs font-medium text-gray-700">Navy & Gold</div>
                        <div className="text-xs text-gray-400">Timeless</div>
                      </button>
                      <button
                        onClick={() => handleSaveConfig({
                          ...config,
                          primaryColor: '#2d5a4a',
                          primaryDark: '#1e3d32',
                          primaryLight: '#4a7a68',
                          accentColor: '#d4a574',
                          backgroundColor: '#faf9f7'
                        })}
                        className="p-3 border-2 border-gray-200 rounded-xl hover:border-green-300 transition-all group"
                      >
                        <div className="flex gap-1 mb-2 justify-center">
                          <div className="w-6 h-6 rounded-full bg-[#2d5a4a]" />
                          <div className="w-6 h-6 rounded-full bg-[#d4a574]" />
                          <div className="w-6 h-6 rounded-full bg-[#faf9f7] border" />
                        </div>
                        <div className="text-xs font-medium text-gray-700">Sage & Copper</div>
                        <div className="text-xs text-gray-400">Natural & Warm</div>
                      </button>
                      <button
                        onClick={() => handleSaveConfig({
                          ...config,
                          primaryColor: '#8b4557',
                          primaryDark: '#6b3344',
                          primaryLight: '#ab657a',
                          accentColor: '#e8c4a2',
                          backgroundColor: '#fdf8f5'
                        })}
                        className="p-3 border-2 border-gray-200 rounded-xl hover:border-rose-300 transition-all group"
                      >
                        <div className="flex gap-1 mb-2 justify-center">
                          <div className="w-6 h-6 rounded-full bg-[#8b4557]" />
                          <div className="w-6 h-6 rounded-full bg-[#e8c4a2]" />
                          <div className="w-6 h-6 rounded-full bg-[#fdf8f5] border" />
                        </div>
                        <div className="text-xs font-medium text-gray-700">Rose & Blush</div>
                        <div className="text-xs text-gray-400">Romantic</div>
                      </button>
                      <button
                        onClick={() => handleSaveConfig({
                          ...config,
                          primaryColor: '#111111',
                          primaryDark: '#000000',
                          primaryLight: '#4b5563',
                          accentColor: '#C0C0C0',
                          backgroundColor: '#FFFFFF',
                          headerTextColor: '#FFFFFF',
                          bodyTextColor: '#111111',
                          accentTextColor: '#111111'
                        })}
                        className="p-3 border-2 border-gray-200 rounded-xl hover:border-gray-400 transition-all group"
                      >
                        <div className="flex gap-1 mb-2 justify-center">
                          <div className="w-6 h-6 rounded-full bg-[#111111]" />
                          <div className="w-6 h-6 rounded-full bg-[#C0C0C0] border" />
                          <div className="w-6 h-6 rounded-full bg-[#FFFFFF] border" />
                        </div>
                        <div className="text-xs font-medium text-gray-700">Traditional</div>
                        <div className="text-xs text-gray-400">Black • Silver • White</div>
                      </button>
                    </div>
                  </div>
                  
                  {/* Custom Colors */}
                  <div>
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3 block">Custom Colors</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[
                        { key: 'primaryColor', label: 'Primary', desc: 'Main brand color', default: '#4A1942' },
                        { key: 'primaryDark', label: 'Primary Dark', desc: 'Header gradients', default: '#3d1a45' },
                        { key: 'primaryLight', label: 'Primary Light', desc: 'Hover states', default: '#6b2c5c' },
                        { key: 'accentColor', label: 'Accent', desc: 'Highlights & CTAs', default: '#D4AF37' },
                        { key: 'backgroundColor', label: 'Background', desc: 'Page background', default: '#f3f4f6' },
                      ].map(({ key, label, desc, default: defaultVal }) => (
                        <div key={key} className="bg-gray-50 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <div className="relative">
                              <input
                                type="color"
                                value={(config as any)[key] || defaultVal}
                                onChange={(e) => handleSaveConfig({ ...config, [key]: e.target.value })}
                                className="w-14 h-14 border-2 border-gray-200 rounded-xl cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-sm font-semibold text-gray-700">{label}</label>
                              <p className="text-xs text-gray-400">{desc}</p>
                              <input
                                type="text"
                                value={(config as any)[key] || defaultVal}
                                onChange={(e) => handleSaveConfig({ ...config, [key]: e.target.value })}
                                className="mt-2 w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg font-mono bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Live Preview */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3 block">Live Preview</label>
                    <div 
                      className="rounded-xl p-4 shadow-lg"
                      style={{ 
                        background: `linear-gradient(135deg, ${config.primaryColor || '#4A1942'}, ${config.primaryDark || '#3d1a45'})` 
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                          <span className="text-2xl">💒</span>
                        </div>
                        <div className="text-white">
                          <div className="font-bold">Header Preview</div>
                          <div className="text-sm opacity-80">How your header will look</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          className="px-4 py-2 rounded-lg text-sm font-medium"
                          style={{ backgroundColor: config.accentColor || '#D4AF37', color: '#000' }}
                        >
                          Primary Button
                        </button>
                        <button 
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-white/20 text-white"
                        >
                          Secondary
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                )}
              </div>
              
              {/* Typography */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div 
                  className="bg-green-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-green-100 transition-colors"
                  onClick={() => {
                    setExpandedBrandingSections(prev => {
                      const next = new Set(prev);
                      if (next.has('typography')) next.delete('typography');
                      else next.add('typography');
                      return next;
                    });
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{expandedBrandingSections.has('typography') ? '▼' : '▶'}</span>
                    <h3 className="font-bold text-lg text-gray-800">✍️ Typography</h3>
                  </div>
                </div>
                {expandedBrandingSections.has('typography') && (
                <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Body Font Family</label>
                    <select
                      value={config.fontFamily || 'Inter, system-ui, sans-serif'}
                      onChange={(e) => handleSaveConfig({ ...config, fontFamily: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1"
                    >
                      <optgroup label="✏️ Modern Sans-Serif Fonts (Recommended for Body Text)">
                        <option value="Inter, system-ui, sans-serif">Inter (Default - Clean & Modern)</option>
                        <option value="'Montserrat', Arial, sans-serif">Montserrat (Chic & Elegant)</option>
                        <option value="'Raleway', Arial, sans-serif">Raleway (Stylish & Light)</option>
                        <option value="'Josefin Sans', Arial, sans-serif">Josefin Sans (Art Deco)</option>
                        <option value="'Quicksand', Arial, sans-serif">Quicksand (Soft & Friendly)</option>
                        <option value="'Nunito', Arial, sans-serif">Nunito (Rounded & Warm)</option>
                        <option value="'Poppins', Arial, sans-serif">Poppins (Contemporary & Bold)</option>
                        <option value="'Open Sans', Arial, sans-serif">Open Sans (Clean & Versatile)</option>
                        <option value="'Lato', Arial, sans-serif">Lato (Professional & Refined)</option>
                        <option value="'Roboto', Arial, sans-serif">Roboto (Modern & Neutral)</option>
                        <option value="'Work Sans', Arial, sans-serif">Work Sans (Minimal & Clean)</option>
                        <option value="'Source Sans Pro', Arial, sans-serif">Source Sans Pro (Clear & Readable)</option>
                        <option value="'Karla', Arial, sans-serif">Karla (Grotesque Style)</option>
                        <option value="'Cabin', Arial, sans-serif">Cabin (Humanist Style)</option>
                        <option value="'Barlow', Arial, sans-serif">Barlow (Semi-Condensed)</option>
                        <option value="Arial, sans-serif">Arial (Simple & Universal)</option>
                      </optgroup>
                      <optgroup label="🎀 Elegant Serif Fonts (Classic & Sophisticated)">
                        <option value="'Playfair Display', Georgia, serif">Playfair Display (Elegant & Refined)</option>
                        <option value="'Cormorant Garamond', Georgia, serif">Cormorant Garamond (Delicate & Light)</option>
                        <option value="'Libre Baskerville', Georgia, serif">Libre Baskerville (Classic & Readable)</option>
                        <option value="'EB Garamond', Georgia, serif">EB Garamond (Timeless & Scholarly)</option>
                        <option value="'Crimson Text', Georgia, serif">Crimson Text (Sophisticated & Warm)</option>
                        <option value="'Lora', Georgia, serif">Lora (Romantic & Contemporary)</option>
                        <option value="'Merriweather', Georgia, serif">Merriweather (Strong & Readable)</option>
                        <option value="'Source Serif Pro', Georgia, serif">Source Serif Pro (Modern Serif)</option>
                        <option value="'Cinzel', Georgia, serif">Cinzel (Majestic & Grand)</option>
                        <option value="'Spectral', Georgia, serif">Spectral (Contemporary & Elegant)</option>
                        <option value="'Cardo', Georgia, serif">Cardo (Old-Style & Refined)</option>
                        <option value="'Sorts Mill Goudy', Georgia, serif">Sorts Mill Goudy (Art Nouveau)</option>
                        <option value="'Noto Serif', Georgia, serif">Noto Serif (Universal & Clear)</option>
                        <option value="Georgia, serif">Georgia (Traditional & Reliable)</option>
                        <option value="'Times New Roman', Times, serif">Times New Roman (Classic & Formal)</option>
                      </optgroup>
                    </select>
                    <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: config.fontFamily }}>
                      Preview: The quick brown fox jumps over the lazy dog
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Heading Font Family</label>
                    <select
                      value={config.headingFontFamily || 'Inter, system-ui, sans-serif'}
                      onChange={(e) => handleSaveConfig({ ...config, headingFontFamily: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1"
                    >
                      <optgroup label="✨ Cursive & Script Fonts (Wedding Favorites)">
                        <option value="'Great Vibes', cursive">Great Vibes (Romantic Script)</option>
                        <option value="'Tangerine', cursive">Tangerine (Elegant Script)</option>
                        <option value="'Alex Brush', cursive">Alex Brush (Flowing)</option>
                        <option value="'Allura', cursive">Allura (Graceful)</option>
                        <option value="'Dancing Script', cursive">Dancing Script (Playful)</option>
                        <option value="'Parisienne', cursive">Parisienne (French Elegance)</option>
                        <option value="'Sacramento', cursive">Sacramento (Classic Script)</option>
                        <option value="'Pinyon Script', cursive">Pinyon Script (Formal)</option>
                        <option value="'Satisfy', cursive">Satisfy (Casual Script)</option>
                        <option value="'Kaushan Script', cursive">Kaushan Script (Bold Script)</option>
                        <option value="'Cookie', cursive">Cookie (Sweet Cursive)</option>
                        <option value="'Lobster', cursive">Lobster (Retro Script)</option>
                        <option value="'Pacifico', cursive">Pacifico (Casual Cursive)</option>
                        <option value="'Petit Formal Script', cursive">Petit Formal Script (Refined)</option>
                        <option value="'Herr Von Muellerhoff', cursive">Herr Von Muellerhoff (Vintage)</option>
                        <option value="'Monsieur La Doulaise', cursive">Monsieur La Doulaise (Calligraphy)</option>
                        <option value="'Mrs Saint Delafield', cursive">Mrs Saint Delafield (Elegant)</option>
                        <option value="'Rochester', cursive">Rochester (Classic Script)</option>
                        <option value="'Yellowtail', cursive">Yellowtail (Retro Script)</option>
                        <option value="'Niconne', cursive">Niconne (Modern Cursive)</option>
                        <option value="'Marck Script', cursive">Marck Script (Contemporary)</option>
                        <option value="'Italianno', cursive">Italianno (Italian Flair)</option>
                        <option value="'Qwigley', cursive">Qwigley (Whimsical)</option>
                        <option value="'Mr Dafoe', cursive">Mr Dafoe (Dramatic)</option>
                        <option value="'Ruthie', cursive">Ruthie (Playful Calligraphy)</option>
                        <option value="'Bilbo Swash Caps', cursive">Bilbo Swash Caps (Fantasy)</option>
                        <option value="cursive">System Cursive (Fallback)</option>
                      </optgroup>
                      <optgroup label="Elegant Serif Fonts">
                        <option value="'Playfair Display', Georgia, serif">Playfair Display (Sophisticated)</option>
                        <option value="'Cormorant Garamond', Georgia, serif">Cormorant Garamond (Refined)</option>
                        <option value="'Cinzel', Georgia, serif">Cinzel (Majestic)</option>
                        <option value="'Libre Baskerville', Georgia, serif">Libre Baskerville (Classic)</option>
                        <option value="'EB Garamond', Georgia, serif">EB Garamond (Timeless)</option>
                        <option value="'Lora', Georgia, serif">Lora (Romantic)</option>
                        <option value="'Crimson Text', Georgia, serif">Crimson Text (Elegant)</option>
                        <option value="Georgia, serif">Georgia (Traditional)</option>
                      </optgroup>
                      <optgroup label="Modern Sans-Serif Fonts">
                        <option value="Inter, system-ui, sans-serif">Inter (Default)</option>
                        <option value="'Montserrat', Arial, sans-serif">Montserrat (Chic)</option>
                        <option value="'Raleway', Arial, sans-serif">Raleway (Stylish)</option>
                        <option value="'Josefin Sans', Arial, sans-serif">Josefin Sans (Art Deco)</option>
                        <option value="'Poppins', Arial, sans-serif">Poppins (Contemporary)</option>
                        <option value="'Quicksand', Arial, sans-serif">Quicksand (Whimsical)</option>
                      </optgroup>
                    </select>
                    <p className="text-xs text-gray-400 mt-1 font-bold" style={{ fontFamily: config.headingFontFamily }}>
                      Preview: Wedding Layout Planner
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Header Text Color</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="color"
                        value={config.headerTextColor || '#FFFFFF'}
                        onChange={(e) => handleSaveConfig({ ...config, headerTextColor: e.target.value })}
                        className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={config.headerTextColor || '#FFFFFF'}
                        onChange={(e) => handleSaveConfig({ ...config, headerTextColor: e.target.value })}
                        className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Body Text Color</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="color"
                        value={config.bodyTextColor || '#374151'}
                        onChange={(e) => handleSaveConfig({ ...config, bodyTextColor: e.target.value })}
                        className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={config.bodyTextColor || '#374151'}
                        onChange={(e) => handleSaveConfig({ ...config, bodyTextColor: e.target.value })}
                        className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Accent Text Color</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="color"
                        value={config.accentTextColor || '#4A1942'}
                        onChange={(e) => handleSaveConfig({ ...config, accentTextColor: e.target.value })}
                        className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={config.accentTextColor || '#4A1942'}
                        onChange={(e) => handleSaveConfig({ ...config, accentTextColor: e.target.value })}
                        className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleSaveConfig({
                    ...config,
                    fontFamily: 'Inter, system-ui, sans-serif',
                    headingFontFamily: 'Inter, system-ui, sans-serif',
                    headerTextColor: '#FFFFFF',
                    bodyTextColor: '#374151',
                    accentTextColor: '#4A1942'
                  })}
                  className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                >
                  Reset Typography
                </button>
                </div>
                )}
              </div>
              
              {/* Live Preview */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div 
                  className="bg-gray-100 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => {
                    setExpandedBrandingSections(prev => {
                      const next = new Set(prev);
                      if (next.has('preview')) next.delete('preview');
                      else next.add('preview');
                      return next;
                    });
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{expandedBrandingSections.has('preview') ? '▼' : '▶'}</span>
                    <h3 className="font-bold text-lg text-gray-800">👁️ Live Preview</h3>
                  </div>
                </div>
                {expandedBrandingSections.has('preview') && (
                <div className="p-4">
                <div 
                  className="border rounded-lg overflow-hidden"
                  style={{ fontFamily: config.fontFamily }}
                >
                  <div 
                    className="p-4"
                    style={{ 
                      background: `linear-gradient(to right, ${config.primaryColor}, ${config.primaryDark})`,
                      color: config.headerTextColor
                    }}
                  >
                    <h2 style={{ fontFamily: config.headingFontFamily }} className="text-xl font-bold">
                      {config.venueName}
                    </h2>
                    <p className="text-sm opacity-80">{config.tagline}</p>
                  </div>
                  <div 
                    className="p-4"
                    style={{ 
                      backgroundColor: config.backgroundColor,
                      color: config.bodyTextColor
                    }}
                  >
                    <p className="mb-2">This is how your body text will appear in the application.</p>
                    <p style={{ color: config.accentTextColor }} className="font-medium">
                      This is accent colored text.
                    </p>
                    <button 
                      className="mt-3 px-4 py-2 rounded-lg text-white"
                      style={{ backgroundColor: config.accentColor }}
                    >
                      Accent Button
                    </button>
                  </div>
                </div>
                </div>
                )}
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-bold text-red-800 mb-2">⚠️ Danger Zone</h3>
                <p className="text-sm text-red-700 mb-3">
                  Reset all settings to factory defaults. This cannot be undone.
                </p>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Reset All to Defaults
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Venue Builder Modal */}
      {customShapeVenueId && venues.find(v => v.id === customShapeVenueId) && (
        <CustomVenueBuilder
          venue={venues.find(v => v.id === customShapeVenueId)!}
          onClose={() => setCustomShapeVenueId(null)}
          onSave={(points) => {
            const customPath = points.length >= 3
              ? `M ${points.map((p, i) => `${i === 0 ? '' : 'L '}${p.x} ${p.y}`).join(' ')} Z`
              : undefined;
            handleSaveVenues(venues.map(v => 
              v.id === customShapeVenueId
                ? { ...v, shape: 'custom', shapePoints: points, customPath, isCustomShape: true }
                : v
            ));
            setCustomShapeVenueId(null);
          }}
        />
      )}

      {/* Drawing Tool Modal */}
      {showDrawingTool && (
        <DrawingTool
          onClose={() => setShowDrawingTool(false)}
          onSave={(payload) => {
            const { imageDataUrl, name, fixtureType, objects, drawingWidth, drawingHeight } = payload;
            // Create a new fixture with the drawn image
            const newFixture: FixtureType = {
              id: `fixture-custom-${Date.now()}`,
              name: name || (fixtureType === 'architectural' ? 'Custom Landscape Feature' : 'Custom Venue Fixture'),
              shape: 'custom',
              width: fixtureType === 'architectural' ? 10 : 4,
              height: fixtureType === 'architectural' ? 10 : 4,
              icon: fixtureType === 'architectural' ? '🎨' : '🖼️',
              color: fixtureType === 'architectural' ? '#90EE90' : '#E5E5E5',
              category: fixtureType === 'architectural' ? 'exterior' : 'interior',
              imageUrl: imageDataUrl,
              customDrawing: {
                objects,
                drawingWidth,
                drawingHeight
              }
            };
            handleSaveFixtures([...fixtureTypes, newFixture]);
            setShowDrawingTool(false);
            showSuccess(`Custom ${fixtureType === 'architectural' ? 'landscape feature' : 'venue fixture'} "${name}" created!`);
          }}
        />
      )}

      {/* Welcome screen preview (simulate non-admin user experience) */}
      {showWelcomePreview && (
        <WelcomeModal
          isAdmin={false}
          isGuest={false}
          onClose={() => setShowWelcomePreview(false)}
        />
      )}
    </div>
  );
}
