import { describe, expect, it } from 'vitest';
import { createOpaqueToken } from './secureTokens';

describe('secure portal tokens', () => {
  it('creates URL-safe high-entropy tokens with the requested prefix', () => {
    const first = createOpaqueToken('guest');
    const second = createOpaqueToken('guest');

    expect(first).toMatch(/^guest-[0-9a-f]{48}$/);
    expect(second).toMatch(/^guest-[0-9a-f]{48}$/);
    expect(second).not.toBe(first);
  });

  it('normalizes unsafe prefixes without changing the token body format', () => {
    expect(createOpaqueToken('couple portal')).toMatch(/^coupleportal-[0-9a-f]{48}$/);
  });
});
