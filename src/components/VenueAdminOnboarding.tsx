import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  acceptVenueAdminInvite,
  lookupVenueAdminInvite,
} from '../services/platform/platformAdminService';
import {
  captureVenueAdminInviteToken,
  clearVenueAdminInviteToken,
  describeVenueAdminInviteError,
} from '../utils/venueAdminInviteRoute';
import { signUpVenueAdminWithInvite } from '../services/backend/AuthBackend';
import { isSupabaseConfigured } from '../services/backend/supabaseClient';
import type { VenueAdminInviteContext } from '../services/platform/platformAdminService';
import { getPublicVenueBranding } from '../services/platform/publicVenueService';
import { NEUTRAL_LOGIN_CONFIG, applyLoginBranding, loginBackgroundStyle, resolveLoginChrome } from '../utils/loginBranding';
import type { Config } from '../types';

interface VenueAdminOnboardingProps {
  token?: string;
}

export default function VenueAdminOnboarding({ token }: VenueAdminOnboardingProps) {
  const { user, logout } = useAuth();
  const [invite, setInvite] = useState<VenueAdminInviteContext | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [branding, setBranding] = useState<Config>(NEUTRAL_LOGIN_CONFIG);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const resolvedToken = token || captureVenueAdminInviteToken();
  const chrome = resolveLoginChrome(branding);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [state, setState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    applyLoginBranding(NEUTRAL_LOGIN_CONFIG);
  }, []);

  useEffect(() => {
    if (!resolvedToken) return;
    captureVenueAdminInviteToken();
    try {
      if (!window.location.hash.split('?')[0].startsWith('#/venue-onboarding')) {
        window.location.hash = '#/venue-onboarding';
      }
      const url = new URL(window.location.href);
      url.searchParams.delete('va');
      url.searchParams.delete('token');
      url.hash = '#/venue-onboarding';
      const next = `${url.pathname}${url.search}${url.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (next !== current) {
        window.history.replaceState(null, '', next);
      }
    } catch {
      // Best-effort; the token is already in sessionStorage and React state.
    }
  }, [resolvedToken]);

  useEffect(() => {
    let cancelled = false;
    if (!resolvedToken || !isSupabaseConfigured()) {
      setInviteError(resolvedToken ? '' : 'missing');
      setLoadingInvite(false);
      return;
    }
    void lookupVenueAdminInvite(resolvedToken).then(async ({ context, error }) => {
      if (cancelled) return;
      setInvite(context);
      setInviteError(context ? '' : (error || 'not_found'));
      if (context) setForm((current) => ({ ...current, email: context.email }));
      if (context?.organizationSlug) {
        const publicBrand = await getPublicVenueBranding(context.organizationSlug);
        if (!cancelled && publicBrand) {
          setBranding(publicBrand.config);
          applyLoginBranding(publicBrand.config);
        } else if (!cancelled) {
          applyLoginBranding(NEUTRAL_LOGIN_CONFIG);
        }
      } else {
        applyLoginBranding(NEUTRAL_LOGIN_CONFIG);
      }
      setLoadingInvite(false);
    });
    return () => { cancelled = true; };
  }, [resolvedToken]);

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
    if (!resolvedToken || !user || !signedInUserMatchesInvite) return;
    setState('saving');
    setMessage('Claiming your venue workspace…');
    try {
      const result = await acceptVenueAdminInvite(resolvedToken);
      clearVenueAdminInviteToken();
      finish(result.organizationSlug || invite?.organizationSlug);
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Could not claim this venue invitation.');
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!resolvedToken || !invite) {
      setState('error');
      setMessage(describeVenueAdminInviteError(inviteError || 'missing'));
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
        inviteToken: resolvedToken,
      });
      clearVenueAdminInviteToken();
      finish(session.organizationSlug || invite.organizationSlug);
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Could not complete venue administrator setup.');
    }
  };

  return (
    <div className="min-h-screen px-4 py-8" style={{ ...loginBackgroundStyle(branding), fontFamily: chrome.fontFamily, color: chrome.bodyText }}>
      <div className="mx-auto flex min-h-[80vh] max-w-lg items-center justify-center">
        <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="text-center">
            <div className="text-4xl">🏛️</div>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Venue administrator setup</p>
            <h1 className="mt-1 text-2xl font-bold" style={{ color: chrome.primary, fontFamily: chrome.headingFontFamily }}>Claim your venue workspace</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">Create the managed administrator account for this venue. This account will configure the venue and invite its internal team.</p>
          </div>

          {loadingInvite ? (
            <p className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">Checking invitation…</p>
          ) : !resolvedToken || !invite ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{describeVenueAdminInviteError(inviteError || (!resolvedToken ? 'missing' : 'not_found'))}</div>
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
              <button type="button" onClick={() => void handleExistingAccount()} disabled={state === 'saving'} className="w-full rounded-lg px-4 py-3 text-sm font-bold disabled:opacity-60" style={{ backgroundColor: chrome.primary, color: chrome.headerText }}>{state === 'saving' ? 'Claiming venue…' : 'Claim Venue Administrator Access'}</button>
            </div>
          ) : (
            <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-3">
              <div><label htmlFor="venue-admin-full-name" className="mb-1 block text-xs font-semibold text-gray-700">Full name</label><input id="venue-admin-full-name" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" autoComplete="name" /></div>
              <div><label htmlFor="venue-admin-email" className="mb-1 block text-xs font-semibold text-gray-700">Invited email address</label><input id="venue-admin-email" type="email" value={form.email} readOnly className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2.5 text-sm" autoComplete="email" /><p className="mt-1 text-[11px] text-gray-500">This address is fixed to the platform invitation: {invite.email}</p></div>
              <div><label htmlFor="venue-admin-password" className="mb-1 block text-xs font-semibold text-gray-700">Password</label><input id="venue-admin-password" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" autoComplete="new-password" /></div>
              <div><label htmlFor="venue-admin-confirm-password" className="mb-1 block text-xs font-semibold text-gray-700">Confirm password</label><input id="venue-admin-confirm-password" type="password" value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" autoComplete="new-password" /></div>
              <button type="submit" disabled={state === 'saving'} className="w-full rounded-lg px-4 py-3 text-sm font-bold disabled:opacity-60" style={{ backgroundColor: chrome.primary, color: chrome.headerText }}>{state === 'saving' ? 'Creating account…' : 'Create Venue Administrator Account'}</button>
            </form>
          )}

          {message && <div className={`mt-4 rounded-xl border p-3 text-sm ${state === 'error' ? 'border-red-200 bg-red-50 text-red-700' : state === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-gray-50 text-gray-700'}`} role={state === 'error' ? 'alert' : 'status'}>{message}</div>}
          {state !== 'success' && <button type="button" onClick={() => { window.location.hash = '#/platform-login'; }} className="mt-6 w-full text-center text-xs text-gray-500 hover:underline">Return to platform login</button>}
        </div>
      </div>
    </div>
  );
}
