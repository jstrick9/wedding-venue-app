import { useCallback, useEffect, useRef } from 'react';
import { canSyncLayouts, pullLayouts, pushLayouts } from '../services/sync/layoutSync';

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

  const context = userId && organizationId
    ? { userId, organizationId }
    : null;

  const loadFromBackend = useCallback(async () => {
    if (!enabled || !context) return;
    try {
      await pullLayouts(context);
      onLoaded?.();
    } catch (err) {
      console.error('Failed to load layouts from backend:', err);
    }
  }, [enabled, context, onLoaded]);

  const saveToBackend = useCallback(async () => {
    if (!enabled || !context) return;
    try {
      await pushLayouts(context);
    } catch (err) {
      console.error('Failed to push layouts to backend:', err);
    }
  }, [enabled, context]);

  useEffect(() => {
    if (!enabled || !context || loadedRef.current) return;
    loadedRef.current = true;
    void loadFromBackend();
  }, [enabled, context, loadFromBackend]);

  return { enabled, loadFromBackend, saveToBackend };
}
