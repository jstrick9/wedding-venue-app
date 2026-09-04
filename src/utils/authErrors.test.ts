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

  it('does not render unknown infrastructure details', () => {
    expect(describeSignInError(new Error('Supabase gateway unavailable')))
      .toBe('We could not sign you in right now. Please try again.');
    expect(describeRecoveryError(new Error('Postgres function lookup failed')))
      .toBe('We could not save your new password right now. Please try again.');
    expect(describeRegistrationError(new Error('Vercel deployment configuration missing')))
      .toBe('Your account could not be created right now. Please try again or contact an administrator.');
  });
});
