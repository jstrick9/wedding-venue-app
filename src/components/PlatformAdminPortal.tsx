import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBrandingConfig } from '../config';
import {
  createVenueOrganization,
  getPlatformConsoleMetrics,
  listPlatformOrganizations,
  reactivateVenueOrganization,
  reissueVenueAdminInvite,
  revokeVenueAdminInvite,
  suspendVenueOrganization,
  type CreateVenueOrganizationResult,
} from '../services/platform/platformAdminService';
import type { PlatformConsoleMetrics, PlatformOrganizationSummary } from '../services/platform/platformTypes';
import { showToast } from './Toast';

interface PlatformAdminPortalProps {
  onOpenVenueWorkspace: () => void;
}

const EMPTY_METRICS: PlatformConsoleMetrics = {
  totalVenues: 0,
  activeVenues: 0,
  suspendedVenues: 0,
  provisioningVenues: 0,
  pendingInvites: 0,
  activeAdmins: 0,
  totalCouples: 0,
  totalGuests: 0,
  totalRsvps: 0,
  venues: [],
};

export default function PlatformAdminPortal({ onOpenVenueWorkspace }: PlatformAdminPortalProps) {
  const { user, organizationId, logout } = useAuth();
  const config = useBrandingConfig();
  const [organizations, setOrganizations] = useState<PlatformOrganizationSummary[]>([]);
  const [metrics, setMetrics] = useState<PlatformConsoleMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [result, setResult] = useState<CreateVenueOrganizationResult | null>(null);
  const [form, setForm] = useState({ name: '', adminEmail: '' });

  const loadConsole = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextOrganizations, nextMetrics] = await Promise.all([
        listPlatformOrganizations(),
        getPlatformConsoleMetrics(),
      ]);
      setOrganizations(nextOrganizations);
      setMetrics(nextMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load platform console data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadConsole(); }, [loadConsole]);

  const handleCreateVenue = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.adminEmail.trim()) {
      setError('Enter a venue name and the initial venue administrator email.');
      return;
    }
    setSaving(true);
    setError('');
    setResult(null);
    try {
      const created = await createVenueOrganization(form);
      setResult(created);
      setForm({ name: '', adminEmail: '' });
      await loadConsole();
      showToast(`Created ${created.organizationName}; its slug is ${created.organizationSlug}.`, 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the venue organization.');
    } finally {
      setSaving(false);
    }
  };

  const buildVenueLoginUrl = (slug: string) => `${window.location.origin}${window.location.pathname}#/venue-login/${encodeURIComponent(slug)}`;

  const copyVenueLogin = (slug: string) => {
    void navigator.clipboard?.writeText(buildVenueLoginUrl(slug)).then(
      () => showToast('Venue staff login link copied.', 'success'),
      () => showToast('Copy failed. Open the venue URL from the browser address bar.', 'warning'),
    );
  };

  const copyInvite = () => {
    if (!result?.inviteUrl) return;
    void navigator.clipboard?.writeText(result.inviteUrl).then(
      () => showToast('Venue administrator setup link copied.', 'success'),
      () => showToast('Copy failed. Select and copy the link below.', 'warning'),
    );
  };

  const handleReissue = async (organization: PlatformOrganizationSummary) => {
    const email = organization.pendingInvite?.email || window.prompt('Email for the new managed-admin invitation:', '') || '';
    if (!email.trim()) return;
    setActionId(organization.id);
    try {
      const next = await reissueVenueAdminInvite(organization.id, email);
      void navigator.clipboard?.writeText(next.inviteUrl);
      showToast('Old pending invite revoked; new setup link copied.', 'success');
      await loadConsole();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not reissue the invite.', 'warning');
    } finally {
      setActionId(null);
    }
  };

  const handleRevoke = async (organization: PlatformOrganizationSummary) => {
    const invite = organization.pendingInvite;
    if (!invite || !window.confirm(`Revoke the pending administrator invite for ${organization.name}?`)) return;
    setActionId(organization.id);
    try {
      await revokeVenueAdminInvite(invite.id, 'Revoked by platform administrator');
      showToast('Pending venue-admin invite revoked.', 'success');
      await loadConsole();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not revoke the invite.', 'warning');
    } finally {
      setActionId(null);
    }
  };

  const handleSuspend = async (organization: PlatformOrganizationSummary) => {
    if (!window.confirm(`Suspend ${organization.name}? Venue staff, couples, and guests will lose access, but data will be retained.`)) return;
    setActionId(organization.id);
    try {
      await suspendVenueOrganization(organization.id, 'Suspended by platform administrator');
      showToast(`${organization.name} suspended; tenant data was retained.`, 'success');
      await loadConsole();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not suspend the venue.', 'warning');
    } finally {
      setActionId(null);
    }
  };

  const handleReactivate = async (organization: PlatformOrganizationSummary) => {
    setActionId(organization.id);
    try {
      await reactivateVenueOrganization(organization.id);
      showToast(`${organization.name} reactivated.`, 'success');
      await loadConsole();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not reactivate the venue.', 'warning');
    } finally {
      setActionId(null);
    }
  };

  const statusStyles: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800',
    provisioning: 'bg-amber-100 text-amber-800',
    suspended: 'bg-red-100 text-red-800',
    archived: 'bg-gray-200 text-gray-700',
  };

  const metricCards = [
    ['Venues', metrics.totalVenues, 'border-indigo-200 bg-indigo-50 text-indigo-800'],
    ['Active', metrics.activeVenues, 'border-emerald-200 bg-emerald-50 text-emerald-800'],
    ['Awaiting admin', metrics.provisioningVenues, 'border-amber-200 bg-amber-50 text-amber-800'],
    ['Suspended', metrics.suspendedVenues, 'border-red-200 bg-red-50 text-red-800'],
    ['Managed admins', metrics.activeAdmins, 'border-blue-200 bg-blue-50 text-blue-800'],
    ['Couples', metrics.totalCouples, 'border-purple-200 bg-purple-50 text-purple-800'],
    ['Guests', metrics.totalGuests, 'border-sky-200 bg-sky-50 text-sky-800'],
    ['RSVPs', metrics.totalRsvps, 'border-teal-200 bg-teal-50 text-teal-800'],
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: config.fontFamily || 'Inter, system-ui, sans-serif' }}>
      <header className="border-b border-gray-200 bg-white px-4 py-4 shadow-sm sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Platform administration</p>
            <h1 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">Venue Intelligence Platform Console</h1>
            <p className="mt-1 text-xs text-gray-500">Signed in as {user?.email || user?.name || 'platform administrator'}</p>
          </div>
          <button type="button" onClick={logout} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">Sign out</button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm text-indigo-950">
          <p className="font-bold">Platform owner workspace</p>
          <p className="mt-1 text-xs leading-relaxed text-indigo-900/80">Manage tenant lifecycle and administrator onboarding here. Tenant business data remains organization-scoped; routine platform access is metadata-first.</p>
        </div>

        <section aria-label="Platform executive metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {metricCards.map(([label, value, styles]) => (
            <div key={label} className={`rounded-xl border p-3 text-center ${styles}`}>
              <p className="text-2xl font-extrabold">{value}</p>
              <p className="mt-1 text-[11px] font-semibold">{label}</p>
            </div>
          ))}
        </section>

        {organizationId && (
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center">
            <div><p className="text-sm font-semibold text-emerald-900">You also manage a venue workspace</p><p className="mt-0.5 text-xs text-emerald-800">Open your venue administration workspace without leaving the platform account.</p></div>
            <button type="button" onClick={onOpenVenueWorkspace} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800">Open Venue Workspace →</button>
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4"><p className="text-xs font-bold uppercase tracking-wider text-gray-500">Tenant onboarding</p><h2 className="mt-1 text-lg font-bold text-gray-900">Create a venue organization</h2><p className="mt-1 text-xs leading-relaxed text-gray-500">The venue slug is generated from the name and permanently frozen. The venue administrator creates their own password through the one-time setup link.</p></div>
            <form onSubmit={(event) => void handleCreateVenue(event)} className="space-y-3">
              <div><label htmlFor="platform-venue-name" className="mb-1 block text-xs font-semibold text-gray-700">Venue name</label><input id="platform-venue-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Seven Paths Manor" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              <div><label htmlFor="platform-admin-email" className="mb-1 block text-xs font-semibold text-gray-700">Initial venue administrator email</label><input id="platform-admin-email" type="email" value={form.adminEmail} onChange={(event) => setForm((current) => ({ ...current, adminEmail: event.target.value }))} placeholder="manager@venue.com" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              <button type="submit" disabled={saving} className="w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ backgroundColor: config.primaryColor || '#4A1942' }}>{saving ? 'Creating venue…' : 'Create Venue & Generate Admin Link'}</button>
            </form>
            {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            {result && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-bold text-emerald-900">Venue created: {result.organizationSlug}</p><p className="mt-1 text-xs text-emerald-800">Send this one-time setup link to {result.organizationName}&apos;s venue administrator.</p><button type="button" onClick={copyInvite} className="mt-3 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800">Copy setup link</button><p className="mt-2 break-all rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-[11px] text-gray-700">{result.inviteUrl}</p><p className="mt-2 text-[11px] text-emerald-800">Expires {new Date(result.expiresAt).toLocaleString()}.</p></div>}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-gray-500">Tenant directory</p><h2 className="mt-1 text-lg font-bold text-gray-900">Venue organizations</h2></div><button type="button" onClick={() => void loadConsole()} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">Refresh</button></div>
            {loading ? <p className="py-8 text-center text-sm text-gray-500">Loading venue organizations…</p> : organizations.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">No venue organizations have been created yet.</div> : <div className="space-y-3">{organizations.map((organization) => {
              const venueMetric = metrics.venues.find((metric) => metric.id === organization.id);
              const busy = actionId === organization.id;
              return <div key={organization.id} className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><h3 className="text-sm font-bold text-gray-900">{organization.name}</h3><p className="mt-0.5 font-mono text-[11px] text-gray-500">{organization.slug}</p><p className="mt-1 break-all text-[11px] text-indigo-700">{buildVenueLoginUrl(organization.slug)}</p></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyles[organization.status] || statusStyles.active}`}>{organization.status}</span><button type="button" onClick={() => copyVenueLogin(organization.slug)} className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50">Copy staff login</button></div></div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-5"><span>Admins: {venueMetric?.adminCount ?? organization.admins.length}</span><span>Couples: {venueMetric?.coupleCount ?? 0}</span><span>Guests: {venueMetric?.guestCount ?? 0}</span><span>RSVPs: {venueMetric?.rsvpCount ?? 0}</span><span>Created: {new Date(organization.createdAt).toLocaleDateString()}</span></div>
                {organization.suspensionReason && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Suspension reason: {organization.suspensionReason}</p>}
                {organization.admins.length > 0 && <div className="mt-3 space-y-1 border-t border-gray-200 pt-3">{organization.admins.map((admin) => <div key={admin.userId} className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-gray-700">{admin.fullName} <span className="text-gray-400">({admin.email})</span></span><span className="shrink-0 font-semibold text-gray-500">{admin.role} · {admin.status}</span></div>)}</div>}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3">
                  {organization.pendingInvite && <><span className="text-xs text-gray-600">Pending admin: {organization.pendingInvite.email}</span><button type="button" disabled={busy} onClick={() => void handleReissue(organization)} className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">Reissue invite</button><button type="button" disabled={busy} onClick={() => void handleRevoke(organization)} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60">Revoke invite</button></>}
                  {!organization.ownerId && !organization.pendingInvite && <button type="button" disabled={busy} onClick={() => void handleReissue(organization)} className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">Send admin invite</button>}
                  {organization.status === 'suspended' ? <button type="button" disabled={busy} onClick={() => void handleReactivate(organization)} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">Reactivate venue</button> : organization.status !== 'archived' && <button type="button" disabled={busy} onClick={() => void handleSuspend(organization)} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60">Suspend venue access</button>}
                </div>
              </div>;
            })}</div>}
          </div>
        </section>
      </main>
    </div>
  );
}
