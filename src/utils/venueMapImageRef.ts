const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const MANAGED_VENUE_MAP_IMAGE_PATTERN = new RegExp(
  `^sp://venue-map-images/(${UUID_PATTERN})/([^/?#\\u0000-\\u001f]+)$`,
);

/**
 * Whether a base-map reference points at a private object governed by the
 * Venue Map publication/lifecycle policy. In cloud mode, portal projections
 * must never receive external URLs, embedded data, or the broader legacy
 * `venue-images` bucket.
 */
export function isManagedVenueMapImageRef(
  value: unknown,
  organizationId?: string,
): value is string {
  if (typeof value !== 'string' || value.length > 1100) return false;
  const match = MANAGED_VENUE_MAP_IMAGE_PATTERN.exec(value);
  if (!match) return false;
  return !organizationId || match[1].toLowerCase() === organizationId.toLowerCase();
}
