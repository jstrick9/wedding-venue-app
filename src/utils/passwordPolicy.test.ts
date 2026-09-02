import { describe, expect, it } from 'vitest';
import {
  describePasswordPolicyError,
  isStrongPassword,
  passwordRequirementState,
} from './passwordPolicy';

describe('invitation password policy', () => {
  it('requires length, uppercase, lowercase, number, and a non-whitespace special character', () => {
    expect(isStrongPassword('Valid#12')).toBe(true);
    expect(isStrongPassword('short#1A')).toBe(true);
    expect(isStrongPassword('lowercase#1')).toBe(false);
    expect(isStrongPassword('UPPERCASE#1')).toBe(false);
    expect(isStrongPassword('NoNumber#')).toBe(false);
    expect(isStrongPassword('NoSpecial1')).toBe(false);
    expect(isStrongPassword('Space Only1 ')).toBe(false);
  });

  it('reports each live requirement independently', () => {
    expect(passwordRequirementState('Ab1!')).toEqual({
      minLength: false,
      uppercase: true,
      lowercase: true,
      number: true,
      specialCharacter: true,
      withinMaxLength: true,
    });
  });

  it('returns one stable user-facing policy error', () => {
    expect(describePasswordPolicyError('password')).toMatch(/uppercase letter, lowercase letter, number, and special character/i);
    expect(describePasswordPolicyError('Valid#12')).toBeNull();
  });
});
