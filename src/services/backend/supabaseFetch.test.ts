import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeadlineFetch } from './supabaseClient';

/**
 * Review #245 P1-A: every Supabase request made by the browser clients goes
 * through a fetch wrapper with a hard abort deadline. These tests pin the
 * wrapper's contract: normal calls pass through untouched, stalled calls abort
 * at the deadline, and an explicit caller signal keeps working.
 */

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

/**
 * A fetch mock that behaves like the real one for our purposes: it never
 * settles on its own, but rejects with an AbortError when its signal aborts.
 */
function installStalledFetch() {
  const fetchMock = vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        const signal = init?.signal;
        if (!signal) return; // never settles
        if (signal.aborted) {
          const error = new Error('This operation was aborted');
          error.name = 'AbortError';
          reject(error);
          return;
        }
        signal.addEventListener('abort', () => {
          const error = new Error('This operation was aborted');
          error.name = 'AbortError';
          reject(error);
        });
      }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('createDeadlineFetch', () => {
  it('passes a fast request through untouched', async () => {
    const body = JSON.stringify({ ok: true });
    const fetchMock = vi.fn(
      async () => new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const deadlineFetch = createDeadlineFetch(1000);
    const response = await deadlineFetch('https://example.supabase.co/rest/v1/org_data', {
      method: 'GET',
      headers: { apikey: 'anon-key' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [input, init] = fetchMock.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit | undefined];
    expect(String(input)).toBe('https://example.supabase.co/rest/v1/org_data');
    expect(init?.method).toBe('GET');
    expect((init?.headers as Record<string, string>)?.apikey).toBe('anon-key');
  });

  it('aborts a stalled request at the deadline instead of hanging forever', async () => {
    const fetchMock = installStalledFetch();

    const deadlineFetch = createDeadlineFetch(20);
    await expect(
      deadlineFetch('https://example.supabase.co/rest/v1/org_data'),
    ).rejects.toThrow();

    // The wrapper handed the underlying fetch an abort signal.
    const init = fetchMock.mock.calls[0]?.[1] as unknown as RequestInit | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('respects a caller-supplied abort signal even before the deadline', async () => {
    const fetchMock = installStalledFetch();
    const controller = new AbortController();

    const deadlineFetch = createDeadlineFetch(60_000);
    const pending = deadlineFetch('https://example.supabase.co/rest/v1/org_data', {
      signal: controller.signal,
    });
    controller.abort();

    await expect(pending).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects immediately when the caller signal is already aborted', async () => {
    const fetchMock = installStalledFetch();
    const controller = new AbortController();
    controller.abort();

    const deadlineFetch = createDeadlineFetch(60_000);
    await expect(
      deadlineFetch('https://example.supabase.co/rest/v1/org_data', {
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
