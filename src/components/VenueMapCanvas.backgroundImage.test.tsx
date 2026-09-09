import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VenueMapConfig } from '../types';
import { VenueMapCanvas } from './VenueMapCanvas';

const mocks = vi.hoisted(() => ({
  resolveImageRef: vi.fn(),
}));

vi.mock('../services/storage/imageStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/storage/imageStorage')>();
  return { ...actual, resolveImageRef: mocks.resolveImageRef };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const mapWithImage = (ref: string): VenueMapConfig => ({
  width: 100,
  height: 80,
  points: [{
    id: 'gate',
    label: 'Main Gate',
    kind: 'entry',
    x: 10,
    y: 10,
    lat: 35.2,
    lng: -80.8,
  }],
  routes: [],
  drawings: [],
  rainContingencies: [],
  backgroundImageUrl: ref,
  updatedAt: '2026-09-08T12:00:00.000Z',
});

describe('VenueMapCanvas base-image availability', () => {
  beforeEach(() => {
    mocks.resolveImageRef.mockReset();
  });

  it('never renders a previous signed image under a newly selected reference', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    mocks.resolveImageRef
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { container, rerender } = render(
      <VenueMapCanvas map={mapWithImage('sp://venue-map-images/org/first.png')} />,
    );

    rerender(<VenueMapCanvas map={mapWithImage('sp://venue-map-images/org/second.png')} />);
    first.resolve('https://signed.test/first.png');
    await Promise.resolve();
    expect(container.querySelector('image')).toBeNull();

    second.resolve('https://signed.test/second.png');
    await waitFor(() => expect(container.querySelector('image')).toHaveAttribute(
      'href',
      'https://signed.test/second.png',
    ));
  });

  it('fails closed after signing failure, retains named actions, and retries', async () => {
    mocks.resolveImageRef
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce('https://signed.test/recovered.png');
    const onPointClick = vi.fn();
    const { container } = render(
      <VenueMapCanvas
        map={mapWithImage('sp://venue-map-images/org/map.png')}
        hideMapWhenBackgroundUnavailable
        onPointClick={onPointClick}
      />,
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Spatial pins and walkways are hidden/i);
    expect(container.querySelector('svg')).not.toBeInTheDocument();

    const summary = screen.getByText('Map location actions').closest('summary')!;
    fireEvent.click(summary);
    const action = within(summary.closest('details')!).getByRole('button', { name: /Main Gate/i });
    fireEvent.click(action);
    expect(onPointClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'gate' }));

    fireEvent.click(screen.getByRole('button', { name: /Retry base map/i }));
    await waitFor(() => expect(container.querySelector('image')).toHaveAttribute(
      'href',
      'https://signed.test/recovered.png',
    ));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('handles SVG decode failures and lets a server-unavailable map re-pull', async () => {
    mocks.resolveImageRef.mockResolvedValue('https://signed.test/corrupt.png');
    const onRetry = vi.fn();
    const { container, rerender } = render(
      <VenueMapCanvas
        map={mapWithImage('sp://venue-map-images/org/corrupt.png')}
        hideMapWhenBackgroundUnavailable
      />,
    );
    await waitFor(() => expect(container.querySelector('image')).toBeInTheDocument());
    fireEvent.error(container.querySelector('image')!);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeInTheDocument();

    rerender(
      <VenueMapCanvas
        map={{
          ...mapWithImage('sp://venue-map-images/org/corrupt.png'),
          backgroundImageUrl: undefined,
          backgroundImageUnavailable: true,
        }}
        hideMapWhenBackgroundUnavailable
        onRetryBackgroundImage={onRetry}
      />,
    );
    expect(screen.getByText('Named map locations')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry base map/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps vectors visible to an admin for recovery when fail-closed mode is off', () => {
    const { container } = render(
      <VenueMapCanvas
        map={{
          ...mapWithImage('sp://venue-map-images/org/missing.png'),
          backgroundImageUrl: undefined,
          backgroundImageUnavailable: true,
        }}
        editable
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/venue-admin recovery/i);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
