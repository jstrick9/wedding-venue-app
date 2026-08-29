import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ForcePasswordChange hang guards', () => {
  it('times out changePassword and always clears Updating', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/ForcePasswordChange.tsx'), 'utf8');
    const submit = source.slice(source.indexOf('const handleSubmit'), source.indexOf('return ('));
    expect(submit).toContain('Updating the password timed out');
    expect(submit).toContain('withTimeout');
    expect(submit).toContain('20000');
    expect(submit).toContain('finally');
    expect(submit).toContain('setIsLoading(false)');
    expect(submit).toContain('catch');
  });
});
