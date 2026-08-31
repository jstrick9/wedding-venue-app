import { useCallback, useEffect, useMemo, useRef } from 'react';
import { canSyncEntities, pullEntities, pushEntities, pushEntityDomain } from '../services/sync/entitySync';
import { subscribeToEntityChanges } from '../services/sync/entityRealtime';
import { emit } from '../utils/appEvents';

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
      loadedRef.current = true;
      onLoaded?.();
    } catch (err) {
      // Leave loadedRef false so a failed first pull can retry on the next mount.
      console.error('Failed to load entities from backend:', err);
    }
  }, [enabled, context, onLoaded]);

  const reportPushFailure = useCallback((domain: string, err: unknown) => {
    // A cloud push failed after the local write succeeded. The user's change is
    // safe locally but did not reach the shared backend — surface it (Review
    // #245 P2-F) instead of failing silently.
    emit('spm_cloud_sync_error', {
      domain,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    });
  }, []);

  const saveToBackend = useCallback(async () => {
    if (!enabled || !context) return;
    try {
      await pushEntities(context);
    } catch (err) {
      console.error('Failed to push entities to backend:', err);
      reportPushFailure('entities', err);
    }
  }, [enabled, context, reportPushFailure]);

  const saveDomainToBackend = useCallback(
    async (domain: string) => {
      if (!enabled || !context) return;
      try {
        await pushEntityDomain(context, domain);
      } catch (err) {
        console.error(`Failed to push domain ${domain} to backend:`, err);
        reportPushFailure(domain, err);
      }
    },
    [enabled, context, reportPushFailure],
  );

  // Reset the loaded flag whenever the org/user context changes so a venue
  // switch pulls that organization's data (P1-5). When a new context is seen we
  // also re-run the initial pull.
  useEffect(() => {
    if (!enabled || !context) return;
    loadedRef.current = false;
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
