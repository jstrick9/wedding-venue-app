import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('AuthContext hang guards', () => {
  it('times out cloud session restore so the login screens can paint', () => {
    const source = readFileSync(join(process.cwd(), 'src/contexts/AuthContext.tsx'), 'utf8');
    const init = source.slice(
      source.indexOf('if (shouldUseSupabaseAuth()) {'),
      source.indexOf('const savedSession = loadSession()'),
    );
    expect(init).toContain('Restoring sign-in timed out.');
    expect(init).toContain('withTimeout');
    expect(init).toContain('20000');
    expect(init).toContain('migrateLegacyAuthSessions');
    expect(init).toContain("restoreSupabaseSession(undefined, 'platform')");
    expect(init).toContain("restoreSupabaseSession(undefined, 'venue')");
    expect(init).toContain('finally');
    expect(init).toContain('setInitialized(true)');
  });
});
