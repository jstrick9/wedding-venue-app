import { useEffect, useRef, useState, type FormEvent } from 'react';
import { completeSupabasePasswordRecovery } from '../services/backend/AuthBackend';
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
  readRecoveryTokensFromHash,
  stripRecoveryParamsFromUrl,
  type PasswordResetSurface,
} from '../utils/passwordResetRoute';

interface PasswordRecoveryScreenProps {
  surface: PasswordResetSurface;
}

export default function PasswordRecoveryScreen({ surface }: PasswordRecoveryScreenProps) {
  const branding = surface === 'venue' ? NEUTRAL_LOGIN_CONFIG : DEFAULT_PLATFORM_LOGIN_CONFIG;
  const chrome = resolveLoginChrome(branding);
  const payloadRef = useRef<{ code?: string; accessToken?: string; refreshToken?: string }>({});
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [hasRecoveryProof, setHasRecoveryProof] = useState(false);

  useEffect(() => {
    applyLoginBranding(branding);
    const code = readRecoveryCode(window.location.search);
    const tokens = readRecoveryTokensFromHash(window.location.hash);
    payloadRef.current = { code, ...tokens };
    stripRecoveryParamsFromUrl(window.location);
    const ok = Boolean(code || (tokens?.accessToken && tokens?.refreshToken));
    setHasRecoveryProof(ok);
    if (!ok) {
      setState('error');
      setMessage('This reset link is missing or incomplete. Request a new password reset and open the newest email in this same browser.');
    }
  }, [branding]);

  const leave = () => {
    const hash = surface === 'venue' ? '#/home' : '#/platform-login';
    window.location.replace(`${window.location.origin}/${hash}`);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isSupabaseConfigured()) {
      setState('error');
      setMessage('Supabase is not configured in this deployment.');
      return;
    }
    if (password.length < 8) {
      setState('error');
      setMessage('Password must be at least 8 characters.');
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
      await completeSupabasePasswordRecovery({
        surface,
        password,
        code: payloadRef.current.code,
        accessToken: payloadRef.current.accessToken,
        refreshToken: payloadRef.current.refreshToken,
      });
      setState('success');
      setMessage('Password updated. Opening sign-in…');
      window.setTimeout(leave, 600);
    } catch (error) {
      setState('error');
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not update the password. Request a new reset and open the newest email in this same browser.',
      );
    }
  };

  return (
    <div className="min-h-screen px-4 py-8" style={{ ...loginBackgroundStyle(branding), fontFamily: chrome.fontFamily, color: chrome.bodyText }}>
      <div className="mx-auto flex min-h-[80vh] max-w-lg items-center justify-center">
        <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="text-center">
            <div className="text-4xl">🔐</div>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
              {surface === 'venue' ? 'Venue password reset' : 'Platform password reset'}
            </p>
            <h1 className="mt-1 text-2xl font-bold" style={{ color: chrome.primary, fontFamily: chrome.headingFontFamily }}>
              Set a new password
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Open this page from the newest reset email in the same browser where you requested the reset.
            </p>
          </div>

          {hasRecoveryProof && <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-3">
            <div>
              <label htmlFor="recovery-password" className="mb-1 block text-xs font-semibold text-gray-700">New password</label>
              <input
                id="recovery-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="recovery-confirm-password" className="mb-1 block text-xs font-semibold text-gray-700">Confirm new password</label>
              <input
                id="recovery-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={state === 'saving'}
              className="w-full rounded-lg px-4 py-3 text-sm font-bold disabled:opacity-60"
              style={{ backgroundColor: chrome.primary, color: chrome.headerText }}
            >
              {state === 'saving' ? 'Saving password…' : 'Save new password'}
            </button>
          </form>}

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
