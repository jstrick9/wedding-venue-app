/** English possessive for a venue display name. */
export function possessiveVenueName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  if (/['’]s$/i.test(trimmed)) return trimmed;
  if (/s$/i.test(trimmed)) return `${trimmed}'`;
  return `${trimmed}'s`;
}

/** Setup heading: "Claim Seven Paths Manor's Venue Workspace". */
export function claimVenueWorkspaceTitle(venueName?: string | null): string {
  const name = (venueName || '').trim();
  if (!name) return 'Claim Venue Workspace';
  return `Claim ${possessiveVenueName(name)} Venue Workspace`;
}
