export interface InviteTemplateTag {
  tag: string;
  label: string;
}

export const VENUE_ADMIN_INVITE_TAGS: InviteTemplateTag[] = [
  { tag: '{contactName}', label: 'Full name' },
  { tag: '{contactFirstName}', label: 'First name' },
  { tag: '{contactLastName}', label: 'Last name' },
  { tag: '{venueName}', label: 'Venue name' },
  { tag: '{adminEmail}', label: 'Admin email' },
  { tag: '{expiresAt}', label: 'Expires' },
  { tag: '{platformName}', label: 'Platform name' },
];

export function insertTextAtCursor(value: string, insert: string, start: number, end = start): string {
  const safeStart = Math.max(0, Math.min(start, value.length));
  const safeEnd = Math.max(safeStart, Math.min(end, value.length));
  return `${value.slice(0, safeStart)}${insert}${value.slice(safeEnd)}`;
}
