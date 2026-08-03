import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';
import { getPlatformProvider } from '../platform';
import { pullLayouts, type LayoutSyncContext } from './layoutSync';

/**
 * Real-time layout collaboration via Supabase Realtime.
 *
 * Subscribes to Postgres changes on the `layouts` table scoped to the current
 * organization (RLS controls what the user may actually read). When any member
 * of the org adds/updates/deletes a layout, we re-pull the org's layouts so the
 * in-memory list stays in sync across users and devices.
 *
 * In local mode (or when Supabase is not configured) this is a no-op that
 * returns a no-op unsubscribe.
 */
export function subscribeToLayoutChanges(
  context: LayoutSyncContext,
  onChanged?: () => void,
): () => void {
  if (getPlatformProvider() !== 'supabase' || !isSupabaseConfigured()) {
    return () => undefined;
  }

  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`spm-layouts-${context.organizationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'layouts',
        filter: `organization_id=eq.${context.organizationId}`,
      },
      () => {
        void pullLayouts(context).then(() => onChanged?.());
      },
    )
    .subscribe();

  // Return an unsubscribe that tears the channel down cleanly.
  return () => {
    void supabase.removeChannel(channel);
  };
}
