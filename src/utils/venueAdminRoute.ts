export const VENUE_ADMIN_SECTIONS = [
  'overview',
  'venues',
  'seating',
  'structures',
  'decor',
  'spacing',
  'templates',
  'guidelines',
  'couples',
  'packages',
  'wayfinding',
  'event-questions',
  'branding',
  'users',
  'access-control',
  'invites',
  'platform-chat',
  'communication-templates',
  'operations-settings',
  'security-audit',
  'backup',
] as const;

export type VenueAdminSection = (typeof VENUE_ADMIN_SECTIONS)[number];

export function parseVenueAdminHash(hash = ''): VenueAdminSection | null {
  const raw = (hash || '').split('?')[0];
  if (raw !== '#/admin' && !raw.startsWith('#/admin/')) return null;
  const rest = raw.slice('#/admin'.length).replace(/^\//, '');
  if (!rest || rest === 'overview') return 'overview';
  return (VENUE_ADMIN_SECTIONS as readonly string[]).includes(rest) ? (rest as VenueAdminSection) : 'overview';
}

export function buildVenueAdminHash(section: string): string {
  if (!section || section === 'overview') return '#/admin';
  return `#/admin/${section}`;
}
