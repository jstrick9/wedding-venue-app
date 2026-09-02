export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordRequirementState {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  specialCharacter: boolean;
  withinMaxLength: boolean;
}

/**
 * One shared password policy for every invitation-claim surface.
 * Whitespace does not count as a special character.
 */
export function passwordRequirementState(password: string): PasswordRequirementState {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    specialCharacter: /[^A-Za-z0-9\s]/.test(password),
    withinMaxLength: password.length <= PASSWORD_MAX_LENGTH,
  };
}

export function isStrongPassword(password: string): boolean {
  const checks = passwordRequirementState(password);
  return Object.values(checks).every(Boolean);
}

export function describePasswordPolicyError(password: string): string | null {
  const checks = passwordRequirementState(password);
  if (!checks.withinMaxLength) {
    return `Password must be no more than ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (!checks.minLength || !checks.uppercase || !checks.lowercase || !checks.number || !checks.specialCharacter) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include an uppercase letter, lowercase letter, number, and special character.`;
  }
  return null;
}
