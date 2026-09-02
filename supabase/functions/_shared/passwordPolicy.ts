export const INVITE_PASSWORD_MIN_LENGTH = 8;
export const INVITE_PASSWORD_MAX_LENGTH = 128;

/** Canonical server-side policy for every first-use invitation password. */
export function invitePasswordPolicyError(password: string): string | null {
  if (password.length > INVITE_PASSWORD_MAX_LENGTH) {
    return `Password must be no more than ${INVITE_PASSWORD_MAX_LENGTH} characters.`;
  }
  if (
    password.length < INVITE_PASSWORD_MIN_LENGTH
    || !/[A-Z]/.test(password)
    || !/[a-z]/.test(password)
    || !/[0-9]/.test(password)
    || !/[^A-Za-z0-9\s]/.test(password)
  ) {
    return `Password must be at least ${INVITE_PASSWORD_MIN_LENGTH} characters and include an uppercase letter, lowercase letter, number, and special character.`;
  }
  return null;
}
