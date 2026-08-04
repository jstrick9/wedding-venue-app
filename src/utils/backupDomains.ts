/**
 * Single source of truth for every persistent data domain in the app.
 *
 * The backup/export, backup/import, and corruption-recovery systems all derive
 * their behavior from this registry. Keeping the domain list in one place
 * prevents the class of drift where a domain is exported but not restored, or
 * missing from recovery (previously the cause of silent backup-restore data
 * loss for versioned keys).
 */
import { STORAGE_KEYS } from '../constants/storageKeys';
import { STORAGE_VERSIONS } from '../constants/storageVersions';
import { getConfig } from '../config';
import { getCoupleEvents } from '../services/couples/coupleService';
import { getCoupleAnswersForBackup } from '../services/couples/coupleAnswersService';
import { getCoupleMessagesForBackup } from '../services/couples/coupleChatService';
import {
  getDecorArrangements,
  getDecorCategories,
  getDecorItems,
  getDecorPackages,
  getFixtureTypes,
  getGuidelines,
  getLinenColors,
  getSavedLayouts,
  getTableSpecs,
  getTemplates,
  getUsers,
  getVenues,
} from '../hooks/useLayoutState';
import { getStoredDirectMessages } from '../hooks/useDirectMessages';
import {
  getAlignmentSettings,
  getChairSpecs,
  getIndoorFeatureTemplates,
  getOutdoorFeatureTemplates,
  getSpacingSettings,
  getWallStyles,
} from '../data/venueData';
import {
  getGuestPortalConfig,
  getPortalGuests,
  getPortalRSVPSubmissions,
} from './guestPortal';
import { saveVersionedStorage } from './storage';
import type { BackupPayload } from './backupTypes';

export interface BackupDomain {
  /** Key in BackupPayload. */
  key: keyof BackupPayload;
  /** localStorage key. */
  storageKey: string;
  /** Human-readable label (used by recovery/health UI). */
  label: string;
  /** Default value used when the domain is corrupt/missing. */
  defaultValue: unknown;
  /** Whether the domain is tracked by the corruption-health/recovery system. */
  recovery: boolean;
  /** Versioned-storage version if this domain uses the envelope format. */
  version?: number;
  /** Read the current value (unwrapped for versioned domains). */
  read: () => unknown;
  /** Persist a value in the correct storage format. */
  write: (value: unknown) => void;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw != null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (value === undefined) return;
  localStorage.setItem(key, JSON.stringify(value));
}

function writeVersioned(key: string, version: number, value: unknown): void {
  if (value === undefined) return;
  saveVersionedStorage(key, version, value);
}

