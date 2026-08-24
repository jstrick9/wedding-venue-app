import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBrandingConfig } from '../config';
import {
  createVenueOrganization,
  getPlatformConsoleMetrics,
  listPlatformAuditLogs,
  listPlatformOrganizations,
  reactivateVenueOrganization,
  reissueVenueAdminInvite,
  revokeVenueAdminInvite,
  suspendVenueOrganization,
  updateVenueOrganization,
  type CreateVenueOrganizationResult,
} from '../services/platform/platformAdminService';
import { getPlatformBranding, savePlatformBranding } from '../services/platform/platformBrandingService';
import { uploadPublicBrandingAsset } from '../services/platform/brandingAssetService';
import { geocodeVenueAddress } from '../services/platform/geocodingService';
import AddressAutocomplete from './AddressAutocomplete';
import { firstFieldError, normalizeEmail, normalizeUsPhone, normalizeWebsite } from '../utils/contactQuality';

import { defaultPlatformConfig } from './PlatformLoginScreen';
import PlatformVenueChatPanel from './PlatformVenueChatPanel';
import PlatformVenueMap from './PlatformVenueMap';
import type {
  OrganizationStatus,
  PlatformAuditLogEntry,
  PlatformConsoleMetrics,
  PlatformOrganizationSummary,
} from '../services/platform/platformTypes';
import { showToast } from './Toast';
import { buildVenueAdminInviteCompose, deliverVenueAdminInvite } from '../services/platform/venueAdminInviteMail';
import type { InviteComposeMessage } from '../utils/inviteCompose';
import {
  VENUE_ADMIN_SETUP_BUTTON_LABEL,
  joinContactName,
  splitContactName,
} from '../utils/venueAdminInviteEmail';
import { DEFAULT_NEW_INVITE_TTL_DAYS, DEFAULT_REISSUE_INVITE_TTL_DAYS, formatInviteExpiry, inviteExpiresAt } from '../utils/inviteTtl';
import InviteEmailTemplateEditor from './platform/InviteEmailTemplateEditor';
import { buildPlatformConsoleHash, parsePlatformConsoleHash, type PlatformConsoleSection } from '../utils/platformConsoleRoute';
import { filterPlatformVenues, listVenueRegions } from '../utils/platformVenueFilters';
import { applyDocumentBranding } from '../utils/documentBranding';


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

const NAV: { id: PlatformConsoleSection; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'venues', label: 'Venues', icon: '🏛️' },
  { id: 'map', label: 'Map', icon: '🗺️' },
  { id: 'onboard', label: 'Onboard venue', icon: '➕' },
  { id: 'branding', label: 'Branding', icon: '🎨' },
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'audit', label: 'Audit', icon: '🛡️' },
];

const EMPTY_FORM = {
  name: '',
  adminEmail: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  stateRegion: '',
  postalCode: '',
  country: 'US',
  primaryContactFirstName: '',
  primaryContactLastName: '',
  primaryContactPhone: '',
  primaryContactEmail: '',
};

const statusStyles: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  provisioning: 'bg-amber-100 text-amber-800',
  suspended: 'bg-red-100 text-red-800',
  archived: 'bg-gray-200 text-gray-700',
};

function go(section: PlatformConsoleSection, venueId?: string) {
  window.location.hash = buildPlatformConsoleHash(section, venueId);
}

function buildVenueLoginUrl(slug: string) {
  return `${window.location.origin}${window.location.pathname}#/venue-login/${encodeURIComponent(slug)}`;
}

function streetAddressKey(value: {
  addressLine1?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  country?: string | null;
}) {
  return [value.addressLine1, value.city, value.stateRegion, value.postalCode, value.country || 'US']
    .map((part) => (part || '').trim().toLowerCase())
    .join('|');
}

function hasCompleteStreetAddress(value: {
  addressLine1?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
}) {
  return Boolean(value.addressLine1?.trim() && value.city?.trim() && value.stateRegion?.trim() && value.postalCode?.trim());
}

