import { useEffect, useState, type FormEvent } from 'react';
import { signUpVenueAdminWithInvite } from '../services/backend/AuthBackend';
import { isSupabaseConfigured } from '../services/backend/supabaseClient';
import type { VenueAdminInviteContext } from '../services/platform/platformAdminService';
import { lookupVenueAdminInvite } from '../services/platform/platformAdminService';
import { withTimeout } from '../utils/withTimeout';
import { getPublicVenueBranding } from '../services/platform/publicVenueService';
import { setActiveOrganizationSlug } from '../services/platform/organizationContext';
import { claimVenueWorkspaceTitle } from '../utils/claimVenueTitle';
import { describePasswordPolicyError } from '../utils/passwordPolicy';
import { InvitePasswordFields } from './InvitePasswordFields';
import {
  applyLoginBranding,
  loginBackgroundStyle,
  NEUTRAL_LOGIN_CONFIG,
  resolveLoginChrome,
} from '../utils/loginBranding';
import type { Config } from '../types';
import {
  captureVenueAdminInviteToken,
  clearVenueAdminInviteToken,
  describeVenueAdminClaimError,
  describeVenueAdminInviteError,
} from '../utils/venueAdminInviteRoute';

interface VenueAdminOnboardingProps {
  token?: string;
}

function leaveInviteForVenue(organizationSlug?: string) {
  if (organizationSlug) setActiveOrganizationSlug(organizationSlug);
  window.location.replace(`${window.location.origin}/#/home`);
}

