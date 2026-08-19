import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPublicVenueBranding, type PublicVenueBranding } from '../services/platform/publicVenueService';
import { LoginScreen } from './LoginScreen';

interface VenueLoginScreenProps {
  slug: string;
}

export default function VenueLoginScreen({ slug }: VenueLoginScreenProps) {
  const { user, organizationId, loginForOrganization, logout } = useAuth();
  const [venue, setVenue] = useState<PublicVenueBranding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getPublicVenueBranding(slug).then((result) => {
      if (cancelled) return;
      setVenue(result);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-gray-500">Loading venue sign-in…</div>;
  }

  if (!venue) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-lg">
          <div className="text-4xl">🏛️</div>
          <h1 className="mt-3 text-lg font-bold text-gray-900">Venue login not found</h1>
          <p className="mt-2 text-sm text-gray-600">This venue link is invalid or the venue is not available.</p>
          <button type="button" onClick={() => { window.location.hash = '#/platform-login'; }} className="mt-4 rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white">Platform login</button>
        </div>
      </div>
    );
  }

  if (user && organizationId === venue.organizationId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
        <div className="max-w-md rounded-2xl border border-emerald-200 bg-white p-6 shadow-lg">
          <div className="text-4xl">✅</div>
          <h1 className="mt-3 text-lg font-bold text-gray-900">You are signed in to {venue.config.venueName}</h1>
          <p className="mt-2 text-sm text-gray-600">Continue to the venue-managed workspace.</p>
          <button type="button" onClick={() => { window.location.hash = '#/venue'; }} className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Open Venue Workspace →</button>
          <button type="button" onClick={logout} className="mt-3 block w-full text-xs text-gray-500 hover:underline">Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <LoginScreen
      brandingOverride={venue.config}
      showPublicPortalLinks={false}
      onLogin={(email, password) => loginForOrganization(venue.organizationId, email, password)}
    />
  );
}