export default function PlatformAdminPortal({ onOpenVenueWorkspace }: PlatformAdminPortalProps) {
  const { user, organizationId, logout } = useAuth();
  const config = useBrandingConfig();
  const [hash, setHash] = useState(window.location.hash);
  const route = parsePlatformConsoleHash(hash);
  const [organizations, setOrganizations] = useState<PlatformOrganizationSummary[]>([]);
  const [metrics, setMetrics] = useState<PlatformConsoleMetrics>(EMPTY_METRICS);
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [result, setResult] = useState<CreateVenueOrganizationResult | null>(null);
  const [inviteCompose, setInviteCompose] = useState<InviteComposeMessage | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [onboardVerified, setOnboardVerified] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [platformBranding, setPlatformBranding] = useState(defaultPlatformConfig);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [chatOrganizationId, setChatOrganizationId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrganizationStatus | 'all'>('all');
  const [regionFilter, setRegionFilter] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const loadConsole = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextOrganizations, nextMetrics, nextBranding, nextAudit] = await Promise.all([
        listPlatformOrganizations(),
        getPlatformConsoleMetrics(),
        getPlatformBranding(),
        listPlatformAuditLogs(80).catch(() => [] as PlatformAuditLogEntry[]),
      ]);
      setOrganizations(nextOrganizations);
      setMetrics(nextMetrics);
      setPlatformBranding({ ...defaultPlatformConfig, ...nextBranding });
      setAuditLogs(nextAudit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load platform console data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadConsole(); }, [loadConsole]);

  const sendInviteEmail = async (composeInput: Parameters<typeof deliverVenueAdminInvite>[0], successMessage: string) => {
    setInviteCompose(buildVenueAdminInviteCompose(composeInput));
    try {
      await deliverVenueAdminInvite(composeInput);
      showToast(successMessage, 'success');
    } catch (mailErr) {
      const mailMessage = mailErr instanceof Error ? mailErr.message : 'Email delivery failed.';
      showToast(`${mailMessage} Copy the setup link below.`, 'warning');
    }
  };

  useEffect(() => {
    applyDocumentBranding({
      name: platformBranding.venueName,
      logoUrl: platformBranding.logoUrl,
      primaryColor: platformBranding.primaryColor,
    });
  }, [platformBranding.venueName, platformBranding.logoUrl, platformBranding.primaryColor]);

  useEffect(() => {
    if (route.section !== 'chat' || chatOrganizationId || organizations.length === 0) return;
    setChatOrganizationId(organizations[0].id);
  }, [route.section, chatOrganizationId, organizations]);

  const regions = useMemo(() => listVenueRegions(organizations), [organizations]);
  const filteredVenues = useMemo(
    () => filterPlatformVenues(organizations, { query, status: statusFilter, region: regionFilter }),
    [organizations, query, statusFilter, regionFilter],
  );
  const selectedVenue = organizations.find((organization) => organization.id === route.venueId) || null;
  const activeNav = route.section === 'venue-detail' ? 'venues' : route.section;

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
    if (!form.name.trim() || !form.adminEmail.trim() || !form.primaryContactFirstName.trim() || !form.primaryContactLastName.trim() || !form.primaryContactPhone.trim() || !form.primaryContactEmail.trim()) {
      setError('Venue name, complete address, and primary contact first name, last name, phone, and email are required.');
      return;
    }
    if (!onboardVerified || !hasCompleteStreetAddress(form)) {
      setError('Select a verified US street address from the suggestions so city, state, and ZIP cannot be mistyped.');
      return;
    }
    const phone = normalizeUsPhone(form.primaryContactPhone, { required: true });
    const email = normalizeEmail(form.primaryContactEmail, { required: true });
    const adminEmail = normalizeEmail(form.adminEmail, { required: true });
    const contactError = firstFieldError(phone, email, adminEmail);
    if (contactError) {
      setError(contactError);
      return;
    }
    setSaving(true);
    setError('');
    setResult(null);
    setInviteCompose(null);
    try {
      setGeocoding(true);
      const coordinates = await geocodeVenueAddress({ ...form, country: 'US' });
      setGeocoding(false);
      const created = await createVenueOrganization({
        ...form,
        country: 'US',
        primaryContactName: joinContactName(form.primaryContactFirstName, form.primaryContactLastName),
        primaryContactPhone: phone.value,
        primaryContactEmail: email.value,
        adminEmail: adminEmail.value,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        expiresAt: inviteExpiresAt(platformBranding.venueAdminInviteTtlDays, DEFAULT_NEW_INVITE_TTL_DAYS),
      });
      setResult(created);
      const composeInput = {
        to: adminEmail.value,
        organizationId: created.organizationId,
        organizationName: created.organizationName,
        inviteUrl: created.inviteUrl,
        expiresAt: created.expiresAt,
        platformName: platformBranding.venueName,
        subject: platformBranding.venueAdminInviteSubject,
        body: platformBranding.venueAdminInviteBody,
        contactFirstName: form.primaryContactFirstName,
        contactLastName: form.primaryContactLastName,
      };
      setForm(EMPTY_FORM);
      setOnboardVerified(false);
      await loadConsole();
      await sendInviteEmail(composeInput, `Created ${created.organizationName} and emailed the HTML invite to ${adminEmail.value}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the venue organization.');
    } finally {
      setGeocoding(false);
      setSaving(false);
    }
  };

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
    const normalized = normalizeEmail(email, { required: true });
    if (!normalized.ok) {
      showToast(normalized.error || 'Enter a valid email address.', 'warning');
      return;
    }
    setActionId(organization.id);
    try {
      const next = await reissueVenueAdminInvite(
        organization.id,
        normalized.value,
        inviteExpiresAt(platformBranding.venueAdminReissueTtlDays, DEFAULT_REISSUE_INVITE_TTL_DAYS),
      );
      void navigator.clipboard?.writeText(next.inviteUrl);
      const contact = splitContactName(organization.primaryContactName || '');
      await sendInviteEmail({
        to: normalized.value,
        organizationId: organization.id,
        organizationName: organization.name,
        inviteUrl: next.inviteUrl,
        expiresAt: next.expiresAt,
        platformName: platformBranding.venueName,
        subject: platformBranding.venueAdminInviteSubject,
        body: platformBranding.venueAdminInviteBody,
        contactFirstName: contact.firstName,
        contactLastName: contact.lastName,
      }, `New setup link created and emailed to ${normalized.value}. Expires ${formatInviteExpiry(next.expiresAt)}.`);
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

  const metricCards = [
    ['Venues', metrics.totalVenues],
    ['Active', metrics.activeVenues],
    ['Awaiting admin', metrics.provisioningVenues],
    ['Suspended', metrics.suspendedVenues],
    ['Managed admins', metrics.activeAdmins],
    ['Couples', metrics.totalCouples],
    ['Guests', metrics.totalGuests],
    ['RSVPs', metrics.totalRsvps],
  ] as const;

  const awaitingAdmin = organizations.filter((organization) => organization.status === 'provisioning' || !organization.ownerId);
  const suspended = organizations.filter((organization) => organization.status === 'suspended');

  return (
    <div className="flex min-h-screen bg-slate-50" style={{ fontFamily: config.fontFamily || 'Inter, system-ui, sans-serif' }}>
      <aside className={`flex min-h-screen shrink-0 flex-col border-r border-slate-200 bg-slate-900 text-white ${sidebarCollapsed ? 'w-[72px]' : 'w-60'}`}>
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-4">
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Platform</p>
              <h1 className="truncate text-sm font-bold">Console</h1>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            className="rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? '▶' : '◀'}
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-2" aria-label="Platform console">
          {NAV.map((item) => {
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                title={item.label}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                  active ? 'bg-indigo-600 font-semibold text-white' : 'text-slate-200 hover:bg-white/10'
                } ${sidebarCollapsed ? 'justify-center' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <span aria-hidden="true">{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-white/10 p-3">
          {!sidebarCollapsed && <p className="truncate text-[11px] text-slate-400">{user?.email || user?.name || 'Platform admin'}</p>}
          <button type="button" onClick={logout} className="mt-2 w-full rounded-lg border border-white/20 px-2 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10">
            {sidebarCollapsed ? '⎋' : 'Sign out'}
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-b border-gray-200 bg-white px-4 py-4 shadow-sm sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Platform administration</p>
          <h1 className="mt-1 text-xl font-bold text-gray-900">Venue Intelligence Platform Console</h1>
        </header>

        <main className="space-y-6 px-4 py-6 sm:px-6">
          {error && route.section !== 'onboard' && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          {route.section === 'overview' && (
            <div className="space-y-6">
              <section aria-label="Platform executive metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {metricCards.map(([label, value]) => (
                  <button key={label} type="button" onClick={() => go('venues')} className="rounded-xl border border-indigo-100 bg-white p-3 text-center shadow-sm hover:border-indigo-300">
                    <p className="text-2xl font-extrabold text-indigo-950">{value}</p>
                    <p className="mt-1 text-[11px] font-semibold text-indigo-800">{label}</p>
                  </button>
                ))}
              </section>
              {organizationId && (
                <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">You also manage a venue workspace</p>
                    <p className="mt-0.5 text-xs text-emerald-800">Open your venue administration workspace without leaving the platform account.</p>
                  </div>
                  <button type="button" onClick={onOpenVenueWorkspace} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800">Open Venue Workspace →</button>
                </div>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <h2 className="text-sm font-bold text-amber-950">Awaiting first administrator</h2>
                  {awaitingAdmin.length === 0 ? <p className="mt-2 text-xs text-amber-800">No venues are waiting on a managed administrator.</p> : (
                    <ul className="mt-3 space-y-2">
                      {awaitingAdmin.map((organization) => (
                        <li key={organization.id}>
                          <button type="button" onClick={() => go('venue-detail', organization.id)} className="text-sm font-semibold text-amber-950 hover:underline">{organization.name}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <h2 className="text-sm font-bold text-red-950">Suspended venues</h2>
                  {suspended.length === 0 ? <p className="mt-2 text-xs text-red-800">No venues are currently suspended.</p> : (
                    <ul className="mt-3 space-y-2">
                      {suspended.map((organization) => (
                        <li key={organization.id}>
                          <button type="button" onClick={() => go('venue-detail', organization.id)} className="text-sm font-semibold text-red-950 hover:underline">{organization.name}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          )}

          {route.section === 'venues' && (
            <VenueDirectory
              loading={loading}
              venues={filteredVenues}
              allCount={organizations.length}
              metrics={metrics}
              query={query}
              statusFilter={statusFilter}
              regionFilter={regionFilter}
              regions={regions}
              onQuery={setQuery}
              onStatus={setStatusFilter}
              onRegion={setRegionFilter}
              onRefresh={() => void loadConsole()}
              onOpen={(id) => go('venue-detail', id)}
              onCopyLogin={copyVenueLogin}
            />
          )}

          {route.section === 'venue-detail' && (
            selectedVenue ? (
              <VenueDetail
                organization={selectedVenue}
                metric={metrics.venues.find((metric) => metric.id === selectedVenue.id)}
                busy={actionId === selectedVenue.id}
                inviteCompose={inviteCompose}
                onBack={() => go('venues')}
                onCopyLogin={copyVenueLogin}
                onReissue={() => void handleReissue(selectedVenue)}
                onRevoke={() => void handleRevoke(selectedVenue)}
                onSuspend={() => void handleSuspend(selectedVenue)}
                onReactivate={() => void handleReactivate(selectedVenue)}
                onSaved={loadConsole}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
                {loading ? 'Loading venue…' : 'That venue was not found.'}
                <div className="mt-3"><button type="button" onClick={() => go('venues')} className="text-indigo-700 hover:underline">Back to directory</button></div>
              </div>
            )
          )}

          {route.section === 'map' && <PlatformVenueMap organizations={organizations} />}

          {route.section === 'onboard' && (
            <OnboardVenueForm
              form={form}
              setForm={setForm}
              verified={onboardVerified}
              onVerifiedChange={setOnboardVerified}
              saving={saving}
              geocoding={geocoding}
              error={error}
              result={result}
              inviteCompose={inviteCompose}
              onSubmit={(event) => void handleCreateVenue(event)}
              onCopyInvite={copyInvite}
              primaryColor={config.primaryColor || '#4A1942'}
            />
          )}

          {route.section === 'branding' && (
            <BrandingSection
              platformBranding={platformBranding}
              setPlatformBranding={setPlatformBranding}
              brandingSaving={brandingSaving}
              onSave={() => void handleSavePlatformBranding(platformBranding)}
              onLogo={handlePlatformLogoUpload}
            />
          )}

          {route.section === 'chat' && (
            <section className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <h2 className="text-sm font-bold text-gray-900">Venue threads</h2>
                <div className="mt-3 space-y-1">
                  {organizations.map((organization) => (
                    <button
                      key={organization.id}
                      type="button"
                      onClick={() => setChatOrganizationId(organization.id)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${chatOrganizationId === organization.id ? 'bg-indigo-700 text-white' : 'hover:bg-gray-50'}`}
                    >
                      {organization.name}
                    </button>
                  ))}
                </div>
              </div>
              <PlatformVenueChatPanel
                organizationId={chatOrganizationId || undefined}
                organizationName={organizations.find((organization) => organization.id === chatOrganizationId)?.name || 'venue'}
                senderSide="platform"
              />
            </section>
          )}

          {route.section === 'audit' && (
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Platform access</p>
                <h2 className="mt-1 text-lg font-bold text-gray-900">Audit log</h2>
              </div>
              {auditLogs.length === 0 ? (
                <p className="px-5 py-8 text-sm text-gray-500">No platform audit events have been recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-gray-50 font-bold text-gray-600">
                      <tr>
                        <th className="px-4 py-2">When</th>
                        <th className="px-4 py-2">Action</th>
                        <th className="px-4 py-2">Venue</th>
                        <th className="px-4 py-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((entry) => {
                        const venue = organizations.find((organization) => organization.id === entry.organizationId);
                        return (
                          <tr key={entry.id} className="border-t border-gray-100">
                            <td className="px-4 py-2 text-gray-600">{new Date(entry.createdAt).toLocaleString()}</td>
                            <td className="px-4 py-2 font-semibold text-gray-800">{entry.action}</td>
                            <td className="px-4 py-2 text-gray-600">{venue?.name || entry.organizationId || '—'}</td>
                            <td className="px-4 py-2 text-gray-600">{entry.reason || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function VenueDirectory({
  loading,
  venues,
  allCount,
  metrics,
  query,
  statusFilter,
  regionFilter,
  regions,
  onQuery,
  onStatus,
  onRegion,
  onRefresh,
  onOpen,
  onCopyLogin,
}: {
  loading: boolean;
  venues: PlatformOrganizationSummary[];
  allCount: number;
  metrics: PlatformConsoleMetrics;
  query: string;
  statusFilter: OrganizationStatus | 'all';
  regionFilter: string;
  regions: string[];
  onQuery: (value: string) => void;
  onStatus: (value: OrganizationStatus | 'all') => void;
  onRegion: (value: string) => void;
  onRefresh: () => void;
  onOpen: (id: string) => void;
  onCopyLogin: (slug: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Tenant directory</p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">Venue organizations</h2>
          <p className="mt-1 text-xs text-gray-500">{venues.length} of {allCount} venues</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => go('onboard')} className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white">Onboard venue</button>
          <button type="button" onClick={onRefresh} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">Refresh</button>
        </div>
      </div>
      <div className="mb-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_160px_180px]">
        <label className="block text-xs font-semibold text-gray-700">
          Search
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Name, slug, city, contact…"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-semibold text-gray-700">
          Status
          <select value={statusFilter} onChange={(event) => onStatus(event.target.value as OrganizationStatus | 'all')} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="provisioning">Provisioning</option>
            <option value="suspended">Suspended</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="block text-xs font-semibold text-gray-700">
          Region
          <select value={regionFilter} onChange={(event) => onRegion(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm">
            <option value="">All regions</option>
            {regions.map((region) => <option key={region} value={region}>{region}</option>)}
          </select>
        </label>
      </div>
      {loading ? <p className="py-8 text-center text-sm text-gray-500">Loading venue organizations…</p> : venues.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">No venues match this search.</div>
      ) : (
        <div className="space-y-3">
          {venues.map((organization) => {
            const venueMetric = metrics.venues.find((metric) => metric.id === organization.id);
            return (
              <article key={organization.id} className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <button type="button" onClick={() => onOpen(organization.id)} className="text-left text-sm font-bold text-gray-900 hover:underline">{organization.name}</button>
                    <p className="mt-0.5 font-mono text-[11px] text-gray-500">{organization.slug}</p>
                    <p className="mt-1 text-xs text-gray-600">{[organization.city, organization.stateRegion, organization.country].filter(Boolean).join(', ') || 'No location yet'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyles[organization.status] || statusStyles.active}`}>{organization.status}</span>
                    <button type="button" onClick={() => onCopyLogin(organization.slug)} className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50">Copy staff login</button>
                    <button type="button" onClick={() => onOpen(organization.id)} className="rounded-lg bg-indigo-700 px-2.5 py-1.5 text-[11px] font-bold text-white">Open / edit</button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-5">
                  <span>Admins: {venueMetric?.adminCount ?? organization.admins.length}</span>
                  <span>Couples: {venueMetric?.coupleCount ?? 0}</span>
                  <span>Guests: {venueMetric?.guestCount ?? 0}</span>
                  <span>RSVPs: {venueMetric?.rsvpCount ?? 0}</span>
                  <span>Created: {new Date(organization.createdAt).toLocaleDateString()}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function VenueDetail({
  organization,
  metric,
  busy,
  onBack,
  onCopyLogin,
  onReissue,
  onRevoke,
  onSuspend,
  onReactivate,
  onSaved,
  inviteCompose,
}: {
  organization: PlatformOrganizationSummary;
  metric?: PlatformConsoleMetrics['venues'][number];
  busy: boolean;
  inviteCompose: InviteComposeMessage | null;
  onBack: () => void;
  onCopyLogin: (slug: string) => void;
  onReissue: () => void;
  onRevoke: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    name: organization.name,
    status: organization.status,
    addressLine1: organization.addressLine1 || '',
    addressLine2: organization.addressLine2 || '',
    city: organization.city || '',
    stateRegion: organization.stateRegion || '',
    postalCode: organization.postalCode || '',
    country: organization.country || 'US',
    primaryContactFirstName: splitContactName(organization.primaryContactName || '').firstName,
    primaryContactLastName: splitContactName(organization.primaryContactName || '').lastName,
    primaryContactPhone: organization.primaryContactPhone || '',
    primaryContactEmail: organization.primaryContactEmail || '',
    supportEmail: organization.supportEmail || '',
    phone: organization.phone || '',
    websiteUrl: organization.websiteUrl || '',
    suspensionReason: organization.suspensionReason || '',
  });
  const [saving, setSaving] = useState(false);
  const [addressVerified, setAddressVerified] = useState(hasCompleteStreetAddress(organization));

  useEffect(() => {
    setAddressVerified(hasCompleteStreetAddress(organization));
    setDraft({
      name: organization.name,
      status: organization.status,
      addressLine1: organization.addressLine1 || '',
      addressLine2: organization.addressLine2 || '',
      city: organization.city || '',
      stateRegion: organization.stateRegion || '',
      postalCode: organization.postalCode || '',
      country: organization.country || 'US',
      primaryContactFirstName: splitContactName(organization.primaryContactName || '').firstName,
      primaryContactLastName: splitContactName(organization.primaryContactName || '').lastName,
      primaryContactPhone: organization.primaryContactPhone || '',
      primaryContactEmail: organization.primaryContactEmail || '',
      supportEmail: organization.supportEmail || '',
      phone: organization.phone || '',
      websiteUrl: organization.websiteUrl || '',
      suspensionReason: organization.suspensionReason || '',
    });
  }, [organization]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      let latitude = organization.latitude ?? null;
      let longitude = organization.longitude ?? null;
      const phone = normalizeUsPhone(draft.primaryContactPhone, { required: true });
      const email = normalizeEmail(draft.primaryContactEmail, { required: true });
      const supportEmail = normalizeEmail(draft.supportEmail);
      const venuePhone = normalizeUsPhone(draft.phone);
      const website = normalizeWebsite(draft.websiteUrl);
      const contactError = firstFieldError(phone, email, supportEmail, venuePhone, website);
      if (contactError) throw new Error(contactError);
      if (streetAddressKey(draft) !== streetAddressKey(organization)) {
        if (!addressVerified || !hasCompleteStreetAddress(draft)) {
          throw new Error('Select a verified US street address from the suggestions.');
        }
        const coordinates = await geocodeVenueAddress({ ...draft, country: 'US' });
        latitude = coordinates.latitude;
        longitude = coordinates.longitude;
      }
      await updateVenueOrganization({
        organizationId: organization.id,
        ...draft,
        country: 'US',
        primaryContactName: joinContactName(draft.primaryContactFirstName, draft.primaryContactLastName),
        primaryContactPhone: phone.value,
        primaryContactEmail: email.value,
        supportEmail: supportEmail.value,
        phone: venuePhone.value,
        websiteUrl: website.value,
        latitude,
        longitude,
      });
      showToast(`${draft.name} updated.`, 'success');
      await onSaved();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update the venue.', 'warning');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="text-xs font-semibold text-indigo-700 hover:underline">← Back to directory</button>
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Venue detail</p>
            <h2 className="mt-1 text-lg font-bold text-gray-900">{organization.name}</h2>
            <p className="mt-1 font-mono text-[11px] text-gray-500">Slug is immutable: {organization.slug}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyles[organization.status] || statusStyles.active}`}>{organization.status}</span>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-4">
          <span>Admins: {metric?.adminCount ?? organization.admins.length}</span>
          <span>Couples: {metric?.coupleCount ?? 0}</span>
          <span>Guests: {metric?.guestCount ?? 0}</span>
          <span>RSVPs: {metric?.rsvpCount ?? 0}</span>
        </div>
        {organization.admins.length > 0 && (
          <ul className="mb-4 space-y-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700" aria-label="Venue administrators">
            {organization.admins.map((admin) => (
              <li key={admin.userId}>
                <span className="font-semibold">{admin.fullName}</span>
                {' · '}
                {admin.email || 'No email'}
                {' · '}
                {admin.role}
                {admin.status !== 'active' ? ` (${admin.status})` : ''}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={(event) => void save(event)} className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-gray-700">Venue name *<input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-gray-700">Status
            <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as OrganizationStatus }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="provisioning">Provisioning</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <AddressAutocomplete
            value={{
              addressLine1: draft.addressLine1,
              addressLine2: draft.addressLine2,
              city: draft.city,
              stateRegion: draft.stateRegion,
              postalCode: draft.postalCode,
              country: 'US',
            }}
            verified={addressVerified}
            onVerifiedChange={setAddressVerified}
            onChange={(next) => setDraft((current) => ({ ...current, ...next, country: 'US' }))}
          />
          <label className="text-xs font-semibold text-gray-700">Country<input value="United States" readOnly className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-gray-700">Contact first name *<input value={draft.primaryContactFirstName} onChange={(event) => setDraft((current) => ({ ...current, primaryContactFirstName: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-gray-700">Contact last name *<input value={draft.primaryContactLastName} onChange={(event) => setDraft((current) => ({ ...current, primaryContactLastName: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-gray-700">Contact phone *<input type="tel" value={draft.primaryContactPhone} onChange={(event) => setDraft((current) => ({ ...current, primaryContactPhone: event.target.value }))} onBlur={(event) => { const next = normalizeUsPhone(event.target.value); if (next.ok) setDraft((current) => ({ ...current, primaryContactPhone: next.display })); }} placeholder="(555) 123-4567" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="md:col-span-2 text-xs font-semibold text-gray-700">Contact email *<input type="email" value={draft.primaryContactEmail} onChange={(event) => setDraft((current) => ({ ...current, primaryContactEmail: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-gray-700">Support email<input type="email" value={draft.supportEmail} onChange={(event) => setDraft((current) => ({ ...current, supportEmail: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-gray-700">Venue phone<input type="tel" value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} onBlur={(event) => { const next = normalizeUsPhone(event.target.value); if (next.ok) setDraft((current) => ({ ...current, phone: next.display })); }} placeholder="(555) 123-4567" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="md:col-span-2 text-xs font-semibold text-gray-700">Website<input value={draft.websiteUrl} onChange={(event) => setDraft((current) => ({ ...current, websiteUrl: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
          {(draft.status === 'suspended' || draft.status === 'archived') && (
            <label className="md:col-span-2 text-xs font-semibold text-gray-700">Status reason<textarea value={draft.suspensionReason} onChange={(event) => setDraft((current) => ({ ...current, suspensionReason: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={2} /></label>
          )}
          <button type="submit" disabled={saving} className="md:col-span-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save venue changes'}</button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200 pt-4">
          <button type="button" onClick={() => onCopyLogin(organization.slug)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700">Copy staff login</button>
          {organization.pendingInvite && (
            <>
              <span className="self-center text-xs text-gray-600">Pending admin: {organization.pendingInvite.email} · expires {formatInviteExpiry(organization.pendingInvite.expiresAt)}</span>
              <button type="button" disabled={busy} onClick={onReissue} className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">Reissue & email invite</button>
              <button type="button" disabled={busy} onClick={onRevoke} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60">Revoke invite</button>
            </>
          )}
          {!organization.ownerId && !organization.pendingInvite && <button type="button" disabled={busy} onClick={onReissue} className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">Send admin invite</button>}
          {organization.status === 'suspended' ? (
            <button type="button" disabled={busy} onClick={onReactivate} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">Reactivate venue</button>
          ) : organization.status !== 'archived' && (
            <button type="button" disabled={busy} onClick={onSuspend} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60">Suspend venue access</button>
          )}
        </div>
        {inviteCompose?.html && <InviteHtmlPreview html={inviteCompose.html} />}
      </section>
      <PlatformVenueChatPanel organizationId={organization.id} organizationName={organization.name} senderSide="platform" />
    </div>
  );
}

function OnboardVenueForm({
  form,
  setForm,
  verified,
  onVerifiedChange,
  saving,
  geocoding,
  error,
  result,
  inviteCompose,
  onSubmit,
  onCopyInvite,
  primaryColor,
}: {
  form: typeof EMPTY_FORM;
  setForm: (updater: (current: typeof EMPTY_FORM) => typeof EMPTY_FORM) => void;
  verified: boolean;
  onVerifiedChange: (verified: boolean) => void;
  saving: boolean;
  geocoding: boolean;
  error: string;
  result: CreateVenueOrganizationResult | null;
  inviteCompose: InviteComposeMessage | null;
  onSubmit: (event: FormEvent) => void;
  onCopyInvite: () => void;
  primaryColor: string;
}) {
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Tenant onboarding</p>
      <h2 className="mt-1 text-lg font-bold text-gray-900">Create a venue organization</h2>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">The venue slug is generated from the name and permanently frozen. Creating the venue emails a new HTML invite with a Set up your account button.</p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <label className="block text-xs font-semibold text-gray-700">Venue name *<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
        <AddressAutocomplete
          value={form}
          verified={verified}
          onVerifiedChange={onVerifiedChange}
          onChange={(next) => setForm((current) => ({ ...current, ...next, country: 'US' }))}
        />
        <label className="block text-xs font-semibold text-gray-700">Country<input value="United States" readOnly className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-gray-700">Contact first name *<input value={form.primaryContactFirstName} onChange={(event) => setForm((current) => ({ ...current, primaryContactFirstName: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="block text-xs font-semibold text-gray-700">Contact last name *<input value={form.primaryContactLastName} onChange={(event) => setForm((current) => ({ ...current, primaryContactLastName: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
        </div>
        <label className="block text-xs font-semibold text-gray-700">Contact phone *<input type="tel" value={form.primaryContactPhone} onChange={(event) => setForm((current) => ({ ...current, primaryContactPhone: event.target.value }))} onBlur={(event) => { const next = normalizeUsPhone(event.target.value); if (next.ok) setForm((current) => ({ ...current, primaryContactPhone: next.display })); }} placeholder="(555) 123-4567" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
        <label className="block text-xs font-semibold text-gray-700">Contact email *<input type="email" value={form.primaryContactEmail} onChange={(event) => setForm((current) => ({ ...current, primaryContactEmail: event.target.value, adminEmail: current.adminEmail || event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
        <label className="block text-xs font-semibold text-gray-700">First administrator email *<input type="email" value={form.adminEmail} onChange={(event) => setForm((current) => ({ ...current, adminEmail: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
        <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] text-indigo-800">Choose a Geoapify street suggestion so city, state, and ZIP fill automatically. The server verifies the address and caches coordinates before the venue is created. {geocoding ? 'Verifying address…' : ''}</p>
        <button type="submit" disabled={saving || geocoding} className="w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ backgroundColor: primaryColor }}>{geocoding ? 'Verifying address…' : saving ? 'Creating venue…' : 'Create Venue & Generate Admin Link'}</button>
      </form>
      {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {result && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-bold text-emerald-900">Venue created: {result.organizationSlug}</p>
          <p className="mt-1 text-xs text-emerald-800">Invite expires {formatInviteExpiry(result.expiresAt)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onCopyInvite} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800">Copy setup link</button>
          </div>
          {inviteCompose?.html && <InviteHtmlPreview html={inviteCompose.html} />}
          <p className="mt-2 break-all rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-[11px] text-gray-700">{result.inviteUrl}</p>
        </div>
      )}
    </section>
  );
}


function InviteHtmlPreview({ html }: { html: string }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-emerald-200 bg-white">
      <p className="border-b border-emerald-100 px-3 py-1.5 text-[11px] font-semibold text-emerald-900">
        Email the venue receives — {VENUE_ADMIN_SETUP_BUTTON_LABEL} is the invite link
      </p>
      <iframe title="Invite email preview" sandbox="" srcDoc={html} className="h-[380px] w-full bg-white" />
    </div>
  );
}

function BrandingSection({
  platformBranding,
  setPlatformBranding,
  brandingSaving,
  onSave,
  onLogo,
}: {
  platformBranding: typeof defaultPlatformConfig;
  setPlatformBranding: (next: typeof defaultPlatformConfig) => void;
  brandingSaving: boolean;
  onSave: () => void;
  onLogo: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Platform identity</p>
      <h2 className="mt-1 text-lg font-bold text-gray-900">Platform login and console branding</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-gray-700">Platform name<input value={platformBranding.venueName} onChange={(event) => setPlatformBranding({ ...platformBranding, venueName: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="block text-xs font-semibold text-gray-700">Tagline<input value={platformBranding.tagline} onChange={(event) => setPlatformBranding({ ...platformBranding, tagline: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="block text-xs font-semibold text-gray-700">Login welcome message<textarea value={platformBranding.loginWelcomeMessage || ''} onChange={(event) => setPlatformBranding({ ...platformBranding, loginWelcomeMessage: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={2} /></label>
          <InviteEmailTemplateEditor branding={platformBranding} onChange={setPlatformBranding} />
          <div className="flex items-center gap-3">
            <input id="platform-logo-upload" type="file" accept="image/*" className="sr-only" onChange={(event) => void onLogo(event)} />
            <label htmlFor="platform-logo-upload" className="cursor-pointer rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-800">Upload platform logo</label>
            {platformBranding.logoUrl && <img src={platformBranding.logoUrl} alt="Platform logo" className="h-10 w-10 rounded-lg border object-contain" />}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-gray-700">Background mode<select value={platformBranding.loginBackgroundType || 'gradient'} onChange={(event) => setPlatformBranding({ ...platformBranding, loginBackgroundType: event.target.value as typeof platformBranding.loginBackgroundType })} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"><option value="solid">Solid</option><option value="gradient">Gradient</option><option value="pattern">Pattern</option><option value="animated">Animated</option></select></label>
          <label className="text-xs font-semibold text-gray-700">Animation<select value={platformBranding.loginBackgroundAnimation || 'none'} onChange={(event) => setPlatformBranding({ ...platformBranding, loginBackgroundAnimation: event.target.value as typeof platformBranding.loginBackgroundAnimation })} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"><option value="none">None</option><option value="drift">Drift</option><option value="shimmer">Shimmer</option><option value="float">Float</option></select></label>
          <label className="text-xs font-semibold text-gray-700">Primary color<input type="color" value={platformBranding.loginBackgroundColor || platformBranding.primaryColor} onChange={(event) => setPlatformBranding({ ...platformBranding, loginBackgroundColor: event.target.value, primaryColor: event.target.value })} className="mt-1 h-10 w-full rounded-lg border" /></label>
          <label className="text-xs font-semibold text-gray-700">Secondary color<input type="color" value={platformBranding.loginBackgroundSecondaryColor || platformBranding.primaryLight} onChange={(event) => setPlatformBranding({ ...platformBranding, loginBackgroundSecondaryColor: event.target.value, primaryLight: event.target.value })} className="mt-1 h-10 w-full rounded-lg border" /></label>
          <button type="button" disabled={brandingSaving} onClick={onSave} className="col-span-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{brandingSaving ? 'Saving…' : 'Save Platform Branding'}</button>
        </div>
      </div>
    </section>
  );
}
