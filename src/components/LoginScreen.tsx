import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getConfig } from '../config';
import { STORAGE_KEYS } from '../constants/storageKeys';
import PasswordReset from './PasswordReset';
import Logo from './Logo';

export interface LoginScreenProps {
  onContinueAsGuest?: () => void;
}

export function LoginScreen({ onContinueAsGuest }: LoginScreenProps) {
  const { login, continueAsGuest } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  const usernameInputRef = useRef<HTMLInputElement>(null);
  const config = getConfig();

  useEffect(() => {
    const timer = setTimeout(() => {
      usernameInputRef.current?.focus();
    }, 50);

    const savedUsername = localStorage.getItem(STORAGE_KEYS.REMEMBERED_USER);
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (lockoutTime <= 0) return;

    const timer = window.setInterval(() => {
      setLockoutTime((prev) => {
        if (prev <= 1) {
          setIsLocked(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [lockoutTime]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLocked) {
      return;
    }

    setError('');
    setIsLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 250));

    const success = await login(username, password);

    if (success) {
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEYS.REMEMBERED_USER, username);
      } else {
        localStorage.removeItem(STORAGE_KEYS.REMEMBERED_USER);
      }
      setLoginAttempts(0);
    } else {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);

      if (newAttempts >= 5) {
        setIsLocked(true);
        setLockoutTime(30);
        setError('Too many failed attempts. Please wait 30 seconds.');
      } else if (newAttempts >= 3) {
        setError(`Invalid credentials. ${5 - newAttempts} attempts remaining.`);
      } else {
        setError('Invalid username or password');
      }
    }

    setIsLoading(false);
  };

  const handleGuestAccess = () => {
    if (onContinueAsGuest) {
      onContinueAsGuest();
    } else {
      continueAsGuest();
    }
  };

  const handleOpenGuestPortal = () => {
    window.location.hash = '#/guest-portal';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f5f7] to-[#efe7ee] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-200 overflow-hidden">
        <div className="bg-[#4A1942] px-6 py-8 text-white text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <Logo url={config.logoUrl} size="lg" />
          </div>
          <h1 className="text-2xl font-semibold">
            {config.venueName || 'Seven Paths Manor'}
          </h1>
          <p className="mt-2 text-sm text-white/85">
            {config.tagline || 'Where Your Love Story Unfolds'}
          </p>
          <p className="mt-1 text-xs text-white/70">
            Wedding Layout Planner
            {config.location ? ` • ${config.location}` : ''}
          </p>
        </div>

        <div className="px-6 py-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-username"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Username
              </label>
              <input
                ref={usernameInputRef}
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter username"
                autoComplete="username"
                disabled={isLocked}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A1942]/20 focus:border-[#4A1942] disabled:bg-gray-100"
                required
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  disabled={isLocked}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A1942]/20 focus:border-[#4A1942] disabled:bg-gray-100"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 px-3 text-sm text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {capsLockOn && (
                <p className="mt-1 text-xs text-amber-700">Caps Lock is on</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Remember me
              </label>

              <button
                type="button"
                onClick={() => setShowPasswordReset(true)}
                className="text-sm text-[#4A1942] hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {isLocked && lockoutTime > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Retry in {lockoutTime}s
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || isLocked}
              className="w-full rounded-lg bg-[#4A1942] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#5b2352] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs uppercase tracking-wide text-gray-400">
              or
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGuestAccess}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Continue as Planner Guest
            </button>

            <button
              type="button"
              onClick={handleOpenGuestPortal}
              className="w-full rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              Open Wedding Guest Portal
            </button>
          </div>

          <div className="mt-3 text-xs text-gray-500 text-center space-y-1">
            <p>
              Wedding guests should use the Guest Portal for RSVP, schedule,
              lodging, and directions.
            </p>
          </div>

          <div className="mt-6 text-center text-xs text-gray-500 space-y-1">
            <p>
              © {new Date().getFullYear()} {config.venueName || 'Seven Paths Manor'}
            </p>
            {config.supportEmail && <p>{config.supportEmail}</p>}
            {config.websiteUrl && <p>{config.websiteUrl}</p>}
          </div>
        </div>
      </div>

      {showPasswordReset && (
        <PasswordReset
          onClose={() => setShowPasswordReset(false)}
          onSuccess={() => {
            setShowPasswordReset(false);
            setError('');
          }}
        />
      )}
    </div>
  );
}