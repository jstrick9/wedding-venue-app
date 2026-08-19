import { getPlatformProvider, type PlatformProvider } from '../platform';
import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';
import { BACKUP_DOMAINS } from '../../utils/backupDomains';
import { emitDataChanged, type DataChangedType } from '../../utils/appEvents';

/**
 * Generic org-scoped entity repository.
 *
 * Reads/writes every catalog/design/asset domain (venues, table specs, decor,
 * linens, chairs, wall styles, spacing, alignment, feature templates, templates,
 * guidelines, event questions/answers, staff, vendors/payments, portal data,
 * direct messages, saved layouts) in one uniform way:
 *  - `local`    → the existing localStorage domain store (via the backup-domain
 *    registry, which is the single source of truth for keys/read/write).
 *  - `supabase` → the `org_data` table (RLS-scoped by organization), keyed by
 *    domain. One round-trip reads/writes the whole domain's JSON payload.
 *
 * This generalizes the layout-repository pattern (Feature B) to all entities.
 */

export interface EntitySyncContext {
  organizationId: string;
  userId: string;
}

export type EntityDomain = string;

/**
 * Domains that remain intentionally local while local authentication and
 * browser-only session state are active. All business data can otherwise be
 * mirrored into the single-venue organization store for cross-device use.
 */
const LOCAL_ONLY_DOMAINS = new Set([
  'users',
  'securitySettings',
  'orgInvites',
  'coupleChatRead',
  'savedLayouts', // Saved layouts use the dedicated layouts repository.
]);

export function isSyncableDomain(domain: EntityDomain): boolean {
  const definition = BACKUP_DOMAINS.find(
    (entry) => entry.key === domain || entry.storageKey === domain,
  );
  return Boolean(definition && !LOCAL_ONLY_DOMAINS.has(definition.key));
}

export interface EntityRepository {
  provider: PlatformProvider;
  /** Persist all syncable domains for a context (replace-sync). */
  pushAll(context: EntitySyncContext): Promise<void>;
  /** Load all syncable domains for a context from the backend into local store. */
  pullAll(context: EntitySyncContext): Promise<void>;
  /** Persist a single domain for a context. */
  pushDomain(context: EntitySyncContext, domain: EntityDomain): Promise<void>;
}

export class LocalEntityRepository implements EntityRepository {
  provider: PlatformProvider = 'local';

  async pushAll(): Promise<void> { /* no-op: localStorage already owns the data */ }
  async pullAll(): Promise<void> { /* no-op */ }
  async pushDomain(): Promise<void> { /* no-op */ }
}

export class SupabaseEntityRepository implements EntityRepository {
  provider: PlatformProvider = 'supabase';

  private domains(): { key: string; read: () => unknown; write: (v: unknown) => void }[] {
    return BACKUP_DOMAINS.filter((d) => isSyncableDomain(d.key));
  }

  private async upsertDomain(
    context: EntitySyncContext,
    domain: string,
    payload: unknown,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('org_data').upsert(
      {
        organization_id: context.organizationId,
        domain,
        payload,
      },
      { onConflict: 'organization_id,domain' },
    );
    if (error) throw error;
  }

  async pushDomain(context: EntitySyncContext, domain: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
    const def = BACKUP_DOMAINS.find(
      (d) => d.key === domain || d.storageKey === domain,
    );
    if (!def) return;
    await this.upsertDomain(context, domain, def.read());
  }

  async pushAll(context: EntitySyncContext): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
    for (const def of this.domains()) {
      await this.upsertDomain(context, def.key, def.read());
    }
  }

  async pullAll(context: EntitySyncContext): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('org_data')
      .select('domain,payload')
      .eq('organization_id', context.organizationId);
    if (error) throw error;

    // Write every row and emit a typed event per domain so active React state
    // hydrates from the freshly-pulled values without a page reload (P1-2).
    const emitted = new Set<string>();
    for (const row of data || []) {
      const def = BACKUP_DOMAINS.find((d) => d.key === row.domain);
      if (!def) continue;
      def.write(row.payload);
      if (!emitted.has(def.key)) {
        emitted.add(def.key);
        emitDataChanged(def.key as DataChangedType);
      }
    }
    // An empty (or missing) remote result must replace local state, so emit a
    // full refresh signal even when nothing was pulled (P1-5).
    emitDataChanged('all');
  }
}

export function getEntityRepository(): EntityRepository {
  return getPlatformProvider() === 'supabase'
    ? new SupabaseEntityRepository()
    : new LocalEntityRepository();
}
