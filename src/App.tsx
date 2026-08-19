import { Suspense, useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { LiveRegion } from './components/LiveRegion';
import { ModalProvider } from './contexts/ModalContext';
import { getGuestPortalTokenFromLocation } from './utils/guestPortal';
import { getCoupleTokenFromLocation } from './services/couples/coupleService';
import { getCoupleIdFromLocation } from './services/couples/coupleGuestService';
import { ToastContainer, showToast } from './components/Toast';
import { on } from './utils/appEvents';
import { lazy } from 'react';
import PlatformLoginScreen from './components/PlatformLoginScreen';

const AuthenticatedApp = lazy(() => import('./components/AuthenticatedApp'));
const CouplesPortal = lazy(() => import('./components/CouplesPortal'));
const GuestPortal = lazy(() => import('./components/GuestPortal'));
const ForcePasswordChange = lazy(() => import('./components/ForcePasswordChange'));
const AcceptInvite = lazy(() => import('./components/AcceptInvite').then((m) => ({ default: m.AcceptInvite })));
const PlatformAdminPortal = lazy(() => import('./components/PlatformAdminPortal'));
const VenueAdminOnboarding = lazy(() => import('./components/VenueAdminOnboarding'));
const VenueLoginScreen = lazy(() => import('./components/VenueLoginScreen'));

/**
 * Surfaces `spm_storage_error` events as toasts no matter which screen is
 * mounted (login, guest portal, or the planning workspace). Previously this
 * listener only existed inside AuthenticatedApp, so storage failures on the
 * login/guest screens were silently dropped.
 */
function getVenueAdminTokenFromLocation(location: Location = window.location): string | undefined {
  const hash = location.hash || '';
  const queryIndex = hash.indexOf('?');
  if (queryIndex < 0) return undefined;
  return new URLSearchParams(hash.slice(queryIndex + 1)).get('token') || undefined;
}

function getVenueSlugFromLocation(location: Location = window.location): string {
  const hash = location.hash || '';
  const [route, query] = hash.split('?');
  const queryVenue = query ? new URLSearchParams(query).get('venue') : null;
  if (queryVenue) return queryVenue.trim();
  const prefix = '#/venue-login/';
  return route.startsWith(prefix) ? decodeURIComponent(route.slice(prefix.length)).trim() : '';
}

function GlobalStorageErrorListener() {
  useEffect(
    () =>
      on('spm_storage_error', (detail) => {
        const verb = detail.action === 'save' ? 'save' : 'load';
        showToast(`Could not ${verb} "${detail.key}": ${detail.error}`, 'warning');
      }),
    [],
  );
  return null;
}

function AppContent() {
  const { user, continueAsGuest, isPlatformAdmin, registerWithInvite, organizationSlug } = useAuth();
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // First venue administrator onboarding is a public invitation route. The
  // invitee creates an Auth account and claims the platform-created tenant.
  if (hash.startsWith('#/venue-onboarding')) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <VenueAdminOnboarding token={getVenueAdminTokenFromLocation(window.location)} />
      </Suspense>
    );
  }

  // Accept-invite route: requires the user to be signed in.
  if (hash.startsWith('#/accept-invite/')) {
    const token = hash.slice('#/accept-invite/'.length).split('/')[0];
    if (!user) {
      return (
        <LoginScreen
          onContinueAsGuest={continueAsGuest}
          allowAccountCreation
          onRegister={(params) => registerWithInvite(token, params)}
        />
      );
    }
    return (
      <Suspense fallback={<LoadingScreen />}>
        <AcceptInvite
          token={token}
          onDone={() => { window.location.hash = ''; }}
        />
      </Suspense>
    );
  }

  if (hash.startsWith('#/venue-login/')) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <VenueLoginScreen slug={getVenueSlugFromLocation(window.location)} />
      </Suspense>
    );
  }

  if (hash.startsWith('#/couples-portal')) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-slate-100 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="text-4xl animate-pulse">💍</div>
              <p className="text-sm text-gray-500">Loading Couples Portal…</p>
            </div>
          </div>
        }
      >
        <CouplesPortal
          coupleToken={getCoupleTokenFromLocation(window.location)}
          venueSlug={getVenueSlugFromLocation(window.location)}
          onExitPortal={() => {
            window.location.hash = '';
          }}
        />
      </Suspense>
    );
  }

  if (hash.startsWith('#/guest-portal')) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-slate-100 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="text-4xl animate-pulse">🌸</div>
              <p className="text-sm text-gray-500">Loading Guest Portal…</p>
            </div>
          </div>
        }
      >
        <GuestPortal
          guestToken={getGuestPortalTokenFromLocation(window.location)}
          coupleEventId={getCoupleIdFromLocation(window.location)}
          venueSlug={getVenueSlugFromLocation(window.location)}
          preview={new URLSearchParams(window.location.hash.split('?')[1] || '').get('preview') === '1'}
          onExitPortal={() => {
            window.location.hash = '';
          }}
        />
      </Suspense>
    );
  }

  if ((hash === '' || hash === '#/' || hash === '#/platform-login') && !user) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <PlatformLoginScreen />
      </Suspense>
    );
  }

  if (hash.startsWith('#/platform-admin') && !user) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <PlatformLoginScreen />
      </Suspense>
    );
  }

  if (hash.startsWith('#/platform-admin') && user && !isPlatformAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-lg">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-3 text-lg font-bold text-gray-900">Platform administrator access required</h1>
          <p className="mt-2 text-sm text-gray-600">This account is not assigned a platform administrator role.</p>
          <button type="button" onClick={() => { window.location.hash = ''; }} className="mt-4 rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white">Return to workspace</button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <PlatformLoginScreen />
      </Suspense>
    );
  }

  // Force a password change before letting anyone past the login gate if the
  // account still uses a default/temporary credential (security hardening).
  if (user.requiresPasswordChange) {
    return (
      <Suspense
        fallback={<LoadingScreen />}
      >
        <ForcePasswordChange />
      </Suspense>
    );
  }

  if (isPlatformAdmin && (hash === '' || hash === '#/' || hash.startsWith('#/platform-admin'))) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <PlatformAdminPortal onOpenVenueWorkspace={() => { window.location.hash = organizationSlug ? `#/venue-login/${encodeURIComponent(organizationSlug)}` : '#/venue'; }} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <AuthenticatedApp />
    </Suspense>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <ModalProvider>
          <GlobalStorageErrorListener />
          <LiveRegion />
          <AppContent />
          <ToastContainer />
        </ModalProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
