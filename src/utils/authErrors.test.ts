import { describe, expect, it } from 'vitest';
import {
  describeRecoveryError,
  describeRegistrationError,
  describeSignInError,
} from './authErrors';

describe('white-label authentication errors', () => {
  it('describes an email-confirmation registration outcome as successful account creation', () => {
    expect(describeRegistrationError(
      new Error('Your account was created. Confirm your email using the message we sent, then return to sign in.'),
    )).toBe('Your account was created. Confirm your email using the message we sent, then sign in.');
  });

  it('explains when the submitted password matches the current password', () => {
    const expected = 'Your new password must be different from your current password. Choose another strong password and try again.';
    expect(describeRecoveryError(new Error('New password should be different from old password')))
      .toBe(expected);
    expect(describeRecoveryError({ code: 'same_password', message: 'Rejected' }))
      .toBe(expected);
  });

  it('explains password-history rejection without exposing provider details', () => {
    expect(describeRecoveryError({
      code: 'password_history',
      message: 'Password has previously been used by the auth provider',
    })).toBe('That password was used before. Choose a password you have not used for this account and try again.');
  });

  it('does not render unknown infrastructure details', () => {
    expect(describeSignInError(new Error('Supabase gateway unavailable')))
      .toBe('We could not sign you in right now. Please try again.');
    expect(describeRecoveryError(new Error('Postgres function lookup failed')))
      .toBe('We could not save your new password right now. Please try again.');
    expect(describeRegistrationError(new Error('Vercel deployment configuration missing')))
      .toBe('Your account could not be created right now. Please try again or contact an administrator.');
  });
});
