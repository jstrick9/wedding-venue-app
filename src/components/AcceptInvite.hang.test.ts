import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('AcceptInvite hang guards', () => {
  it('times out acceptInvite and surfaces the error instead of staying on Accepting invite', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/AcceptInvite.tsx'), 'utf8');
    expect(source).toContain('Accepting this invite timed out');
    expect(source).toContain('acceptInvite');
    expect(source).toContain('withTimeout');
    expect(source).toContain('20000');
    expect(source).toContain('catch');
    expect(source).toContain("setState('error')");
  });
});
