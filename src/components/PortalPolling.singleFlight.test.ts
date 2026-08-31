import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #245 P1-A: the 5s portal polling loops must not stack stalled
 * requests, and the Supabase clients must carry a global fetch deadline.
 * These are the structural guards behind the #214–#244 one-off timeout fixes.
 */
describe('portal polling single-flight guards', () => {
  it('GuestPortal skips a polling tick while the previous pull is in flight', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/GuestPortal.tsx'), 'utf8');
    expect(source).toContain('let pulling = false');
    expect(source).toMatch(/if \(pulling\) return;/);
    expect(source).toMatch(/finally \{\s*\n\s*pulling = false;/);
  });

  it('CouplesPortal skips a polling tick while the previous pull is in flight', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/CouplesPortal.tsx'), 'utf8');
    expect(source).toContain('let pulling = false');
    expect(source).toMatch(/if \(pulling\) return;/);
    expect(source).toMatch(/finally \{\s*\n\s*pulling = false;/);
  });

  it('both Supabase surface clients route every request through the deadline fetch', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/services/backend/supabaseClient.ts'),
      'utf8',
    );
    expect(source).toContain('createDeadlineFetch');
    expect(source).toMatch(/global:\s*\{\s*\n\s*\/\/ Every request gets a hard abort deadline/);
    // Both the surface clients and the legacy migration client use it.
    expect(source.match(/fetch: createDeadlineFetch\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('failed cloud pushes surface to the user instead of failing silently', () => {
    const entities = readFileSync(join(process.cwd(), 'src/hooks/useEntityBackendSync.ts'), 'utf8');
    const layouts = readFileSync(join(process.cwd(), 'src/hooks/useLayoutBackendSync.ts'), 'utf8');
    const app = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
    for (const source of [entities, layouts]) {
      expect(source).toContain("emit('spm_cloud_sync_error'");
    }
    expect(app).toContain('GlobalCloudSyncErrorListener');
    expect(app).toMatch(/on\('spm_cloud_sync_error'/);
  });
});