export default function VenueAdminOnboarding({ token }: VenueAdminOnboardingProps) {
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
    if (resolvedToken) captureVenueAdminInviteToken();
  }, [resolvedToken]);

  useEffect(() => {
    let cancelled = false;
    if (!resolvedToken || !isSupabaseConfigured()) {
      setInviteError(resolvedToken ? '' : 'missing');
      setLoadingInvite(false);
      return;
    }
    void (async () => {
      try {
        const { context, error } = await withTimeout(
          lookupVenueAdminInvite(resolvedToken),
          20000,
          'Checking this invitation timed out. Refresh this page, or ask the platform administrator to reissue the invitation.',
        );
        if (cancelled) return;
        setInvite(context);
        setInviteError(context ? '' : (error || 'not_found'));
        if (context) setForm((current) => ({ ...current, email: context.email }));
        setLoadingInvite(false);
        if (!context?.organizationSlug) {
          applyLoginBranding(NEUTRAL_LOGIN_CONFIG);
          return;
        }
        void getPublicVenueBranding(context.organizationSlug)
          .then((publicBrand) => {
            if (cancelled) return;
            if (publicBrand) {
              setBranding(publicBrand.config);
              applyLoginBranding(publicBrand.config);
            } else {
              applyLoginBranding(NEUTRAL_LOGIN_CONFIG);
            }
          })
          .catch(() => {
            if (!cancelled) applyLoginBranding(NEUTRAL_LOGIN_CONFIG);
          });
      } catch (err: unknown) {
        if (cancelled) return;
        setInvite(null);
        setInviteError(err instanceof Error ? err.message : 'not_found');
        setLoadingInvite(false);
      }
    })();
    return () => { cancelled = true; };
  }, [resolvedToken]);

  const invitedEmail = invite?.email.trim().toLowerCase();
  const venueName = invite?.organizationName?.trim() || '';
  const passwordError = describePasswordPolicyError(form.password);
  const claimDisabled =
    state === 'saving'
    || !form.fullName.trim()
    || Boolean(passwordError)
    || form.password !== form.confirmPassword;

  const finish = (organizationSlug?: string) => {
    setState('success');
    setMessage(`Your ${venueName || 'venue'} administrator access is ready. Opening the venue workspace…`);
    window.setTimeout(() => {
      leaveInviteForVenue(organizationSlug);
    }, 600);
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
      setMessage('Account setup is temporarily unavailable. Please try again later or contact the platform administrator.');
      return;
    }
    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      setState('error');
      setMessage('Enter your name and a new password.');
      return;
    }
    if (form.email.trim().toLowerCase() !== invitedEmail) {
      setState('error');
      setMessage(`Use the invited email address: ${invite.email}`);
      return;
    }
    const passwordError = describePasswordPolicyError(form.password);
    if (passwordError) {
      setState('error');
      setMessage(passwordError);
      return;
    }
    if (form.password !== form.confirmPassword) {
      setState('error');
      setMessage('Passwords do not match.');
      return;
    }

    setState('saving');
    setMessage(`Setting your password and claiming ${invite.organizationName}…`);
    try {
      const session = await withTimeout(
        signUpVenueAdminWithInvite({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          fullName: form.fullName.trim(),
          inviteToken: resolvedToken,
        }),
        30000,
        'Claiming the venue timed out. Wait a moment and try Claim Venue Workspace again, or ask the platform administrator to reissue the invitation.',
      );
      clearVenueAdminInviteToken();
      finish(session.organizationSlug || invite.organizationSlug);
    } catch (error) {
      setState('error');
      setMessage(describeVenueAdminClaimError(error));
    }
  };

  return (
    <div className="min-h-screen px-4 py-8" style={{ ...loginBackgroundStyle(branding), fontFamily: chrome.fontFamily, color: chrome.bodyText }}>
      <div className="mx-auto flex min-h-[80vh] max-w-lg items-center justify-center">
        <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="text-center">
            <div className="text-4xl">🏛️</div>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Venue administrator setup</p>
            <h1 className="mt-1 text-2xl font-bold" style={{ color: chrome.primary, fontFamily: chrome.headingFontFamily }}>
              {claimVenueWorkspaceTitle(venueName)}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              {venueName
                ? `Set a new password to claim ${venueName}. This account stays tied to this venue. Existing events, layouts, guests, and team work stay with ${venueName}.`
                : 'Set a new password to claim this venue. Existing venue events, layouts, guests, and team work stay in place.'}
            </p>
          </div>

          {loadingInvite ? (
            <p className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">Checking invitation…</p>
          ) : !resolvedToken || !invite ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{describeVenueAdminInviteError(inviteError || (!resolvedToken ? 'missing' : 'not_found'))}</div>
          ) : (
            <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-3">
              <div>
                <label htmlFor="venue-admin-full-name" className="mb-1 block text-xs font-semibold text-gray-700">Full name</label>
                <input id="venue-admin-full-name" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" autoComplete="name" maxLength={200} required />
              </div>
              <div>
                <label htmlFor="venue-admin-email" className="mb-1 block text-xs font-semibold text-gray-700">Invited email address</label>
                <input id="venue-admin-email" type="email" value={form.email} readOnly className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2.5 text-sm" autoComplete="email" />
                <p className="mt-1 text-[11px] text-gray-500">This address is fixed to the invitation for {invite.organizationName}.</p>
              </div>
              <InvitePasswordFields
                idPrefix="venue-admin"
                password={form.password}
                confirmPassword={form.confirmPassword}
                onPasswordChange={(password) => setForm((current) => ({ ...current, password }))}
                onConfirmPasswordChange={(confirmPassword) => setForm((current) => ({ ...current, confirmPassword }))}
                disabled={state === 'saving'}
              />
              <button type="submit" disabled={claimDisabled} className="w-full rounded-lg px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60" style={{ backgroundColor: chrome.primary, color: chrome.headerText }}>
                {state === 'saving' ? 'Claiming venue…' : 'Claim Venue Workspace'}
              </button>
            </form>
          )}

          {message && (
            <div
              className={`mt-4 rounded-xl border p-3 text-sm ${state === 'error' ? 'border-red-200 bg-red-50 text-red-700' : state === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-gray-50 text-gray-700'}`}
              role={state === 'error' ? 'alert' : 'status'}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
