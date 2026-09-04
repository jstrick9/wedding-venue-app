import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPublicVenueBranding, type PublicVenueBranding } from '../services/platform/publicVenueService';
import { withTimeout } from '../utils/withTimeout';
import { LoginScreen } from './LoginScreen';
import { NEUTRAL_LOGIN_CONFIG, applyLoginBranding, loginBackgroundStyle, resolveLoginChrome } from '../utils/loginBranding';
import type { Config } from '../types';

interface VenueLoginScreenProps {
  slug: string;
}

function VenueAuthStatusCard({
  branding,
  icon,
  title,
  body,
  actionLabel,
  onAction,
  secondary,
}: {
  branding: Config;
  icon: string;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  secondary?: { label: string; onClick: () => void };
}) {
  const chrome = resolveLoginChrome(branding);
  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-6 text-center"
      style={{ ...loginBackgroundStyle(branding), fontFamily: chrome.fontFamily, color: chrome.bodyText }}
    >
      <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
        <div className="text-4xl">{icon}</div>
        <h1 className="mt-3 text-lg font-bold" style={{ color: chrome.primary, fontFamily: chrome.headingFontFamily }}>{title}</h1>
        <p className="mt-2 text-sm text-gray-600">{body}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: chrome.primary, color: chrome.headerText }}
          >
            {actionLabel}
          </button>
        )}
        {secondary && (
          <button type="button" onClick={secondary.onClick} className="mt-3 block w-full text-xs text-gray-500 hover:underline">
            {secondary.label}
          </button>
        )}
      </div>
    </div>
  );
}

export default function VenueLoginScreen({ slug }: VenueLoginScreenProps) {
  const { user, organizationId, organizationSlug, loginForOrganization, logout } = useAuth();
  const [venue, setVenue] = useState<PublicVenueBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryId, setRetryId] = useState(0);

  useEffect(() => {
    applyLoginBranding(NEUTRAL_LOGIN_CONFIG);
    let cancelled = false;
    setLoading(true);
    setVenue(null);
    setLoadError('');
    void (async () => {
      try {
        const result = await withTimeout(
          getPublicVenueBranding(slug),
          20000,
          'Loading venue sign-in timed out. Check the venue link and try again.',
        );
        if (cancelled) return;
        setVenue(result);
        if (result) applyLoginBranding(result.config);
      } catch {
        if (cancelled) return;
        setVenue(null);
        setLoadError('Could not load this venue sign-in. Check your connection and try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, retryId]);

  // Already signed in to this venue: do not block Open Workspace on public branding.
  const signedInHere = Boolean(user && organizationSlug && organizationSlug === slug.trim());
  const venueBlocked = venue?.status === 'suspended' || venue?.status === 'archived';
  if (signedInHere && !venueBlocked) {
    const branding = venue?.config || NEUTRAL_LOGIN_CONFIG;
    const venueName = venue?.config.venueName || slug;
    return (
      <VenueAuthStatusCard
        branding={branding}
        icon="✅"
        title={`You are signed in to ${venueName}`}
        body="Continue to the venue-managed workspace."
        actionLabel="Open Venue Workspace →"
        onAction={() => { window.location.hash = '#/home'; }}
        secondary={{ label: 'Sign out', onClick: logout }}
      />
    );
  }

  if (loading) {
    return (
      <VenueAuthStatusCard
        branding={NEUTRAL_LOGIN_CONFIG}
        icon="🏛️"
        title="Loading venue sign-in"
        body="Preparing this venue’s branded login…"
      />
    );
  }

  if (loadError) {
    return (
      <VenueAuthStatusCard
        branding={NEUTRAL_LOGIN_CONFIG}
        icon="🏛️"
        title="Venue sign-in unavailable"
        body={loadError}
        actionLabel="Try again"
        onAction={() => { setRetryId((current) => current + 1); }}
        secondary={{ label: 'Platform login', onClick: () => { window.location.hash = '#/platform-login'; } }}
      />
    );
  }

  if (!venue) {
    return (
      <VenueAuthStatusCard
        branding={NEUTRAL_LOGIN_CONFIG}
        icon="🏛️"
        title="Venue login not found"
        body="This venue link is invalid or the venue is not available."
        actionLabel="Platform login"
        onAction={() => { window.location.hash = '#/platform-login'; }}
      />
    );
  }

  if (venue.status === 'suspended' || venue.status === 'archived') {
    return (
      <VenueAuthStatusCard
        branding={venue.config}
        icon="⛔"
        title="Venue access is unavailable"
        body={`${venue.config.venueName} is currently unavailable. Please contact the platform administrator.`}
        actionLabel="Platform login"
        onAction={() => { window.location.hash = '#/platform-login'; }}
      />
    );
  }

  if (user && organizationId === venue.organizationId) {
    return (
      <VenueAuthStatusCard
        branding={venue.config}
        icon="✅"
        title={`You are signed in to ${venue.config.venueName}`}
        body="Continue to the venue-managed workspace."
        actionLabel="Open Venue Workspace →"
        onAction={() => { window.location.hash = '#/home'; }}
        secondary={{ label: 'Sign out', onClick: logout }}
      />
    );
  }

  return (
    <LoginScreen
      brandingOverride={venue.config}
      organizationId={venue.organizationId}
      loginScope="venue"
      showPublicPortalLinks={false}
      onLogin={(email, password) => loginForOrganization(venue.organizationId, email, password)}
    />
  );
}
