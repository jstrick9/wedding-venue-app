export const VENUE_HOME_HASH = '#/home';

export function isVenueHomeHash(hash = ''): boolean {
  const raw = (hash || '').split('?')[0];
  return raw === '#/home' || raw === '#/home/' || raw === '' || raw === '#/';
}

/** Leftover hashes from before Home was the venue workspace URL. */
export function isLegacyVenueHomeHash(hash = ''): boolean {
  const raw = (hash || '').split('?')[0];
  return raw === '#/dashboard' || raw.startsWith('#/dashboard/') || raw === '#/venue' || raw === '#/venue/';
}

export function needsVenueHomeHashRewrite(hash = ''): boolean {
  return isLegacyVenueHomeHash(hash) || hash === '' || hash === '#/';
}