import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('PlatformLoginScreen hang guards', () => {
  it('times out public platform branding without blocking Sign In', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/PlatformLoginScreen.tsx'), 'utf8');
    expect(source).toContain('Loading platform branding timed out');
    expect(source).toContain('getPublicPlatformBranding');
    expect(source).toContain('withTimeout');
    expect(source).toContain('20000');
    expect(source).toContain('catch');
    expect(source).toContain('cancelled');
    expect(source.indexOf('return <LoginScreen')).toBeGreaterThan(source.indexOf('useEffect'));
  });
});
