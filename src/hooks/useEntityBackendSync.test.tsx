import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEntityBackendSync } from './useEntityBackendSync';

const syncMocks = vi.hoisted(() => ({
  canSyncEntities: vi.fn(() => true),
  pullEntities: vi.fn(),
  pushEntities: vi.fn(),
  pushEntityDomain: vi.fn(),
  saveVenueMapEntity: vi.fn(),
}));

vi.mock('../services/sync/entitySync', () => syncMocks);
vi.mock('../services/sync/entityRealtime', () => ({
  subscribeToEntityChanges: vi.fn(() => () => undefined),
}));
vi.mock('../utils/appEvents', () => ({ emit: vi.fn() }));

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function Harness({ userId, organizationId }: { userId: string; organizationId: string }) {
  const sync = useEntityBackendSync({ userId, organizationId });
  return (
    <output
      data-hydrated={String(sync.hydrated)}
      data-loading={String(sync.loading)}
      data-error={sync.loadError || ''}
    >
      sync state
    </output>
  );
}

describe('useEntityBackendSync tenant hydration gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncMocks.canSyncEntities.mockReturnValue(true);
  });

  it('ignores a superseded tenant pull that resolves after the active tenant', async () => {
    const orgA = deferred<boolean>();
    const orgB = deferred<boolean>();
    const guards = new Map<string, () => boolean>();
    syncMocks.pullEntities.mockImplementation((
      { organizationId }: { organizationId: string },
      shouldApply: () => boolean,
    ) => {
      guards.set(organizationId, shouldApply);
      return organizationId === 'org-a' ? orgA.promise : orgB.promise;
    });

    const { rerender } = render(<Harness userId="user-a" organizationId="org-a" />);
    rerender(<Harness userId="user-b" organizationId="org-b" />);
    expect(guards.get('org-a')?.()).toBe(false);
    expect(guards.get('org-b')?.()).toBe(true);

    await act(async () => orgB.resolve(true));
    await waitFor(() => expect(screen.getByText('sync state')).toHaveAttribute('data-hydrated', 'true'));

    await act(async () => orgA.resolve(true));
    expect(screen.getByText('sync state')).toHaveAttribute('data-hydrated', 'true');
    expect(screen.getByText('sync state')).toHaveAttribute('data-error', '');
  });

  it('invalidates an in-flight pull when the workspace unmounts', () => {
    let shouldApply: (() => boolean) | undefined;
    syncMocks.pullEntities.mockImplementation((
      _context: { organizationId: string },
      guard: () => boolean,
    ) => {
      shouldApply = guard;
      return new Promise(() => undefined);
    });

    const { unmount } = render(<Harness userId="user-a" organizationId="org-a" />);
    expect(shouldApply?.()).toBe(true);
    unmount();
    expect(shouldApply?.()).toBe(false);
  });

  it('closes synchronously on a context switch and stays closed when the new pull fails', async () => {
    const orgA = deferred();
    const orgB = deferred();
    syncMocks.pullEntities.mockImplementation(({ organizationId }: { organizationId: string }) =>
      organizationId === 'org-a' ? orgA.promise : orgB.promise,
    );

    const { rerender } = render(<Harness userId="user-a" organizationId="org-a" />);
    expect(screen.getByText('sync state')).toHaveAttribute('data-hydrated', 'false');
    expect(screen.getByText('sync state')).toHaveAttribute('data-loading', 'true');

    await act(async () => orgA.resolve());
    await waitFor(() => expect(screen.getByText('sync state')).toHaveAttribute('data-hydrated', 'true'));

    rerender(<Harness userId="user-b" organizationId="org-b" />);
    expect(screen.getByText('sync state')).toHaveAttribute('data-hydrated', 'false');
    expect(screen.getByText('sync state')).toHaveAttribute('data-loading', 'true');

    await act(async () => orgB.reject(new Error('offline')));
    await waitFor(() => expect(screen.getByText('sync state')).toHaveAttribute('data-error', 'offline'));
    expect(screen.getByText('sync state')).toHaveAttribute('data-hydrated', 'false');
  });
});
