import { describe, expect, it } from 'vitest';
import { BUDGETS, evaluateBudgets } from './check-bundle-budget.mjs';

describe('bundle budget evaluation (Review #247 P2-H)', () => {
  it('passes a single-file build inside the gzip budget', () => {
    const result = evaluateBudgets(
      [{ name: 'dist/index.html', rawBytes: 2_331_800, gzipBytes: 556_940 }],
      'single',
    );
    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.report[0]).toContain('dist/index.html');
  });

  it('fails a single-file build over the gzip budget and names the size', () => {
    const result = evaluateBudgets(
      [{ name: 'dist/index.html', rawBytes: 3_000_000, gzipBytes: BUDGETS.singleFileGzipBytes + 1 }],
      'single',
    );
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toContain('dist/index.html');
    expect(result.failures[0]).toContain('over the');
  });

  it('evaluates the split build on raw chunk size, not gzip', () => {
    const inBudget = evaluateBudgets(
      [
        { name: 'chunk-admin.js', rawBytes: 751_570, gzipBytes: 162_460 },
        { name: 'index.js', rawBytes: 225_580, gzipBytes: 69_350 },
      ],
      'split',
    );
    expect(inBudget.ok).toBe(true);

    const overBudget = evaluateBudgets(
      [{ name: 'chunk-admin.js', rawBytes: BUDGETS.maxChunkRawBytes + 1, gzipBytes: 162_460 }],
      'split',
    );
    expect(overBudget.ok).toBe(false);
    expect(overBudget.failures[0]).toContain('chunk-admin.js');
  });

  it('split mode ignores gzip size entirely (raw is the gate)', () => {
    const hugeGzipSmallRaw = evaluateBudgets(
      [{ name: 'x.js', rawBytes: 1_000, gzipBytes: BUDGETS.singleFileGzipBytes * 10 }],
      'split',
    );
    expect(hugeGzipSmallRaw.ok).toBe(true);
  });
});