export const BACKUP_DOMAINS: BackupDomain[] = [
  {
    key: 'config',
    storageKey: STORAGE_KEYS.CONFIG,
    label: 'Branding Config',
    defaultValue: null,
    recovery: true,
    version: STORAGE_VERSIONS.CONFIG,
    read: () => getConfig(),
    write: (v) => writeVersioned(STORAGE_KEYS.CONFIG, STORAGE_VERSIONS.CONFIG, v),
  },
  {
    key: 'venues',
    storageKey: STORAGE_KEYS.VENUES,
    label: 'Venues',
    defaultValue: [],
    recovery: true,
    read: () => getVenues(),
    write: (v) => writeJson(STORAGE_KEYS.VENUES, v),
  },
  {
    key: 'tableSpecs',
    storageKey: STORAGE_KEYS.TABLE_SPECS,
    label: 'Table Specs',
    defaultValue: [],
    recovery: true,
    read: () => getTableSpecs(),
    write: (v) => writeJson(STORAGE_KEYS.TABLE_SPECS, v),
  },
  {
    key: 'fixtureTypes',
    storageKey: STORAGE_KEYS.FIXTURE_TYPES,
    label: 'Fixture Types',
    defaultValue: [],
    recovery: true,
    read: () => getFixtureTypes(),
    write: (v) => writeJson(STORAGE_KEYS.FIXTURE_TYPES, v),
  },
  {
    key: 'guidelines',
    storageKey: STORAGE_KEYS.GUIDELINES,
    label: 'Guidelines',
    defaultValue: [],
    recovery: true,
    read: () => getGuidelines(),
    write: (v) => writeJson(STORAGE_KEYS.GUIDELINES, v),
  },
  {
    key: 'templates',
    storageKey: STORAGE_KEYS.TEMPLATES,
    label: 'Templates',
    defaultValue: [],
    recovery: true,
    read: () => getTemplates(),
    write: (v) => writeJson(STORAGE_KEYS.TEMPLATES, v),
  },
  {
    key: 'users',
    storageKey: STORAGE_KEYS.USERS,
    label: 'Users',
    defaultValue: [],
    recovery: true,
    read: () => getUsers(),
    write: (v) => writeJson(STORAGE_KEYS.USERS, v),
  },
  {
    key: 'linenColors',
    storageKey: STORAGE_KEYS.LINEN_COLORS,
    label: 'Linen Colors',
    defaultValue: [],
    recovery: true,
    read: () => getLinenColors(),
    write: (v) => writeJson(STORAGE_KEYS.LINEN_COLORS, v),
  },
  {
    key: 'chairSpecs',
    storageKey: STORAGE_KEYS.CHAIR_SPECS_PRIMARY,
    label: 'Chair Specs',
    defaultValue: [],
    recovery: true,
    read: () => getChairSpecs(),
    write: (v) => writeJson(STORAGE_KEYS.CHAIR_SPECS_PRIMARY, v),
  },
  {
    key: 'wallStyles',
    storageKey: STORAGE_KEYS.WALL_STYLES,
    label: 'Wall Styles',
    defaultValue: [],
    recovery: true,
    read: () => getWallStyles(),
    write: (v) => writeJson(STORAGE_KEYS.WALL_STYLES, v),
  },
  {
    key: 'spacingSettings',
    storageKey: STORAGE_KEYS.SPACING_SETTINGS,
    label: 'Spacing Settings',
    defaultValue: null,
    recovery: true,
    read: () => getSpacingSettings(),
    write: (v) => writeJson(STORAGE_KEYS.SPACING_SETTINGS, v),
  },
  {
    key: 'alignmentSettings',
    storageKey: STORAGE_KEYS.ALIGNMENT_SETTINGS,
    label: 'Alignment Settings',
    defaultValue: null,
    recovery: true,
    read: () => getAlignmentSettings(),
    write: (v) => writeJson(STORAGE_KEYS.ALIGNMENT_SETTINGS, v),
  },
  {
    key: 'indoorFeatureTemplates',
    storageKey: STORAGE_KEYS.INDOOR_FEATURE_TEMPLATES,
    label: 'Indoor Feature Templates',
    defaultValue: [],
    recovery: true,
    read: () => getIndoorFeatureTemplates(),
    write: (v) => writeJson(STORAGE_KEYS.INDOOR_FEATURE_TEMPLATES, v),
  },
  {
    key: 'outdoorFeatureTemplates',
    storageKey: STORAGE_KEYS.OUTDOOR_FEATURE_TEMPLATES,
    label: 'Outdoor Feature Templates',
    defaultValue: [],
    recovery: true,
    read: () => getOutdoorFeatureTemplates(),
    write: (v) => writeJson(STORAGE_KEYS.OUTDOOR_FEATURE_TEMPLATES, v),
  },
  {
    key: 'savedLayouts',
    storageKey: STORAGE_KEYS.SAVED_LAYOUTS,
    label: 'Saved Layouts',
    defaultValue: [],
    recovery: true,
    version: STORAGE_VERSIONS.SAVED_LAYOUTS,
    read: () => getSavedLayouts(),
    write: (v) => writeVersioned(STORAGE_KEYS.SAVED_LAYOUTS, STORAGE_VERSIONS.SAVED_LAYOUTS, v),
  },
  {
    key: 'decorItems',
    storageKey: STORAGE_KEYS.DECOR_ITEMS,
    label: 'Decor Catalog',
    defaultValue: [],
    recovery: true,
    read: () => getDecorItems(),
    write: (v) => writeJson(STORAGE_KEYS.DECOR_ITEMS, v),
  },
  {
    key: 'decorCategories',
    storageKey: STORAGE_KEYS.DECOR_CATEGORIES,
    label: 'Decor Categories',
    defaultValue: [],
    recovery: true,
    read: () => getDecorCategories(),
    write: (v) => writeJson(STORAGE_KEYS.DECOR_CATEGORIES, v),
  },
  {
    key: 'decorArrangements',
    storageKey: STORAGE_KEYS.DECOR_ARRANGEMENTS,
    label: 'Decor Arrangements',
    defaultValue: [],
    recovery: true,
    read: () => getDecorArrangements(),
    write: (v) => writeJson(STORAGE_KEYS.DECOR_ARRANGEMENTS, v),
  },
  {
    key: 'decorPackages',
    storageKey: STORAGE_KEYS.DECOR_PACKAGES,
    label: 'Decor Packages',
    defaultValue: [],
    recovery: true,
    read: () => getDecorPackages(),
    write: (v) => writeJson(STORAGE_KEYS.DECOR_PACKAGES, v),
  },
  {
    key: 'eventRoles',
    storageKey: STORAGE_KEYS.EVENT_ROLES,
    label: 'Event Roles',
    defaultValue: [],
    recovery: true,
    read: () => readJson(STORAGE_KEYS.EVENT_ROLES, []),
    write: (v) => writeJson(STORAGE_KEYS.EVENT_ROLES, v),
  },
  {
    key: 'eventQuestions',
    storageKey: STORAGE_KEYS.EVENT_QUESTIONS,
    label: 'Event Questions',
    defaultValue: [],
    recovery: true,
    read: () => readJson(STORAGE_KEYS.EVENT_QUESTIONS, []),
    write: (v) => writeJson(STORAGE_KEYS.EVENT_QUESTIONS, v),
  },
  {
    key: 'eventAnswers',
    storageKey: STORAGE_KEYS.EVENT_ANSWERS,
    label: 'Event Answers',
    defaultValue: [],
    recovery: true,
    read: () => readJson(STORAGE_KEYS.EVENT_ANSWERS, []),
    write: (v) => writeJson(STORAGE_KEYS.EVENT_ANSWERS, v),
  },
  {
    key: 'eventSubmissions',
    storageKey: STORAGE_KEYS.EVENT_SUBMISSIONS,
    label: 'Event Submissions',
    defaultValue: [],
    recovery: true,
    read: () => readJson(STORAGE_KEYS.EVENT_SUBMISSIONS, []),
    write: (v) => writeJson(STORAGE_KEYS.EVENT_SUBMISSIONS, v),
  },
  {
    key: 'directMessages',
    storageKey: STORAGE_KEYS.DIRECT_MESSAGES,
    label: 'Direct Messages',
    defaultValue: [],
    recovery: true,
    version: STORAGE_VERSIONS.DIRECT_MESSAGES,
    read: () => getStoredDirectMessages(),
    write: (v) => writeVersioned(STORAGE_KEYS.DIRECT_MESSAGES, STORAGE_VERSIONS.DIRECT_MESSAGES, v),
  },
  {
    key: 'portalConfig',
    storageKey: STORAGE_KEYS.PORTAL_CONFIG,
    label: 'Guest Portal Config',
    defaultValue: null,
    recovery: true,
    version: STORAGE_VERSIONS.PORTAL_CONFIG,
    read: () => getGuestPortalConfig(),
    write: (v) => writeVersioned(STORAGE_KEYS.PORTAL_CONFIG, STORAGE_VERSIONS.PORTAL_CONFIG, v),
  },
  {
    key: 'portalGuests',
    storageKey: STORAGE_KEYS.PORTAL_GUESTS,
    label: 'Guest Portal Guests',
    defaultValue: [],
    recovery: true,
    version: STORAGE_VERSIONS.PORTAL_GUESTS,
    read: () => getPortalGuests(),
    write: (v) => writeVersioned(STORAGE_KEYS.PORTAL_GUESTS, STORAGE_VERSIONS.PORTAL_GUESTS, v),
  },
  {
    key: 'coupleEvents',
    storageKey: STORAGE_KEYS.COUPLE_EVENTS,
    label: 'Couple Events',
    defaultValue: [],
    recovery: true,
    version: STORAGE_VERSIONS.COUPLE_EVENTS,
    read: () => getCoupleEvents(),
    write: (v) => writeVersioned(STORAGE_KEYS.COUPLE_EVENTS, STORAGE_VERSIONS.COUPLE_EVENTS, v),
  },
  {
    key: 'coupleAnswers',
    storageKey: STORAGE_KEYS.COUPLE_ANSWERS,
    label: 'Couple Answers',
    defaultValue: [],
    recovery: true,
    version: STORAGE_VERSIONS.COUPLE_ANSWERS,
    read: () => getCoupleAnswersForBackup(),
    write: (v) => writeVersioned(STORAGE_KEYS.COUPLE_ANSWERS, STORAGE_VERSIONS.COUPLE_ANSWERS, v),
  },
  {
    key: 'coupleMessages',
    storageKey: STORAGE_KEYS.COUPLE_MESSAGES,
    label: 'Couple Chat Messages',
    defaultValue: [],
    recovery: true,
    version: STORAGE_VERSIONS.COUPLE_MESSAGES,
    read: () => getCoupleMessagesForBackup(),
    write: (v) => writeVersioned(STORAGE_KEYS.COUPLE_MESSAGES, STORAGE_VERSIONS.COUPLE_MESSAGES, v),
  },
  {
    key: 'rsvpSubmissions',
    storageKey: STORAGE_KEYS.RSVP_SUBMISSIONS,
    label: 'RSVP Submissions',
    defaultValue: [],
    recovery: true,
    version: STORAGE_VERSIONS.RSVP_SUBMISSIONS,
    read: () => getPortalRSVPSubmissions(),
    write: (v) => writeVersioned(STORAGE_KEYS.RSVP_SUBMISSIONS, STORAGE_VERSIONS.RSVP_SUBMISSIONS, v),
  },
  {
    key: 'staffTasks',
    storageKey: STORAGE_KEYS.STAFF_TASKS,
    label: 'Staff Tasks',
    defaultValue: [],
    recovery: true,
    read: () => readJson(STORAGE_KEYS.STAFF_TASKS, []),
    write: (v) => writeJson(STORAGE_KEYS.STAFF_TASKS, v),
  },
  {
    key: 'staffAreas',
    storageKey: STORAGE_KEYS.STAFF_AREAS,
    label: 'Staff Areas',
    defaultValue: [],
    recovery: true,
    read: () => readJson(STORAGE_KEYS.STAFF_AREAS, []),
    write: (v) => writeJson(STORAGE_KEYS.STAFF_AREAS, v),
  },
  {
    key: 'staffShifts',
    storageKey: STORAGE_KEYS.STAFF_SHIFTS,
    label: 'Staff Shifts',
    defaultValue: [],
    recovery: true,
    read: () => readJson(STORAGE_KEYS.STAFF_SHIFTS, []),
    write: (v) => writeJson(STORAGE_KEYS.STAFF_SHIFTS, v),
  },
  {
    key: 'vendors',
    storageKey: STORAGE_KEYS.VENDORS,
    label: 'Vendors',
    defaultValue: [],
    recovery: true,
    read: () => readJson(STORAGE_KEYS.VENDORS, []),
    write: (v) => writeJson(STORAGE_KEYS.VENDORS, v),
  },
  {
    key: 'vendorPayments',
    storageKey: STORAGE_KEYS.VENDOR_PAYMENTS,
    label: 'Vendor Payments',
    defaultValue: [],
    recovery: true,
    read: () => readJson(STORAGE_KEYS.VENDOR_PAYMENTS, []),
    write: (v) => writeJson(STORAGE_KEYS.VENDOR_PAYMENTS, v),
  },
  {
    key: 'timelines',
    storageKey: STORAGE_KEYS.TIMELINES,
    label: 'Timelines',
    defaultValue: [],
    recovery: true,
    read: () => readJson(STORAGE_KEYS.TIMELINES, []),
    write: (v) => writeJson(STORAGE_KEYS.TIMELINES, v),
  },
  {
    key: 'rbacRoles',
    storageKey: STORAGE_KEYS.RBAC_ROLES,
    label: 'RBAC Roles',
    defaultValue: [],
    recovery: true,
    read: () => readJson(STORAGE_KEYS.RBAC_ROLES, []),
    write: (v) => writeJson(STORAGE_KEYS.RBAC_ROLES, v),
  },
  {
    key: 'rbacGroups',
    storageKey: STORAGE_KEYS.RBAC_GROUPS,
    label: 'RBAC Permission Groups',
    defaultValue: [],
    recovery: true,
    read: () => readJson(STORAGE_KEYS.RBAC_GROUPS, []),
    write: (v) => writeJson(STORAGE_KEYS.RBAC_GROUPS, v),
  },
  {
    key: 'rbacAudit',
    storageKey: STORAGE_KEYS.RBAC_AUDIT,
    label: 'RBAC Audit Log',
    defaultValue: [],
    recovery: true,
    read: () => readJson(STORAGE_KEYS.RBAC_AUDIT, []),
    write: (v) => writeJson(STORAGE_KEYS.RBAC_AUDIT, v),
  },
];
