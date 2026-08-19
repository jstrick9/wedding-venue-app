const ACTIVE_ORGANIZATION_SLUG_KEY = 'spm_active_organization_slug';

export function getActiveOrganizationSlug(): string | undefined {
  try {
    const value = sessionStorage.getItem(ACTIVE_ORGANIZATION_SLUG_KEY) || localStorage.getItem(ACTIVE_ORGANIZATION_SLUG_KEY);
    return value?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export function setActiveOrganizationSlug(slug?: string | null): void {
  try {
    if (slug?.trim()) {
      sessionStorage.setItem(ACTIVE_ORGANIZATION_SLUG_KEY, slug.trim());
      localStorage.setItem(ACTIVE_ORGANIZATION_SLUG_KEY, slug.trim());
    } else {
      sessionStorage.removeItem(ACTIVE_ORGANIZATION_SLUG_KEY);
      localStorage.removeItem(ACTIVE_ORGANIZATION_SLUG_KEY);
    }
  } catch {
    // Browser storage is a convenience only; RLS remains authoritative.
  }
}
