import { useEffect, useState, type FormEvent } from 'react';
import {
  abandonSupabasePasswordRecovery,
  completeSupabasePasswordRecovery,
} from '../services/backend/AuthBackend';
import { withTimeout } from '../utils/withTimeout';
import { isSupabaseConfigured } from '../services/backend/supabaseClient';
import {
  applyLoginBranding,
  DEFAULT_PLATFORM_LOGIN_CONFIG,
  loginBackgroundStyle,
  NEUTRAL_LOGIN_CONFIG,
  resolveLoginChrome,
} from '../utils/loginBranding';
import {
  readRecoveryCode,
  readRecoveryTokenHash,
  readRecoveryTokensFromHash,
  readRecoveryVenueSlug,
  passwordResetLoginHash,
  stripRecoveryParamsFromUrl,
  type PasswordResetSurface,
} from '../utils/passwordResetRoute';
import { describePasswordPolicyError } from '../utils/passwordPolicy';
import { describeRecoveryError } from '../utils/authErrors';
import { InvitePasswordFields } from './InvitePasswordFields';
import { getPublicVenueBranding } from '../services/platform/publicVenueService';
import { getActiveOrganizationSlug } from '../services/platform/organizationContext';
import type { Config } from '../types';

interface PasswordRecoveryScreenProps {
  surface: PasswordResetSurface;
}

interface RecoveryPayload {
  tokenHash?: string;
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  venueSlug?: string;
}

function captureRecoveryPayload(): RecoveryPayload {
  const tokens = readRecoveryTokensFromHash(window.location.hash);
  return {
    tokenHash: readRecoveryTokenHash(window.location.hash)
      || readRecoveryTokenHash(window.location.search),
    code: readRecoveryCode(window.location.search),
    ...tokens,
    venueSlug: readRecoveryVenueSlug(window.location.hash)
      || readRecoveryVenueSlug(window.location.search),
  };
}

function hasProof(payload: RecoveryPayload): boolean {
  return Boolean(
    payload.tokenHash
    || payload.code
    || (payload.accessToken && payload.refreshToken),
  );
}

export default function PasswordRecoveryScreen({ surface }: PasswordRecoveryScreenProps) {
  // Capture during render, before the first effect strips the secret from the
  // address bar. React Strict Mode may replay effects, but this state remains
  // stable and cannot be overwritten by the now-clean URL.
  const [payload] = useState<RecoveryPayload>(captureRecoveryPayload);
  const validInitialProof = hasProof(payload);
  const [branding, setBranding] = useState<Config>(
    surface === 'venue' ? NEUTRAL_LOGIN_CONFIG : DEFAULT_PLATFORM_LOGIN_CONFIG,
  );
  const chrome = resolveLoginChrome(branding);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'success' | 'error'>(
    validInitialProof ? 'idle' : 'error',
  );
  const [message, setMessage] = useState(
    validInitialProof
      ? ''
      : 'This reset link is missing or incomplete. Request a new password reset and open the newest email.',
  );

  useEffect(() => {
    stripRecoveryParamsFromUrl(window.location);
  }, []);

  useEffect(() => () => {
    abandonSupabasePasswordRecovery(surface);
  }, [surface]);

  useEffect(() => {
    applyLoginBranding(branding);
  }, [branding]);

  useEffect(() => {
    if (surface !== 'venue' || !payload.venueSlug) return;
    let cancelled = false;
    void getPublicVenueBranding(payload.venueSlug)
      .then((result) => {
        if (!cancelled && result) setBranding(result.config);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [payload.venueSlug, surface]);

  const leave = () => {
    abandonSupabasePasswordRecovery(surface);
    const slug = surface === 'venue'
      ? payload.venueSlug || getActiveOrganizationSlug() || undefined
      : undefined;
    window.location.replace(`${window.location.origin}/${passwordResetLoginHash(surface, slug)}`);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (state === 'saving') return;
    if (!isSupabaseConfigured()) {
      setState('error');
      setMessage('Password reset is temporarily unavailable. Please try again later or contact support.');
      return;
    }
    const passwordError = describePasswordPolicyError(password);
    if (passwordError) {
      setState('error');
      setMessage(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setState('error');
      setMessage('Passwords do not match.');
      return;
    }

    setState('saving');
    setMessage('Saving your new password…');
    try {
      await withTimeout(
        completeSupabasePasswordRecovery({
          surface,
          password,
          tokenHash: payload.tokenHash,
          code: payload.code,
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
        }),
        22000,
        'Saving the new password timed out. Request a new reset and try again.',
      );
      setState('success');
      setMessage('Password updated. Returning to sign-in…');
      window.setTimeout(leave, 600);
    } catch (error) {
      setState('error');
      setMessage(describeRecoveryError(error));
    }
  };

  return (
    <div className="min-h-screen px-4 py-8" style={{ ...loginBackgroundStyle(branding), fontFamily: chrome.fontFamily, color: chrome.bodyText }}>
      <div className="mx-auto flex min-h-[80vh] max-w-lg items-center justify-center">
        <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="text-center">
            <div className="text-4xl">🔐</div>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
              {surface === 'venue' ? `${branding.venueName || 'Venue'} password reset` : 'Platform password reset'}
            </p>
            <h1 className="mt-1 text-2xl font-bold" style={{ color: chrome.primary, fontFamily: chrome.headingFontFamily }}>
              Set a new password
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Choose a strong password for your account. After it is saved, sign in again with the new password.
            </p>
          </div>

          {validInitialProof && (
            <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-3">
              <InvitePasswordFields
                idPrefix="recovery"
                password={password}
                confirmPassword={confirmPassword}
                onPasswordChange={setPassword}
                onConfirmPasswordChange={setConfirmPassword}
                disabled={state === 'saving' || state === 'success'}
              />
              <button
                type="submit"
                disabled={state === 'saving' || state === 'success'}
                className="w-full rounded-lg px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: chrome.primary, color: chrome.headerText }}
              >
                {state === 'saving' ? 'Saving password…' : state === 'success' ? 'Password saved' : 'Save new password'}
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

          {state !== 'saving' && state !== 'success' && (
            <button
              type="button"
              onClick={leave}
              className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Return to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
