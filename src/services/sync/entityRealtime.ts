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
      () => {
        void pullEntities(context).then(() => onChanged?.());
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'couple_portal_snapshots',
        filter: `organization_id=eq.${context.organizationId}`,
      },
      () => {
        void pullEntities(context).then(() => onChanged?.());
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
