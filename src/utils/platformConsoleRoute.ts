export type PlatformConsoleSection =
  | 'overview'
  | 'venues'
  | 'venue-detail'
  | 'map'
  | 'onboard'
  | 'branding'
  | 'email'
  | 'chat'
  | 'audit';

export interface PlatformConsoleRoute {
  section: PlatformConsoleSection;
  venueId?: string;
}

const KNOWN: PlatformConsoleSection[] = [
  'overview',
  'venues',
  'map',
  'onboard',
  'branding',
  'email',
  'chat',
  'audit',
];

export function parsePlatformConsoleHash(hash: string): PlatformConsoleRoute {
  const raw = (hash || '').split('?')[0];
  const path = raw.replace(/^#\/?/, '');
  if (!path || path === 'platform-admin' || path === 'platform-login') {
    return { section: 'overview' };
  }

  const parts = path.replace(/^platform-admin\/?/, '').split('/').filter(Boolean);
  if (parts.length === 0) return { section: 'overview' };

  if (parts[0] === 'venues' && parts[1]) {
    return { section: 'venue-detail', venueId: decodeURIComponent(parts[1]) };
  }

  const section = parts[0] as PlatformConsoleSection;
  if (KNOWN.includes(section)) return { section };
  return { section: 'overview' };
}

export function buildPlatformConsoleHash(section: PlatformConsoleSection, venueId?: string): string {
  if (section === 'overview') return '#/platform-admin';
  if (section === 'venue-detail' && venueId) {
    return `#/platform-admin/venues/${encodeURIComponent(venueId)}`;
  }
  return `#/platform-admin/${section}`;
}
