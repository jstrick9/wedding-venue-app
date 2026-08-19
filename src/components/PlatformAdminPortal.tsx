import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
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
import { getPlatformBranding, savePlatformBranding } from '../services/platform/platformBrandingService';
import { uploadPublicBrandingAsset } from '../services/platform/brandingAssetService';
import { geocodeVenueAddress } from '../services/platform/geocodingService';
import { defaultPlatformConfig } from './PlatformLoginScreen';
import PlatformVenueChatPanel from './PlatformVenueChatPanel';
import PlatformVenueMap from './PlatformVenueMap';
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
  const [form, setForm] = useState({ name: '', adminEmail: '', addressLine1: '', addressLine2: '', city: '', stateRegion: '', postalCode: '', country: 'US', primaryContactName: '', primaryContactPhone: '', primaryContactEmail: '' });
  const [geocoding, setGeocoding] = useState(false);
  const [platformBranding, setPlatformBranding] = useState(defaultPlatformConfig);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [chatOrganizationId, setChatOrganizationId] = useState<string | null>(null);

  const loadConsole = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextOrganizations, nextMetrics, nextBranding] = await Promise.all([
        listPlatformOrganizations(),
        getPlatformConsoleMetrics(),
        getPlatformBranding(),
      ]);
      setOrganizations(nextOrganizations);
      setMetrics(nextMetrics);
      setPlatformBranding({ ...defaultPlatformConfig, ...nextBranding });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load platform console data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadConsole(); }, [loadConsole]);

  const handleSavePlatformBranding = async (next: typeof platformBranding) => {
    setBrandingSaving(true);
    try {
      await savePlatformBranding(next);
      setPlatformBranding(next);
      showToast('Platform branding saved.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save platform branding.', 'warning');
    } finally {
      setBrandingSaving(false);
    }
  };

  const handlePlatformLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const logoUrl = await uploadPublicBrandingAsset(file, 'platform');
      await handleSavePlatformBranding({ ...platformBranding, logoUrl });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not upload platform logo.', 'warning');
    }
  };

  const handleCreateVenue = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.adminEmail.trim() || !form.addressLine1.trim() || !form.city.trim() || !form.stateRegion.trim() || !form.postalCode.trim() || !form.primaryContactName.trim() || !form.primaryContactPhone.trim() || !form.primaryContactEmail.trim()) {
      setError('Venue name, complete address, and primary contact name, phone, and email are required.');
      return;
    }
    setSaving(true);
    setError('');
    setResult(null);
    try {
      setGeocoding(true);
      const coordinates = await geocodeVenueAddress(form);
      setGeocoding(false);
      const created = await createVenueOrganization({ ...form, latitude: coordinates.latitude, longitude: coordinates.longitude });
      setResult(created);
      setForm({ name: '', adminEmail: '', addressLine1: '', addressLine2: '', city: '', stateRegion: '', postalCode: '', country: 'US', primaryContactName: '', primaryContactPhone: '', primaryContactEmail: '' });
      await loadConsole();
      showToast(`Created ${created.organizationName}; its slug is ${created.organizationSlug}.`, 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the venue organization.');
    } finally {
      setGeocoding(false);
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

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4"><p className="text-xs font-bold uppercase tracking-wider text-gray-500">Platform identity</p><h2 className="mt-1 text-lg font-bold text-gray-900">Platform login and console branding</h2><p className="mt-1 text-xs text-gray-500">This branding is global and does not inherit from any venue tenant.</p></div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-gray-700">Platform name<input value={platformBranding.venueName} onChange={(e) => setPlatformBranding({ ...platformBranding, venueName: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
              <label className="block text-xs font-semibold text-gray-700">Tagline<input value={platformBranding.tagline} onChange={(e) => setPlatformBranding({ ...platformBranding, tagline: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
              <label className="block text-xs font-semibold text-gray-700">Login welcome message<textarea value={platformBranding.loginWelcomeMessage || ''} onChange={(e) => setPlatformBranding({ ...platformBranding, loginWelcomeMessage: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={2} /></label>
              <div className="flex items-center gap-3"><input id="platform-logo-upload" type="file" accept="image/*" className="sr-only" onChange={(e) => void handlePlatformLogoUpload(e)} /><label htmlFor="platform-logo-upload" className="cursor-pointer rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-800">Upload platform logo</label>{platformBranding.logoUrl && <img src={platformBranding.logoUrl} alt="Platform logo" className="h-10 w-10 rounded-lg border object-contain" />}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-gray-700">Background mode<select value={platformBranding.loginBackgroundType || 'gradient'} onChange={(e) => setPlatformBranding({ ...platformBranding, loginBackgroundType: e.target.value as typeof platformBranding.loginBackgroundType })} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"><option value="solid">Solid</option><option value="gradient">Gradient</option><option value="pattern">Pattern</option><option value="animated">Animated</option></select></label>
              <label className="text-xs font-semibold text-gray-700">Animation<select value={platformBranding.loginBackgroundAnimation || 'none'} onChange={(e) => setPlatformBranding({ ...platformBranding, loginBackgroundAnimation: e.target.value as typeof platformBranding.loginBackgroundAnimation })} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"><option value="none">None</option><option value="drift">Drift</option><option value="shimmer">Shimmer</option><option value="float">Float</option></select></label>
              <label className="text-xs font-semibold text-gray-700">Primary color<input type="color" value={platformBranding.loginBackgroundColor || platformBranding.primaryColor} onChange={(e) => setPlatformBranding({ ...platformBranding, loginBackgroundColor: e.target.value, primaryColor: e.target.value })} className="mt-1 h-10 w-full rounded-lg border" /></label>
              <label className="text-xs font-semibold text-gray-700">Secondary color<input type="color" value={platformBranding.loginBackgroundSecondaryColor || platformBranding.primaryLight} onChange={(e) => setPlatformBranding({ ...platformBranding, loginBackgroundSecondaryColor: e.target.value, primaryLight: e.target.value })} className="mt-1 h-10 w-full rounded-lg border" /></label>
              <label className="col-span-2 text-xs font-semibold text-gray-700">Pattern<select value={platformBranding.loginBackgroundPattern || 'dots'} onChange={(e) => setPlatformBranding({ ...platformBranding, loginBackgroundPattern: e.target.value as typeof platformBranding.loginBackgroundPattern })} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"><option value="dots">Dots</option><option value="grid">Grid</option><option value="diagonal">Diagonal</option><option value="confetti">Confetti</option></select></label>
              <button type="button" disabled={brandingSaving} onClick={() => void handleSavePlatformBranding(platformBranding)} className="col-span-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{brandingSaving ? 'Saving…' : 'Save Platform Branding'}</button>
            </div>
          </div>
        </section>

        <section aria-label="Platform executive metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {metricCards.map(([label, value, styles]) => (
            <div key={label} className={`rounded-xl border p-3 text-center ${styles}`}>
              <p className="text-2xl font-extrabold">{value}</p>
              <p className="mt-1 text-[11px] font-semibold">{label}</p>
            </div>
          ))}
        </section>

        <PlatformVenueMap organizations={organizations} />

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
              <div><label htmlFor="platform-venue-name" className="mb-1 block text-xs font-semibold text-gray-700">Venue name *</label><input id="platform-venue-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Seven Paths Manor" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              <div><label htmlFor="platform-address-line1" className="mb-1 block text-xs font-semibold text-gray-700">Address *</label><input id="platform-address-line1" value={form.addressLine1} onChange={(event) => setForm((current) => ({ ...current, addressLine1: event.target.value }))} placeholder="123 Venue Road" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              <div><label htmlFor="platform-address-line2" className="mb-1 block text-xs font-semibold text-gray-700">Address line 2</label><input id="platform-address-line2" value={form.addressLine2} onChange={(event) => setForm((current) => ({ ...current, addressLine2: event.target.value }))} placeholder="Suite or building (optional)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-gray-700">City *<input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label><label className="text-xs font-semibold text-gray-700">State/region *<input value={form.stateRegion} onChange={(event) => setForm((current) => ({ ...current, stateRegion: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label></div>
              <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-gray-700">Postal code *<input value={form.postalCode} onChange={(event) => setForm((current) => ({ ...current, postalCode: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label><label className="text-xs font-semibold text-gray-700">Country<select value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="US">United States</option><option value="CA">Canada</option><option value="GB">United Kingdom</option></select></label></div>
              <div className="border-t border-gray-200 pt-3"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Primary venue contact</p><div className="space-y-2"><label className="block text-xs font-semibold text-gray-700">Contact name *<input value={form.primaryContactName} onChange={(event) => setForm((current) => ({ ...current, primaryContactName: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label><label className="block text-xs font-semibold text-gray-700">Contact phone *<input type="tel" value={form.primaryContactPhone} onChange={(event) => setForm((current) => ({ ...current, primaryContactPhone: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label><label className="block text-xs font-semibold text-gray-700">Contact email *<input type="email" value={form.primaryContactEmail} onChange={(event) => setForm((current) => ({ ...current, primaryContactEmail: event.target.value, adminEmail: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label></div></div>
              <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] text-indigo-800">The address is geocoded through the server-side Nominatim function and cached before the venue is created. {geocoding ? 'Locating venue…' : ''}</p>
              <button type="submit" disabled={saving || geocoding} className="w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ backgroundColor: config.primaryColor || '#4A1942' }}>{geocoding ? 'Locating venue…' : saving ? 'Creating venue…' : 'Create Venue & Generate Admin Link'}</button>
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
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><h3 className="text-sm font-bold text-gray-900">{organization.name}</h3><p className="mt-0.5 font-mono text-[11px] text-gray-500">{organization.slug}</p><p className="mt-1 break-all text-[11px] text-indigo-700">{buildVenueLoginUrl(organization.slug)}</p></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyles[organization.status] || statusStyles.active}`}>{organization.status}</span><button type="button" onClick={() => copyVenueLogin(organization.slug)} className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50">Copy staff login</button><button type="button" onClick={() => setChatOrganizationId(chatOrganizationId === organization.id ? null : organization.id)} className="rounded-lg border border-indigo-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50">Chat</button></div></div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-5"><span>Admins: {venueMetric?.adminCount ?? organization.admins.length}</span><span>Couples: {venueMetric?.coupleCount ?? 0}</span><span>Guests: {venueMetric?.guestCount ?? 0}</span><span>RSVPs: {venueMetric?.rsvpCount ?? 0}</span><span>Created: {new Date(organization.createdAt).toLocaleDateString()}</span></div>
                {organization.suspensionReason && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Suspension reason: {organization.suspensionReason}</p>}
                {organization.admins.length > 0 && <div className="mt-3 space-y-1 border-t border-gray-200 pt-3">{organization.admins.map((admin) => <div key={admin.userId} className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-gray-700">{admin.fullName} <span className="text-gray-400">({admin.email})</span></span><span className="shrink-0 font-semibold text-gray-500">{admin.role} · {admin.status}</span></div>)}</div>}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3">
                  {organization.pendingInvite && <><span className="text-xs text-gray-600">Pending admin: {organization.pendingInvite.email}</span><button type="button" disabled={busy} onClick={() => void handleReissue(organization)} className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">Reissue invite</button><button type="button" disabled={busy} onClick={() => void handleRevoke(organization)} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60">Revoke invite</button></>}
                  {!organization.ownerId && !organization.pendingInvite && <button type="button" disabled={busy} onClick={() => void handleReissue(organization)} className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">Send admin invite</button>}
                  {organization.status === 'suspended' ? <button type="button" disabled={busy} onClick={() => void handleReactivate(organization)} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">Reactivate venue</button> : organization.status !== 'archived' && <button type="button" disabled={busy} onClick={() => void handleSuspend(organization)} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60">Suspend venue access</button>}
                </div>
                {chatOrganizationId === organization.id && <div className="mt-4"><PlatformVenueChatPanel organizationId={organization.id} organizationName={organization.name} senderSide="platform" /></div>}
              </div>;
            })}</div>}
          </div>
        </section>
      </main>
    </div>
  );
}
