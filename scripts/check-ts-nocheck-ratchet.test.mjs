import { describe, expect, it } from 'vitest';
import { MAX_TS_NOCHECK_FILES, evaluateRatchet } from './check-ts-nocheck-ratchet.mjs';

describe('@ts-nocheck ratchet (Review #247 P2-I)', () => {
  it('passes when the count is at or below the ceiling', () => {
    expect(evaluateRatchet([]).ok).toBe(true);
    expect(evaluateRatchet(['a.tsx']).ok).toBe(true);
    const atCeiling = evaluateRatchet(Array.from({ length: MAX_TS_NOCHECK_FILES }, (_, i) => `f${i}.tsx`));
    expect(atCeiling.ok).toBe(true);
    expect(atCeiling.count).toBe(MAX_TS_NOCHECK_FILES);
  });

  it('fails and explains when the count exceeds the ceiling', () => {
    const over = evaluateRatchet(
      Array.from({ length: MAX_TS_NOCHECK_FILES + 1 }, (_, i) => `f${i}.tsx`),
    );
    expect(over.ok).toBe(false);
    expect(over.failures[0]).toContain(`${MAX_TS_NOCHECK_FILES + 1} runtime files`);
    expect(over.failures[0]).toContain(`ceiling: ${MAX_TS_NOCHECK_FILES}`);
  });

  it('allows the ceiling to tighten as files are retyped', () => {
    expect(evaluateRatchet(['a.tsx', 'b.tsx', 'c.tsx'], 2).ok).toBe(false);
    expect(evaluateRatchet(['a.tsx', 'b.tsx'], 2).ok).toBe(true);
  });

  it('the shipped ceiling matches the Review #247 baseline', () => {
    expect(MAX_TS_NOCHECK_FILES).toBe(24);
  });
});
