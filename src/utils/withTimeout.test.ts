import { describe, expect, it } from 'vitest';
import { withTimeout } from './withTimeout';

describe('withTimeout', () => {
  it('returns the resolved value when it finishes in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50, 'timed out')).resolves.toBe('ok');
  });

  it('rejects when the promise does not settle', async () => {
    await expect(withTimeout(new Promise(() => {}), 10, 'Save timed out.')).rejects.toThrow('Save timed out.');
  });
});
