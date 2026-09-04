export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_unconfirmed'
  | 'too_many_attempts'
  | 'account_unavailable'
  | 'venue_access_denied'
  | 'venue_unavailable'
  | 'platform_access_denied'
  | 'network_unavailable'
  | 'service_unavailable'
  | 'recovery_network_unavailable'
  | 'recovery_unavailable'
  | 'invalid_recovery_link'
  | 'recovery_expired'
  | 'password_rejected';

const AUTH_MESSAGES: Record<AuthErrorCode, string> = {
  invalid_credentials: 'The email address or password is incorrect.',
  email_unconfirmed: 'Confirm your email address before signing in.',
  too_many_attempts: 'Too many attempts. Wait a few minutes and try again.',
  account_unavailable: 'This account is unavailable. Contact support for help.',
  venue_access_denied: 'This account does not have access to this venue.',
  venue_unavailable: 'This venue is currently unavailable. Contact support for help.',
  platform_access_denied: 'This account does not have platform administration access.',
  network_unavailable: 'We could not reach the sign-in service. Check your connection and try again.',
  service_unavailable: 'We could not sign you in right now. Please try again.',
  recovery_network_unavailable: 'We could not save your new password. Check your connection and try again.',
  recovery_unavailable: 'We could not save your new password right now. Please try again.',
  invalid_recovery_link: 'This reset link is invalid or has already been used. Request a new password reset.',
  recovery_expired: 'This reset link has expired. Request a new password reset.',
  password_rejected: 'That password could not be saved. Choose a different strong password and try again.',
};

/** Error whose message is safe to render directly in an authentication UI. */
export class AuthFlowError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode) {
    super(AUTH_MESSAGES[code]);
    this.name = 'AuthFlowError';
    this.code = code;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || '');
  }
  return '';
}

export function authSignInError(error: unknown): AuthFlowError {
  const message = errorMessage(error);
  if (/invalid login|invalid credential|email or password|user not found/i.test(message)) {
    return new AuthFlowError('invalid_credentials');
  }
  if (/email.*not confirmed|confirmation/i.test(message)) {
    return new AuthFlowError('email_unconfirmed');
  }
  if (/rate limit|too many|over.*limit/i.test(message)) {
    return new AuthFlowError('too_many_attempts');
  }
  if (/banned|disabled|inactive|suspended user/i.test(message)) {
    return new AuthFlowError('account_unavailable');
  }
  if (/failed to fetch|network|load failed|fetch failed|timeout|timed out/i.test(message)) {
    return new AuthFlowError('network_unavailable');
  }
  return new AuthFlowError('service_unavailable');
}

export function authRecoveryError(error: unknown): AuthFlowError {
  const message = errorMessage(error);
  if (/expired/i.test(message)) return new AuthFlowError('recovery_expired');
  if (/invalid|otp|token|already.*used|code verifier|pkce/i.test(message)) {
    return new AuthFlowError('invalid_recovery_link');
  }
  if (/password|weak|different/i.test(message)) return new AuthFlowError('password_rejected');
  if (/failed to fetch|network|load failed|fetch failed|timeout|timed out/i.test(message)) {
    return new AuthFlowError('recovery_network_unavailable');
  }
  return new AuthFlowError('recovery_unavailable');
}

export function describeSignInError(error: unknown): string {
  if (error instanceof AuthFlowError) return error.message;
  const message = errorMessage(error);
  if (/timed out/i.test(message)) return 'Sign-in timed out. Check your connection and try again.';
  return authSignInError(error).message;
}

export function describeRecoveryError(error: unknown): string {
  if (error instanceof AuthFlowError) return error.message;
  const message = errorMessage(error);
  if (/timed out/i.test(message)) {
    return 'Saving the new password timed out. Request a new reset and try again.';
  }
  return authRecoveryError(error).message;
}

export function describeRegistrationError(error: unknown, invited = false): string {
  const message = errorMessage(error);
  if (/already registered|already exists|email_exists/i.test(message)) {
    return 'An account already uses this email address. Sign in or reset its password.';
  }
  if (/password/i.test(message) && /weak|least|characters|uppercase|lowercase|number|special/i.test(message)) {
    return 'Choose a stronger password that meets all listed requirements.';
  }
  if (/invalid.*email|email.*invalid/i.test(message)) return 'Enter a valid email address.';
  if (/account.*created/i.test(message) && /confirm.*email/i.test(message)) {
    return 'Your account was created. Confirm your email using the message we sent, then sign in.';
  }
  if (/expired|invalid.*invite|not_found|already.*accepted/i.test(message)) {
    return 'This invitation is invalid, expired, or already used. Ask an administrator for a new invitation.';
  }
  if (/rate limit|too many/i.test(message)) return AUTH_MESSAGES.too_many_attempts;
  if (/timeout|timed out/i.test(message)) {
    return 'Account setup timed out. Check your connection and try again.';
  }
  if (/failed to fetch|network|load failed|fetch failed/i.test(message)) {
    return 'Account setup could not reach the service. Check your connection and try again.';
  }
  return invited
    ? 'The invited account could not be created right now. Please try again or contact an administrator.'
    : 'Your account could not be created right now. Please try again or contact an administrator.';
}
