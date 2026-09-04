import { describe, expect, it } from 'vitest';
import { describeUnknownError } from './unknownError';

describe('describeUnknownError', () => {
  it('preserves ordinary user-safe messages', () => {
    expect(describeUnknownError(new Error('Nope'), 'fallback')).toBe('Nope');
    expect(describeUnknownError({ message: 'Please retry this action.' }, 'fallback')).toBe('Please retry this action.');
  });

  it('hides database/deployment details and explains invalid selection', () => {
    expect(describeUnknownError(
      { code: '42P01', message: 'relation "platform_venue_messages" does not exist' },
      'Chat is temporarily unavailable.',
    )).toBe('Chat is temporarily unavailable.');
    expect(describeUnknownError({ message: 'invalid input syntax for type uuid: ""' }, 'fallback'))
      .toBe('Select a valid item and try again.');
    expect(describeUnknownError(new Error('Supabase schema cache failed'), 'fallback')).toBe('fallback');
    expect(describeUnknownError(new Error('Database configuration failed at https://private.example'), 'fallback'))
      .toBe('fallback');
    expect(describeUnknownError(new Error('null value in column "organization_id" violates not-null constraint'), 'fallback'))
      .toBe('fallback');
    expect(describeUnknownError(new Error('JWT expired: PGRST301'), 'fallback')).toBe('fallback');
    expect(describeUnknownError(new Error('localStorage quota exceeded'), 'fallback')).toBe('fallback');
    expect(describeUnknownError(new Error('Geoapify server proxy failed'), 'fallback')).toBe('fallback');
  });
});
