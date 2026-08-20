import { describe, expect, it } from 'vitest';
import { describeUnknownError } from './unknownError';

describe('describeUnknownError', () => {
  it('uses Error.message and Postgrest-style message objects', () => {
    expect(describeUnknownError(new Error('Nope'), 'fallback')).toBe('Nope');
    expect(describeUnknownError({ message: 'Could not find the table' }, 'fallback')).toBe('Could not find the table');
  });

  it('explains a missing chat table and an empty uuid', () => {
    expect(describeUnknownError({ code: '42P01', message: 'relation "platform_venue_messages" does not exist' }, 'fallback')).toMatch(/migrations 0009/i);
    expect(describeUnknownError({ message: 'invalid input syntax for type uuid: ""' }, 'fallback')).toMatch(/select a venue/i);
  });
});
