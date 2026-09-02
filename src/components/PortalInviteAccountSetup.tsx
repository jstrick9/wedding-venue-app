import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Config } from '../types';
import {
  claimOrSignInPortalInvite,
  lookupPortalInviteContext,
  type PortalAccountMode,
  type PortalInviteContext,
  type PortalInviteKind,
} from '../services/portal/portalInviteAccount';
import { isStrongPassword } from '../utils/passwordPolicy';
import { resolveLoginChrome } from '../utils/loginBranding';
import { InvitePasswordFields } from './InvitePasswordFields';

interface PortalInviteAccountSetupProps {
  kind: PortalInviteKind;
  token: string;
  coupleId?: string;
  venueSlug?: string;
  branding: Config;
  onAuthenticated: (context: PortalInviteContext) => void;
  onLegacyInvite: () => void;
  onExit: () => void;
}

function inviteErrorMessage(error: string, kind: PortalInviteKind): string {
  if (error === 'expired') return 'This invitation has expired. Ask for a new link.';
  if (error === 'venue_unavailable') return 'This venue portal is not currently available.';
  if (error === 'invalid_token' || error === 'not_found') {
    return `This ${kind} invitation is invalid, revoked, or has been replaced by a newer link.`;
  }
  if (error === 'email_required') {
    return 'This invitation needs an email address before a personal account can be created. Ask the sender to add your email and reissue the link.';
  }
  return error || 'This invitation could not be opened.';
}

export function PortalInviteAccountSetup({
  kind,
  token,
  coupleId,
  venueSlug,
  branding,
  onAuthenticated,
  onLegacyInvite,
  onExit,
}: PortalInviteAccountSetupProps) {
  const chrome = resolveLoginChrome(branding);
  const [context, setContext] = useState<PortalInviteContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<PortalAccountMode>('create');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const completionRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    completionRef.current = false;
    setLoading(true);
    setError('');
    void lookupPortalInviteContext({ kind, token, coupleId, venueSlug })
      .then((result) => {
        if (cancelled) return;
        if (!result.available || (result.context && !result.context.accountRequired)) {
          completionRef.current = true;
          onLegacyInvite();
          return;
        }
        if (!result.context) {
          setError(inviteErrorMessage(result.error || 'not_found', kind));
          setLoading(false);
          return;
        }
        setContext(result.context);
        setFullName(result.context.fullName);
        setMode(result.context.accountClaimed ? 'sign-in' : 'create');
        setLoading(false);
        if (result.context.authenticated && !completionRef.current) {
          completionRef.current = true;
          onAuthenticated(result.context);
        }
      })
      .catch((lookupError: unknown) => {
        if (cancelled) return;
        setError(lookupError instanceof Error ? lookupError.message : 'This invitation could not be opened.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [coupleId, kind, onAuthenticated, onLegacyInvite, token, venueSlug]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!context || saving) return;
    if (mode === 'create' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const authenticated = await claimOrSignInPortalInvite({
        kind,
        mode,
        token,
        coupleId: context.coupleId || coupleId,
        venueSlug,
        email: context.email,
        password,
        fullName,
      });
      if (!completionRef.current) {
        completionRef.current = true;
        onAuthenticated(authenticated);
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Could not set up this account.';
      if (/existing Wedding VIP password|did not sign in/i.test(message)) setMode('sign-in');
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const isCreate = mode === 'create';
  const submitDisabled =
    saving
    || !context
    || !fullName.trim()
    || !password
    || (isCreate && (!isStrongPassword(password) || password !== confirmPassword));
  const inviteeLabel = kind === 'guest' ? 'Wedding guest account' : 'Couples portal account';

  return (
    <div
      className="min-h-screen px-4 py-8"
      style={{ backgroundColor: chrome.background, color: chrome.bodyText, fontFamily: chrome.fontFamily }}
    >
      <div className="mx-auto flex min-h-[80vh] max-w-lg items-center justify-center">
        <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="text-center">
            <div className="text-4xl">{kind === 'guest' ? '🌸' : '💍'}</div>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">{inviteeLabel}</p>
            <h1 className="mt-1 text-2xl font-bold" style={{ color: chrome.primary, fontFamily: chrome.headingFontFamily }}>
              {loading
                ? 'Checking invitation…'
                : context
                  ? isCreate
                    ? `Create your account for ${context.coupleName}`
                    : `Sign in for ${context.coupleName}`
                  : 'Invitation issue'}
            </h1>
            {context && (
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {isCreate
                  ? `Create a personal password to access ${kind === 'guest' ? 'your invitation and RSVP' : 'this wedding planning workspace'}.`
                  : 'This invitation is already connected to an account. Enter your existing Wedding VIP password.'}
              </p>
            )}
          </div>

          {loading ? (
            <p className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">Checking invitation…</p>
          ) : context ? (
            <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-3">
              <div>
                <label htmlFor={`${kind}-invite-full-name`} className="mb-1 block text-xs font-semibold text-gray-700">Full name</label>
                <input
                  id={`${kind}-invite-full-name`}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                  autoComplete="name"
                  maxLength={200}
                  disabled={saving}
                  required
                />
              </div>
              <div>
                <label htmlFor={`${kind}-invite-email`} className="mb-1 block text-xs font-semibold text-gray-700">Invited email address</label>
                <input
                  id={`${kind}-invite-email`}
                  type="email"
                  value={context.email}
                  readOnly
                  className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2.5 text-sm"
                  autoComplete="email"
                />
                <p className="mt-1 text-[11px] text-gray-500">This address is fixed to this personal invitation.</p>
              </div>

              <InvitePasswordFields
                idPrefix={`${kind}-invite-account`}
                password={password}
                confirmPassword={confirmPassword}
                onPasswordChange={setPassword}
                onConfirmPasswordChange={setConfirmPassword}
                passwordLabel={isCreate ? 'New password' : 'Password'}
                disabled={saving}
                showConfirmation={isCreate}
              />

              {error && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitDisabled}
                className="w-full rounded-lg px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: chrome.primary, color: chrome.headerText }}
              >
                {saving
                  ? isCreate ? 'Creating account…' : 'Signing in…'
                  : isCreate ? 'Create Account & Continue' : 'Sign In & Continue'}
              </button>

              {!context.accountClaimed && (
                <button
                  type="button"
                  onClick={() => {
                    setMode((current) => current === 'create' ? 'sign-in' : 'create');
                    setPassword('');
                    setConfirmPassword('');
                    setError('');
                  }}
                  className="w-full text-center text-xs font-semibold hover:underline"
                  style={{ color: chrome.primary }}
                >
                  {isCreate ? 'Already have a Wedding VIP account? Sign in' : 'Need a new account? Create one'}
                </button>
              )}
            </form>
          ) : (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={onExit}
            className="mt-4 w-full text-center text-xs text-gray-500 hover:text-gray-800 hover:underline"
          >
            ← Return to main sign-in
          </button>
        </div>
      </div>
    </div>
  );
}
