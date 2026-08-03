import { Suspense, useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { LiveRegion } from './components/LiveRegion';
import { ModalProvider } from './contexts/ModalContext';
import { getGuestPortalTokenFromLocation } from './utils/guestPortal';
import { lazy } from 'react';

const AuthenticatedApp = lazy(() => import('./components/AuthenticatedApp'));
const GuestPortal = lazy(() => import('./components/GuestPortal'));
const ForcePasswordChange = lazy(() => import('./components/ForcePasswordChange'));

function AppContent() {
  const { user, continueAsGuest } = useAuth();
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
          onExitPortal={() => {
            window.location.hash = '';
          }}
        />
      </Suspense>
    );
  }

  if (!user) {
    return <LoginScreen onContinueAsGuest={continueAsGuest} />;
  }

  // Force a password change before letting anyone past the login gate if the
  // account still uses a default/temporary credential (security hardening).
  if (user.requiresPasswordChange) {
    return (
      <Suspense
        fallback={<div className="h-screen flex items-center justify-center">Loading...</div>}
      >
        <ForcePasswordChange />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading Application...</div>}>
      <AuthenticatedApp />
    </Suspense>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <ModalProvider>
          <LiveRegion />
          <AppContent />
        </ModalProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
