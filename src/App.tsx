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
import { getActiveOrganizationSlug } from './services/platform/organizationContext';
import { isVenueStaffRoute } from './utils/authSurface';
import { isPlatformConsoleHash } from './utils/platformConsoleRoute';
import { passwordResetSurfaceFromLocation, shouldShowPasswordRecovery } from './utils/passwordResetRoute';
import { captureVenueAdminInviteToken, shouldShowVenueAdminOnboarding } from './utils/venueAdminInviteRoute';

const AuthenticatedApp = lazy(() => import('./components/AuthenticatedApp'));
const CouplesPortal = lazy(() => import('./components/CouplesPortal'));
const GuestPortal = lazy(() => import('./components/GuestPortal'));
const ForcePasswordChange = lazy(() => import('./components/ForcePasswordChange'));
const AcceptInvite = lazy(() => import('./components/AcceptInvite').then((m) => ({ default: m.AcceptInvite })));
const PlatformAdminPortal = lazy(() => import('./components/PlatformAdminPortal'));
const VenueAdminOnboarding = lazy(() => import('./components/VenueAdminOnboarding'));
const VenueLoginScreen = lazy(() => import('./components/VenueLoginScreen'));
const PasswordRecoveryScreen = lazy(() => import('./components/PasswordRecoveryScreen'));

/**
 * Surfaces `spm_storage_error` events as toasts no matter which screen is
 * mounted (login, guest portal, or the planning workspace). Previously this
 * listener only existed inside AuthenticatedApp, so storage failures on the
 * login/guest screens were silently dropped.
 */


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

function PlatformAccessDeniedCard({
  body,
  actionLabel,
  onAction,
}: {
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
      <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-lg">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-3 text-lg font-bold text-gray-900">Platform administrator access required</h1>
        <p className="mt-2 text-sm text-gray-600">{body}</p>
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  const {
    user,
    continueAsGuest,
    isPlatformAdmin,
    hasPlatformSession,
    registerWithInvite,
    organizationSlug,
    logout,
  } = useAuth();
  const [hash, setHash] = useState(window.location.hash);
  const [pathname, setPathname] = useState(window.location.pathname);
  const [venueAdminToken, setVenueAdminToken] = useState(() => captureVenueAdminInviteToken());

  useEffect(() => {
    const syncLocation = () => {
      setHash(window.location.hash);
      setPathname(window.location.pathname);
      const next = captureVenueAdminInviteToken();
      if (next) setVenueAdminToken(next);
    };
    window.addEventListener('hashchange', syncLocation);
    window.addEventListener('popstate', syncLocation);
    return () => {
      window.removeEventListener('hashchange', syncLocation);
      window.removeEventListener('popstate', syncLocation);
    };
  }, []);

  // First venue administrator onboarding is a public invitation route. The
  // invitee creates an Auth account and claims the platform-created tenant.
  // Path /i/<token> is the email-safe URL; ?va= and hash links still work.
  if (shouldShowPasswordRecovery({
    hash,
    pathname: pathname || window.location.pathname,
  })) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <PasswordRecoveryScreen surface={passwordResetSurfaceFromLocation({ pathname: pathname || window.location.pathname })} />
      </Suspense>
    );
  }

  if (shouldShowVenueAdminOnboarding({
    hash,
    locationHash: window.location.hash,
    search: window.location.search,
    pathname: pathname || window.location.pathname,
    token: venueAdminToken,
  })) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <VenueAdminOnboarding token={venueAdminToken || captureVenueAdminInviteToken()} />
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

  if (isVenueStaffRoute(hash) && !user) {
    const slug = organizationSlug || getActiveOrganizationSlug() || '';
    if (slug) {
      return (
        <Suspense fallback={<LoadingScreen />}>
          <VenueLoginScreen slug={slug} />
        </Suspense>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
          <div className="text-4xl">🏛️</div>
          <h1 className="mt-3 text-lg font-bold text-gray-900">Venue sign-in is separate</h1>
          <p className="mt-2 text-sm text-gray-600">
            Platform administration and venue workspaces use different accounts. Open this venue from its login link or from the platform console.
          </p>
          <button
            type="button"
            onClick={() => { window.location.hash = '#/platform-login'; }}
            className="mt-4 rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white"
          >
            Platform login
          </button>
        </div>
      </div>
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

  if (isPlatformConsoleHash(hash) && !user) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <PlatformLoginScreen />
      </Suspense>
    );
  }

  // platform_support can sign in on the platform door, but console RPCs are
  // owner/admin only. Do not dump that session into AuthenticatedApp (#216
  // complement). Do not use `user && !isPlatformAdmin` on every console hash —
  // local-mode has a user and no platformRole, and must still open the workspace.
  if (isPlatformConsoleHash(hash) && hasPlatformSession && !isPlatformAdmin) {
    return (
      <PlatformAccessDeniedCard
        body="This platform login is not a platform administrator account. Sign out and use a platform owner or administrator login."
        actionLabel="Sign out"
        onAction={logout}
      />
    );
  }

  if (hash.startsWith('#/platform-admin') && user && !isPlatformAdmin) {
    return (
      <PlatformAccessDeniedCard
        body="This account is not assigned a platform administrator role."
        actionLabel="Return to workspace"
        onAction={() => { window.location.hash = ''; }}
      />
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

  if (isPlatformAdmin && isPlatformConsoleHash(hash)) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <PlatformAdminPortal onOpenVenueWorkspace={() => { window.location.hash = '#/home'; }} />
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
