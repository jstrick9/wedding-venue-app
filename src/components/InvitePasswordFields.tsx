import { useId, useState } from 'react';
import {
  PASSWORD_MAX_LENGTH,
  passwordRequirementState,
} from '../utils/passwordPolicy';

interface InvitePasswordFieldsProps {
  password: string;
  confirmPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  idPrefix?: string;
  passwordLabel?: string;
  confirmPasswordLabel?: string;
  disabled?: boolean;
  showConfirmation?: boolean;
}

const requirementLabels = [
  ['minLength', 'At least 8 characters'],
  ['uppercase', 'One uppercase letter'],
  ['lowercase', 'One lowercase letter'],
  ['number', 'One number'],
  ['specialCharacter', 'One special character'],
] as const;

export function InvitePasswordFields({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  idPrefix,
  passwordLabel = 'New password',
  confirmPasswordLabel = 'Confirm new password',
  disabled = false,
  showConfirmation = true,
}: InvitePasswordFieldsProps) {
  const generatedId = useId().replace(/:/g, '');
  const prefix = idPrefix || `invite-password-${generatedId}`;
  const passwordId = `${prefix}-password`;
  const confirmId = `${prefix}-confirm-password`;
  const requirementsId = `${prefix}-requirements`;
  const matchId = `${prefix}-match`;
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmationPassword, setShowConfirmationPassword] = useState(false);
  const checks = passwordRequirementState(password);
  const hasPassword = password.length > 0;
  const hasConfirmation = confirmPassword.length > 0;
  const passwordsMatch = hasConfirmation && password === confirmPassword;

  return (
    <>
      <div>
        <label htmlFor={passwordId} className="mb-1 block text-xs font-semibold text-gray-700">
          {passwordLabel}
        </label>
        <div className="relative">
          <input
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-16 text-sm"
            autoComplete={showConfirmation ? 'new-password' : 'current-password'}
            aria-describedby={showConfirmation ? requirementsId : undefined}
            aria-invalid={showConfirmation && hasPassword && !Object.values(checks).every(Boolean)}
            maxLength={PASSWORD_MAX_LENGTH}
            disabled={disabled}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? `Hide ${passwordLabel.toLowerCase()}` : `Show ${passwordLabel.toLowerCase()}`}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-gray-500 hover:text-gray-800 disabled:opacity-50"
            disabled={disabled}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {showConfirmation && (
        <div
          id={requirementsId}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
        >
          <p className="text-xs font-semibold text-gray-700">Password must include:</p>
          <ul className="mt-1.5 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2" aria-label="Password requirements">
            {requirementLabels.map(([key, label]) => {
              const met = checks[key];
              return (
                <li
                  key={key}
                  className={hasPassword ? (met ? 'text-emerald-700' : 'text-red-600') : 'text-gray-500'}
                >
                  <span aria-hidden="true">{hasPassword ? (met ? '✓' : '○') : '○'}</span>{' '}
                  {label}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {showConfirmation && (
        <div>
          <label htmlFor={confirmId} className="mb-1 block text-xs font-semibold text-gray-700">
            {confirmPasswordLabel}
          </label>
          <div className="relative">
            <input
              id={confirmId}
              type={showConfirmationPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => onConfirmPasswordChange(event.target.value)}
              className={`w-full rounded-lg border px-3 py-2.5 pr-16 text-sm ${
                hasConfirmation
                  ? passwordsMatch
                    ? 'border-emerald-500'
                    : 'border-red-400'
                  : 'border-gray-300'
              }`}
              autoComplete="new-password"
              aria-describedby={hasConfirmation ? matchId : undefined}
              aria-invalid={hasConfirmation && !passwordsMatch}
              maxLength={PASSWORD_MAX_LENGTH}
              disabled={disabled}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmationPassword((current) => !current)}
              aria-label={showConfirmationPassword ? 'Hide confirmed password' : 'Show confirmed password'}
              aria-pressed={showConfirmationPassword}
              className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-gray-500 hover:text-gray-800 disabled:opacity-50"
              disabled={disabled}
            >
              {showConfirmationPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {hasConfirmation && (
            <p
              id={matchId}
              className={`mt-1 text-xs font-semibold ${passwordsMatch ? 'text-emerald-700' : 'text-red-600'}`}
              role="status"
              aria-live="polite"
            >
              {passwordsMatch ? 'Passwords match.' : 'Passwords do not match.'}
            </p>
          )}
        </div>
      )}
    </>
  );
}
