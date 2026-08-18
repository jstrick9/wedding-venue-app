import { useCallback, useEffect, useMemo, useRef } from 'react';
import { canSyncEntities, pullEntities, pushEntities, pushEntityDomain } from '../services/sync/entitySync';
import { subscribeToEntityChanges } from '../services/sync/entityRealtime';

export interface EntityBackendSyncOptions {
  userId: string | null;
  organizationId: string | null;
  /** Called after a successful pull so the UI can re-read entities. */
  onLoaded?: () => void;
}

export interface EntityBackendSync {
  enabled: boolean;
  loadFromBackend: () => Promise<void>;
  saveToBackend: () => Promise<void>;
  /** Push a single domain to the backend (e.g. after an admin edit). */
  saveDomainToBackend: (domain: string) => Promise<void>;
}

/**
 * Wires the catalog/asset/design domains to the platform backend when enabled.
 * - On mount, pulls the org's entity domains from Supabase (local mode no-op).
 * - Exposes saveToBackend/saveDomainToBackend so admin edits can flush.
 */
export function useEntityBackendSync({
  userId,
  organizationId,
  onLoaded,
}: EntityBackendSyncOptions): EntityBackendSync {
  const enabled = canSyncEntities(organizationId);
  const loadedRef = useRef(false);

  // Memoize the context so its reference is stable across renders.
  const context = useMemo(
    () => (userId && organizationId ? { userId, organizationId } : null),
    [userId, organizationId],
  );

  const loadFromBackend = useCallback(async () => {
    if (!enabled || !context) return;
    try {
      await pullEntities(context);
      onLoaded?.();
    } catch (err) {
      console.error('Failed to load entities from backend:', err);
    }
  }, [enabled, context, onLoaded]);

  const saveToBackend = useCallback(async () => {
    if (!enabled || !context) return;
    try {
      await pushEntities(context);
    } catch (err) {
      console.error('Failed to push entities to backend:', err);
    }
  }, [enabled, context]);

  const saveDomainToBackend = useCallback(
    async (domain: string) => {
      if (!enabled || !context) return;
      try {
        await pushEntityDomain(context, domain);
      } catch (err) {
        console.error(`Failed to push domain ${domain} to backend:`, err);
      }
    },
    [enabled, context],
  );

  useEffect(() => {
    if (!enabled || !context || loadedRef.current) return;
    loadedRef.current = true;
    void loadFromBackend();
  }, [enabled, context, loadFromBackend]);

  useEffect(() => {
    if (!enabled || !context) return;
    return subscribeToEntityChanges(context, () => onLoaded?.());
  }, [enabled, context, onLoaded]);

  // Stable object identity so consumers can depend on it without re-rendering.
  return useMemo(
    () => ({ enabled, loadFromBackend, saveToBackend, saveDomainToBackend }),
    [enabled, loadFromBackend, saveToBackend, saveDomainToBackend],
  );
}
