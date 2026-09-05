import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';
import { getPlatformProvider } from '../platform';
import { pullEntities, type EntitySyncContext } from './entitySync';

/**
 * Organization-wide realtime invalidation for the JSON business-data mirror.
 * The payload is deliberately re-pulled instead of trusting a partial row event,
 * so every local domain is hydrated consistently after a remote change.
 */
export function subscribeToEntityChanges(
  context: EntitySyncContext,
  onChanged?: () => void,
): () => void {
  if (getPlatformProvider() !== 'supabase' || !isSupabaseConfigured()) {
    return () => undefined;
  }

  const supabase = getSupabaseClient();
  let active = true;
  let refreshGeneration = 0;
  const refresh = () => {
    const generation = refreshGeneration + 1;
    refreshGeneration = generation;
    const shouldApply = () => active && refreshGeneration === generation;
    void pullEntities(context, shouldApply)
      .then((applied) => {
        if (applied !== false && shouldApply()) onChanged?.();
      })
      .catch((error) => {
        if (shouldApply()) console.error('Failed to refresh entity data:', error);
      });
  };
  const channel = supabase
    .channel(`spm-org-data-${context.organizationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'org_data',
        filter: `organization_id=eq.${context.organizationId}`,
      },
      refresh,
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'couple_portal_snapshots',
        filter: `organization_id=eq.${context.organizationId}`,
      },
      refresh,
    )
    .subscribe();

  return () => {
    active = false;
    refreshGeneration += 1;
    void supabase.removeChannel(channel);
  };
}
