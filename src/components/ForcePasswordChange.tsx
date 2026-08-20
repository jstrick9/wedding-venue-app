import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getConfig } from '../config';
import { resolveLoginChrome } from '../utils/loginBranding';
import { applyDocumentBranding } from '../utils/documentBranding';

/**
 * Forced "change your password on first login" gate.
 *
 * Shown when the signed-in user still has `requiresPasswordChange` set (e.g. the
 * shipped default administrator). The workspace is blocked until a new password
 * is set and the flag is cleared by `AuthContext.changePassword`.
 *
 * This closes the security hole where the well-known default admin credential
 * (`REPLACE_ON_FIRST_LOGIN`) could be used indefinitely without ever being
 * changed.
 */
export default function ForcePasswordChange() {
  const { user, changePassword } = useAuth();
  const config = getConfig();
  const chrome = resolveLoginChrome(config);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    applyDocumentBranding({
      name: config.venueName,
      logoUrl: config.logoUrl,
      primaryColor: config.primaryColor,
    });
  }, [config.venueName, config.logoUrl, config.primaryColor]);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setIsLoading(true);

    const ok = await changePassword(user.id, newPassword);
    if (!ok) {
      setError('Unable to update your password. Please try again.');
      setIsLoading(false);
      return;
    }
    // On success, AuthContext.user updates and clears requiresPasswordChange,
    // which unmounts this gate and reveals the workspace.
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: chrome.background, fontFamily: chrome.fontFamily }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔐</div>
          <h1
            className="text-2xl font-semibold"
            style={{ color: chrome.primary, fontFamily: chrome.headingFontFamily }}
          >
            Set a New Password
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Hi {user.name}, your {config.venueName} account is using a default
            or temporary password. You must choose a new password before
            continuing.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label htmlFor="fp-new" className="block text-sm font-medium text-gray-700 mb-1">
              New password
            </label>
            <input
              id="fp-new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
              style={{ ['--tw-ring-color' as string]: chrome.primary }}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div>
            <label htmlFor="fp-confirm" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm new password
            </label>
            <input
              id="fp-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
              style={{ ['--tw-ring-color' as string]: chrome.primary }}
              autoComplete="new-password"
              required
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg text-white font-medium disabled:opacity-60"
            style={{ backgroundColor: chrome.primary, color: chrome.headerText }}
          >
            {isLoading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
