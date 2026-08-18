import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBrandingConfig } from '../config';
import {
  createVenueOrganization,
  listPlatformOrganizations,
  type CreateVenueOrganizationResult,
} from '../services/platform/platformAdminService';
import type { PlatformOrganizationSummary } from '../services/platform/platformTypes';
import { showToast } from './Toast';

interface PlatformAdminPortalProps {
  onOpenVenueWorkspace: () => void;
}

export default function PlatformAdminPortal({ onOpenVenueWorkspace }: PlatformAdminPortalProps) {
  const { user, organizationId, logout } = useAuth();
  const config = useBrandingConfig();
  const [organizations, setOrganizations] = useState<PlatformOrganizationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CreateVenueOrganizationResult | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', adminEmail: '' });

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOrganizations(await listPlatformOrganizations());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load venue organizations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

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
      setForm({ name: '', slug: '', adminEmail: '' });
      await loadOrganizations();
      showToast('Venue organization created.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the venue organization.');
    } finally {
      setSaving(false);
    }
  };

  const copyInvite = () => {
    if (!result?.inviteUrl) return;
    void navigator.clipboard?.writeText(result.inviteUrl).then(
      () => showToast('Venue administrator setup link copied.', 'success'),
      () => showToast('Copy failed. Select and copy the link below.', 'warning'),
    );
  };

  return (
    <div
      className="min-h-screen bg-slate-50"
      style={{ fontFamily: config.fontFamily || 'Inter, system-ui, sans-serif' }}
    >
      <header className="border-b border-gray-200 bg-white px-4 py-4 shadow-sm sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Platform administration</p>
            <h1 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">Venue Intelligence Platform Console</h1>
            <p className="mt-1 text-xs text-gray-500">
              Signed in as {user?.email || user?.name || 'platform administrator'}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm text-indigo-950">
          <p className="font-bold">Platform owner workspace</p>
          <p className="mt-1 text-xs leading-relaxed text-indigo-900/80">
            Create and monitor venue tenants here. Venue business data remains organization-scoped;
            this console manages tenant metadata and administrator onboarding rather than bypassing tenant security.
          </p>
        </div>

        {organizationId && (
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-emerald-900">You also manage a venue workspace</p>
              <p className="mt-0.5 text-xs text-emerald-800">Open your venue administration workspace without leaving the platform account.</p>
            </div>
            <button
              type="button"
              onClick={onOpenVenueWorkspace}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800"
            >
              Open Venue Workspace →
            </button>
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Tenant onboarding</p>
              <h2 className="mt-1 text-lg font-bold text-gray-900">Create a venue organization</h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                The venue administrator receives a one-time setup link and creates their own Supabase password.
                Platform staff never need to know that password.
              </p>
            </div>

            <form onSubmit={(event) => void handleCreateVenue(event)} className="space-y-3">
              <div>
                <label htmlFor="platform-venue-name" className="mb-1 block text-xs font-semibold text-gray-700">Venue name</label>
                <input
                  id="platform-venue-name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Seven Paths Manor"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="platform-venue-slug" className="mb-1 block text-xs font-semibold text-gray-700">Venue slug (optional)</label>
                <input
                  id="platform-venue-slug"
                  value={form.slug}
                  onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                  placeholder="seven-paths-manor"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="platform-admin-email" className="mb-1 block text-xs font-semibold text-gray-700">Initial venue administrator email</label>
                <input
                  id="platform-admin-email"
                  type="email"
                  value={form.adminEmail}
                  onChange={(event) => setForm((current) => ({ ...current, adminEmail: event.target.value }))}
                  placeholder="manager@venue.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                style={{ backgroundColor: config.primaryColor || '#4A1942' }}
              >
                {saving ? 'Creating venue…' : 'Create Venue & Generate Admin Link'}
              </button>
            </form>

            {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

            {result && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-bold text-emerald-900">Venue created</p>
                <p className="mt-1 text-xs text-emerald-800">Send this one-time setup link to {result.organizationName}&apos;s venue administrator.</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={copyInvite}
                    className="shrink-0 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800"
                  >
                    Copy setup link
                  </button>
                </div>
                <p className="mt-2 break-all rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-[11px] text-gray-700">{result.inviteUrl}</p>
                <p className="mt-2 text-[11px] text-emerald-800">This link expires {new Date(result.expiresAt).toLocaleString()} and is not shown again after leaving this page.</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Tenant directory</p>
                <h2 className="mt-1 text-lg font-bold text-gray-900">Venue organizations</h2>
              </div>
              <button type="button" onClick={() => void loadOrganizations()} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">Refresh</button>
            </div>

            {loading ? (
              <p className="py-8 text-center text-sm text-gray-500">Loading venue organizations…</p>
            ) : organizations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">No venue organizations have been created yet.</div>
            ) : (
              <div className="space-y-3">
                {organizations.map((organization) => (
                  <div key={organization.id} className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">{organization.name}</h3>
                        <p className="mt-0.5 font-mono text-[11px] text-gray-500">{organization.slug}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${organization.ownerId ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {organization.ownerId ? 'Admin claimed' : 'Awaiting admin'}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
                      <span>Created: {new Date(organization.createdAt).toLocaleDateString()}</span>
                      <span>Managed admins: {organization.admins.length}</span>
                    </div>
                    {organization.admins.length > 0 && (
                      <div className="mt-3 space-y-1 border-t border-gray-200 pt-3">
                        {organization.admins.map((admin) => (
                          <div key={admin.userId} className="flex items-center justify-between gap-3 text-xs">
                            <span className="truncate text-gray-700">{admin.fullName} <span className="text-gray-400">({admin.email})</span></span>
                            <span className="shrink-0 font-semibold text-gray-500">{admin.role} · {admin.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
