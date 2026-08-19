import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBrandingConfig } from '../config';
import {
  acceptVenueAdminInvite,
  getVenueAdminInviteContext,
} from '../services/platform/platformAdminService';
import { signUpVenueAdminWithInvite } from '../services/backend/AuthBackend';
import { isSupabaseConfigured } from '../services/backend/supabaseClient';
import type { VenueAdminInviteContext } from '../services/platform/platformAdminService';

interface VenueAdminOnboardingProps {
  token?: string;
}

export default function VenueAdminOnboarding({ token }: VenueAdminOnboardingProps) {
  const config = useBrandingConfig();
  const { user, logout } = useAuth();
  const [invite, setInvite] = useState<VenueAdminInviteContext | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [state, setState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Strip the bearer invite token from the URL hash as soon as this component
  // has read it, so the secret does not linger in browser history or in a
  // copied/shareable link after use (Review #180 N-2).
  useEffect(() => {
    if (!token) return;
    try {
      const clean = window.location.hash.replace(/[?&]token=[^&#]*/i, '');
      if (clean !== window.location.hash) {
        window.history.replaceState(null, '', clean || '#/venue-onboarding');
      }
    } catch {
      // Best-effort; failing to rewrite the URL is not fatal to onboarding.
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    if (!token || !isSupabaseConfigured()) {
      setLoadingInvite(false);
      return;
    }
    void getVenueAdminInviteContext(token).then((context) => {
      if (cancelled) return;
      setInvite(context);
      if (context) setForm((current) => ({ ...current, email: context.email }));
      setLoadingInvite(false);
    });
    return () => { cancelled = true; };
  }, [token]);

  const invitedEmail = invite?.email.trim().toLowerCase();
  const signedInEmail = user?.email?.trim().toLowerCase();
  const signedInUserMatchesInvite = !!user && !!invitedEmail && signedInEmail === invitedEmail;

  const finish = (organizationSlug?: string) => {
    setState('success');
    setMessage('Your venue administrator access is ready. Opening the venue staff login…');
    window.setTimeout(() => {
      window.location.hash = organizationSlug ? `#/venue-login/${encodeURIComponent(organizationSlug)}` : '#/platform-login';
      window.location.reload();
    }, 900);
  };

  const handleExistingAccount = async () => {
    if (!token || !user || !signedInUserMatchesInvite) return;
    setState('saving');
    setMessage('Claiming your venue workspace…');
    try {
      const result = await acceptVenueAdminInvite(token);
      finish(result.organizationSlug || invite?.organizationSlug);
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Could not claim this venue invitation.');
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !invite) {
      setState('error');
      setMessage('This setup link is invalid, expired, or has already been used.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setState('error');
      setMessage('Supabase is not configured in this deployment.');
      return;
    }
    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      setState('error');
      setMessage('Enter your name and password.');
      return;
    }
    if (form.email.trim().toLowerCase() !== invitedEmail) {
      setState('error');
      setMessage(`Use the invited email address: ${invite.email}`);
      return;
    }
    if (form.password.length < 8) {
      setState('error');
      setMessage('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setState('error');
      setMessage('Passwords do not match.');
      return;
    }

    setState('saving');
    setMessage('Creating your managed venue administrator account…');
    try {
      const session = await signUpVenueAdminWithInvite({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        fullName: form.fullName.trim(),
        inviteToken: token,
      });
      finish(session.organizationSlug || invite.organizationSlug);
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Could not complete venue administrator setup.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8" style={{ fontFamily: config.fontFamily || 'Inter, system-ui, sans-serif' }}>
      <div className="mx-auto flex min-h-[80vh] max-w-lg items-center justify-center">
        <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="text-center">
            <div className="text-4xl">🏛️</div>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Venue administrator setup</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Claim your venue workspace</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">Create the managed administrator account for this venue. This account will configure the venue and invite its internal team.</p>
          </div>

          {loadingInvite ? (
            <p className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">Checking invitation…</p>
          ) : !token || !invite ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">This setup link is invalid, expired, revoked, or already used.</div>
          ) : user && !signedInUserMatchesInvite ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                You are currently signed in as <strong>{user.email || user.name}</strong>, but this invitation was issued to <strong>{invite.email}</strong>.
              </div>
              <p className="text-xs leading-relaxed text-gray-600">Sign out of the platform administrator account, then create or sign in with the invited venue administrator account. The invitation will remain in this browser route.</p>
              <button type="button" onClick={logout} className="w-full rounded-lg bg-gray-800 px-4 py-3 text-sm font-bold text-white">Sign out and continue as invited admin</button>
            </div>
          ) : user ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">You are signed in as <strong>{user.email}</strong>, the invited venue administrator for <strong>{invite.organizationName}</strong>.</div>
              <button type="button" onClick={() => void handleExistingAccount()} disabled={state === 'saving'} className="w-full rounded-lg px-4 py-3 text-sm font-bold text-white disabled:opacity-60" style={{ backgroundColor: config.primaryColor || '#4A1942' }}>{state === 'saving' ? 'Claiming venue…' : 'Claim Venue Administrator Access'}</button>
            </div>
          ) : (
            <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-3">
              <div><label htmlFor="venue-admin-full-name" className="mb-1 block text-xs font-semibold text-gray-700">Full name</label><input id="venue-admin-full-name" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" autoComplete="name" /></div>
              <div><label htmlFor="venue-admin-email" className="mb-1 block text-xs font-semibold text-gray-700">Invited email address</label><input id="venue-admin-email" type="email" value={form.email} readOnly className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2.5 text-sm" autoComplete="email" /><p className="mt-1 text-[11px] text-gray-500">This address is fixed to the platform invitation: {invite.email}</p></div>
              <div><label htmlFor="venue-admin-password" className="mb-1 block text-xs font-semibold text-gray-700">Password</label><input id="venue-admin-password" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" autoComplete="new-password" /></div>
              <div><label htmlFor="venue-admin-confirm-password" className="mb-1 block text-xs font-semibold text-gray-700">Confirm password</label><input id="venue-admin-confirm-password" type="password" value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" autoComplete="new-password" /></div>
              <button type="submit" disabled={state === 'saving'} className="w-full rounded-lg px-4 py-3 text-sm font-bold text-white disabled:opacity-60" style={{ backgroundColor: config.primaryColor || '#4A1942' }}>{state === 'saving' ? 'Creating account…' : 'Create Venue Administrator Account'}</button>
            </form>
          )}

          {message && <div className={`mt-4 rounded-xl border p-3 text-sm ${state === 'error' ? 'border-red-200 bg-red-50 text-red-700' : state === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-gray-50 text-gray-700'}`} role={state === 'error' ? 'alert' : 'status'}>{message}</div>}
          {state !== 'success' && <button type="button" onClick={() => { window.location.hash = '#/platform-login'; }} className="mt-6 w-full text-center text-xs text-gray-500 hover:underline">Return to platform login</button>}
        </div>
      </div>
    </div>
  );
}
