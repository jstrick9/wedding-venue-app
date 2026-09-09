import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  canSyncEntities,
  pullEntities,
  pushEntities,
  pushEntityDomain,
  saveVenueMapEntity,
} from '../services/sync/entitySync';
import type { VenueMapSaveResult } from '../services/repository/entityRepository';
import { subscribeToEntityChanges } from '../services/sync/entityRealtime';
import { emit } from '../utils/appEvents';

export interface EntityBackendSyncOptions {
  userId: string | null;
  organizationId: string | null;
  /** Called after a successful pull so the UI can re-read entities. */
  onLoaded?: () => void;
}

export type VenueMapBackendSaveResult = VenueMapSaveResult | {
  status: 'error';
  error: string;
};

export interface EntityBackendSync {
  enabled: boolean;
  /** True only after this exact user/organization context has been hydrated. */
  hydrated: boolean;
  loading: boolean;
  loadError: string | null;
  loadFromBackend: () => Promise<void>;
  saveToBackend: () => Promise<void>;
  /** Push a single domain to the backend (e.g. after an admin edit). */
  saveDomainToBackend: (domain: string) => Promise<void>;
  /** Save canonical map geometry with an editor-loaded revision guard. */
  saveVenueMapToBackend: (
    payload: unknown,
    expectedUpdatedAt: string | null | undefined,
    force?: boolean,
  ) => Promise<VenueMapBackendSaveResult>;
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

  // Memoize the context so its reference is stable across renders.
  const context = useMemo(
    () => (userId && organizationId ? { userId, organizationId } : null),
    [userId, organizationId],
  );
  const contextKey = context ? `${context.organizationId}:${context.userId}` : null;
  const activeContextKeyRef = useRef<string | null>(contextKey);
  const loadGenerationRef = useRef(0);
  // Update during render so an old request is ineligible before any effect for
  // the newly selected tenant has a chance to run.
  activeContextKeyRef.current = contextKey;
  const [loadState, setLoadState] = useState<{
    contextKey: string;
    status: 'loading' | 'ready' | 'error';
    error: string | null;
  } | null>(null);

  useEffect(() => {
    activeContextKeyRef.current = contextKey;
    return () => {
      if (activeContextKeyRef.current === contextKey) activeContextKeyRef.current = null;
      loadGenerationRef.current += 1;
    };
  }, [contextKey]);

  const loadFromBackend = useCallback(async () => {
    if (!enabled || !context || !contextKey) return;
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    const shouldApply = () =>
      activeContextKeyRef.current === contextKey
      && loadGenerationRef.current === generation;
    setLoadState({ contextKey, status: 'loading', error: null });
    try {
      const applied = await pullEntities(context, shouldApply);
      if (applied === false || !shouldApply()) return;
      setLoadState({ contextKey, status: 'ready', error: null });
      onLoaded?.();
    } catch (err) {
      if (!shouldApply()) return;
      const message = err instanceof Error ? err.message : String(err);
      // Do not expose a previous organization's browser cache after a failed
      // pull. The workspace remains gated and offers an explicit retry.
      setLoadState({ contextKey, status: 'error', error: message });
      console.error('Failed to load entities from backend:', err);
    }
  }, [enabled, context, contextKey, onLoaded]);

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

  const saveVenueMapToBackend = useCallback(
    async (
      payload: unknown,
      expectedUpdatedAt: string | null | undefined,
      force = false,
    ): Promise<VenueMapBackendSaveResult> => {
      if (!enabled || !context) return { status: 'saved', updatedAt: null };
      try {
        return await saveVenueMapEntity(context, payload, expectedUpdatedAt, force);
      } catch (err) {
        console.error('Failed to push the venue map to backend:', err);
        // Unlike generic entity saves, the revision-aware editor has not yet
        // promoted this in-memory draft to the canonical browser cache. Let the
        // editor say it remains open/unsaved instead of claiming it is persisted.
        return {
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [enabled, context],
  );

  // A context-key mismatch is treated as not hydrated synchronously during
  // render, before this effect runs. That prevents a one-frame exposure of the
  // previous organization's cached workspace during an account/venue switch.
  useEffect(() => {
    if (!enabled || !context) return;
    void loadFromBackend();
  }, [enabled, context, loadFromBackend]);

  useEffect(() => {
    if (!enabled || !context) return;
    return subscribeToEntityChanges(context, () => onLoaded?.());
  }, [enabled, context, onLoaded]);

  const stateMatchesContext = Boolean(contextKey && loadState?.contextKey === contextKey);
  const hydrated = !enabled || (stateMatchesContext && loadState?.status === 'ready');
  const loading = enabled && (!stateMatchesContext || loadState?.status === 'loading');
  const loadError = enabled && stateMatchesContext && loadState?.status === 'error'
    ? loadState.error
    : null;

  // Stable object identity so consumers can depend on it without re-rendering.
  return useMemo(
    () => ({
      enabled,
      hydrated,
      loading,
      loadError,
      loadFromBackend,
      saveToBackend,
      saveDomainToBackend,
      saveVenueMapToBackend,
    }),
    [
      enabled,
      hydrated,
      loading,
      loadError,
      loadFromBackend,
      saveToBackend,
      saveDomainToBackend,
      saveVenueMapToBackend,
    ],
  );
}
