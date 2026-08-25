import type { OrganizationStatus } from '../services/platform/platformTypes';

export type PlatformConsoleSection =
  | 'overview'
  | 'venues'
  | 'venue-detail'
  | 'map'
  | 'onboard'
  | 'branding'
  | 'chat'
  | 'audit';

export type VenueQueueFilter = 'all' | 'awaiting-admin' | 'pending-invite' | 'expired-invite';

export interface PlatformVenueDirectoryFilter {
  status?: OrganizationStatus | 'all';
  queue?: VenueQueueFilter;
}

export interface PlatformConsoleRoute {
  section: PlatformConsoleSection;
  venueId?: string;
  venueStatus?: OrganizationStatus | 'all';
  venueQueue?: VenueQueueFilter;
}

const KNOWN: PlatformConsoleSection[] = [
  'overview',
  'venues',
  'map',
  'onboard',
  'branding',
  'chat',
  'audit',
];

const STATUSES: OrganizationStatus[] = ['provisioning', 'active', 'suspended', 'archived'];
const QUEUES: VenueQueueFilter[] = ['all', 'awaiting-admin', 'pending-invite', 'expired-invite'];

function parseStatus(value: string | null): OrganizationStatus | 'all' | undefined {
  if (!value) return undefined;
  if (value === 'all') return 'all';
  return STATUSES.includes(value as OrganizationStatus) ? (value as OrganizationStatus) : undefined;
}

function parseQueue(value: string | null): VenueQueueFilter | undefined {
  if (!value) return undefined;
  return QUEUES.includes(value as VenueQueueFilter) ? (value as VenueQueueFilter) : undefined;
}

export function parsePlatformConsoleHash(hash: string): PlatformConsoleRoute {
  const raw = hash || '';
  const qIndex = raw.indexOf('?');
  const pathPart = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const queryPart = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
  const path = pathPart.replace(/^#\/?/, '');
  if (!path || path === 'platform-admin' || path === 'platform-login') {
    return { section: 'overview' };
  }

  const parts = path.replace(/^platform-admin\/?/, '').split('/').filter(Boolean);
  if (parts.length === 0) return { section: 'overview' };

  if (parts[0] === 'venues' && parts[1]) {
    return { section: 'venue-detail', venueId: decodeURIComponent(parts[1]) };
  }

  if (parts[0] === 'email') return { section: 'branding' };

  const section = parts[0] as PlatformConsoleSection;
  if (section === 'venues') {
    const params = new URLSearchParams(queryPart);
    return {
      section: 'venues',
      venueStatus: parseStatus(params.get('status')) || 'all',
      venueQueue: parseQueue(params.get('queue')) || 'all',
    };
  }
  if (KNOWN.includes(section)) return { section };
  return { section: 'overview' };
}

export function buildPlatformConsoleHash(
  section: PlatformConsoleSection,
  venueId?: string,
  filter?: PlatformVenueDirectoryFilter,
): string {
  if (section === 'overview') return '#/platform-admin';
  if (section === 'venue-detail' && venueId) {
    return `#/platform-admin/venues/${encodeURIComponent(venueId)}`;
  }
  if (section === 'venues') {
    const params = new URLSearchParams();
    if (filter?.status && filter.status !== 'all') params.set('status', filter.status);
    if (filter?.queue && filter.queue !== 'all') params.set('queue', filter.queue);
    const query = params.toString();
    return query ? `#/platform-admin/venues?${query}` : '#/platform-admin/venues';
  }
  return `#/platform-admin/${section}`;
}
