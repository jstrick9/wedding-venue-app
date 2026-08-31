import { useCallback, useEffect, useMemo, useRef } from 'react';
import { canSyncLayouts, pullLayouts, pushLayouts } from '../services/sync/layoutSync';
import { subscribeToLayoutChanges } from '../services/sync/layoutRealtime';
import { emit } from '../utils/appEvents';

export interface LayoutBackendSyncOptions {
  userId: string | null;
  organizationId: string | null;
  /** Called after a successful pull from the backend so the UI can re-read layouts. */
  onLoaded?: () => void;
}

export interface LayoutBackendSync {
  /** True when the current session should sync layouts to the backend. */
  enabled: boolean;
  /** Pull layouts from the backend into local state (call on load). */
  loadFromBackend: () => Promise<void>;
  /** Push current layouts to the backend (call after save/delete). */
  saveToBackend: () => Promise<void>;
}

/**
 * Wires layout persistence to the platform backend when enabled. When the
 * platform is `supabase` and an organization is known:
 *  - `loadFromBackend()` is called automatically on mount so the user sees
 *    their shared layouts.
 *  - `saveToBackend()` is exposed for the save/delete handlers to flush the
 *    current layouts to the shared store.
 * In `local` mode everything is a no-op (localStorage already owns the data).
 */
export function useLayoutBackendSync({
  userId,
  organizationId,
  onLoaded,
}: LayoutBackendSyncOptions): LayoutBackendSync {
  const enabled = canSyncLayouts(organizationId);
  const loadedRef = useRef(false);

  // Memoize the context so its reference is stable across renders (a fresh
  // object literal each render would otherwise re-trigger the realtime
  // subscription on every render, churning the Supabase channel).
  const context = useMemo(
    () => (userId && organizationId ? { userId, organizationId } : null),
    [userId, organizationId],
  );

  const loadFromBackend = useCallback(async () => {
    if (!enabled || !context) return;
    try {
      await pullLayouts(context);
      loadedRef.current = true;
      onLoaded?.();
    } catch (err) {
      // Leave loadedRef false so a failed first pull can retry on the next mount.
      console.error('Failed to load layouts from backend:', err);
    }
  }, [enabled, context, onLoaded]);

  const saveToBackend = useCallback(async () => {
    if (!enabled || !context) return;
    try {
      await pushLayouts(context);
    } catch (err) {
      console.error('Failed to push layouts to backend:', err);
      // Local saves succeeded but the shared backend did not get them — tell
      // the user instead of failing silently (Review #245 P2-F).
      emit('spm_cloud_sync_error', {
        domain: 'layouts',
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      });
    }
  }, [enabled, context]);

  // Reset the loaded flag whenever the org/user context changes so a venue
  // switch pulls that organization's layouts (P1-5).
  useEffect(() => {
    if (!enabled || !context) return;
    loadedRef.current = false;
    void loadFromBackend();
  }, [enabled, context, loadFromBackend]);

  // Real-time collaboration: when the platform backend is enabled, subscribe to
  // org-scoped layout changes and re-pull + notify on any member's change so all
  // devices/users see the same layouts live.
  useEffect(() => {
    if (!enabled || !context) return;
    return subscribeToLayoutChanges(context, () => onLoaded?.());
  }, [enabled, context, onLoaded]);

  // Stable object identity so consumers can depend on it without re-rendering.
  return useMemo(
    () => ({ enabled, loadFromBackend, saveToBackend }),
    [enabled, loadFromBackend, saveToBackend],
  );
}
