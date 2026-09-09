import { describe, expect, it, vi } from 'vitest';
import type { VenueMapConfig } from '../../types';
import { coordinateVenueMapSave } from './venueMapSaveCoordinator';

const map: VenueMapConfig = {
  width: 1000,
  height: 700,
  points: [],
  rainContingencies: [],
  routes: [],
  drawings: [],
  updatedAt: '2026-09-06T12:00:00.000Z',
};

function harness() {
  const events: string[] = [];
  const saveToCanonicalCache = vi.fn((_map: VenueMapConfig, emitChange: boolean) => {
    events.push(`cache:${emitChange}`);
  });
  const onConflict = vi.fn(() => events.push('conflict'));
  return { events, saveToCanonicalCache, onConflict };
}

describe('coordinateVenueMapSave cache ordering', () => {
  it('persists a local-only save immediately without calling the cloud', async () => {
    const state = harness();
    const saveToCloud = vi.fn(async () => {
      state.events.push('cloud');
      return { status: 'saved' as const, updatedAt: 'server-v2' };
    });

    const result = await coordinateVenueMapSave({
      cloudEnabled: false,
      map,
      expectedUpdatedAt: undefined,
      saveToCloud,
      saveToCanonicalCache: state.saveToCanonicalCache,
      onConflict: state.onConflict,
    });

    expect(result).toEqual({ status: 'saved' });
    expect(state.events).toEqual(['cache:true']);
    expect(saveToCloud).not.toHaveBeenCalled();
  });

  it('promotes a cloud draft to canonical cache only after CAS succeeds', async () => {
    const state = harness();
    const saveToCloud = vi.fn(async () => {
      state.events.push('cloud:start');
      await Promise.resolve();
      state.events.push('cloud:saved');
      return { status: 'saved' as const, updatedAt: 'server-v2' };
    });

    const result = await coordinateVenueMapSave({
      cloudEnabled: true,
      map,
      expectedUpdatedAt: 'server-v1',
      saveToCloud,
      saveToCanonicalCache: state.saveToCanonicalCache,
      onConflict: state.onConflict,
    });

    expect(result).toEqual({ status: 'saved', updatedAt: 'server-v2' });
    expect(state.events).toEqual(['cloud:start', 'cloud:saved', 'cache:false']);
  });

  it.each([
    {
      name: 'conflict',
      outcome: {
        status: 'conflict' as const,
        currentPayload: { version: 1 },
        currentUpdatedAt: 'server-v2',
      },
      expectedEvents: ['cloud', 'conflict'],
    },
    {
      name: 'error',
      outcome: { status: 'error' as const, error: 'offline' },
      expectedEvents: ['cloud'],
    },
  ])('does not cache a cloud $name result', async ({ outcome, expectedEvents }) => {
    const state = harness();
    const saveToCloud = vi.fn(async () => {
      state.events.push('cloud');
      return outcome;
    });

    const result = await coordinateVenueMapSave({
      cloudEnabled: true,
      map,
      expectedUpdatedAt: 'server-v1',
      saveToCloud,
      saveToCanonicalCache: state.saveToCanonicalCache,
      onConflict: state.onConflict,
    });

    expect(result.status).toBe(outcome.status);
    expect(state.events).toEqual(expectedEvents);
    expect(state.saveToCanonicalCache).not.toHaveBeenCalled();
  });

  it('does not turn an accepted server save into a stale retry when cache storage fails', async () => {
    const saveToCloud = vi.fn(async () => ({
      status: 'saved' as const,
      updatedAt: 'server-v2',
    }));
    const saveToCanonicalCache = vi.fn(() => {
      throw new Error('quota exceeded');
    });

    const result = await coordinateVenueMapSave({
      cloudEnabled: true,
      map,
      expectedUpdatedAt: 'server-v1',
      saveToCloud,
      saveToCanonicalCache,
      onConflict: vi.fn(),
    });

    expect(result).toEqual({ status: 'saved', updatedAt: 'server-v2' });
    expect(saveToCloud).toHaveBeenCalledTimes(1);
    expect(saveToCanonicalCache).toHaveBeenCalledTimes(1);
  });
});
