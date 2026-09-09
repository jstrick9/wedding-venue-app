import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const uploadImageMock = vi.hoisted(() => vi.fn());

vi.mock('../services/platform', async (importActual) => {
  const actual = await importActual<typeof import('../services/platform')>();
  return { ...actual, getPlatformProvider: () => 'supabase' };
});

vi.mock('../services/storage/imageStorage', async (importActual) => {
  const actual = await importActual<typeof import('../services/storage/imageStorage')>();
  return { ...actual, uploadImage: uploadImageMock };
});

import { VenueMapDesigner } from './VenueMapDesigner';
import { emptyVenueMapConfig } from '../services/wayfinding/venueWayfindingService';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const MANAGED_REF = `sp://venue-map-images/${ORG_ID}/1700000000000-property.png`;

describe('VenueMapDesigner managed cloud base images', () => {
  beforeEach(() => {
    uploadImageMock.mockReset();
  });

  it('keeps a legacy image recoverable for admins but hides it in portal preview and blocks republishing', async () => {
    const onSave = vi.fn();
    const map = {
      ...emptyVenueMapConfig(),
      backgroundImageUrl: 'https://legacy.example.test/property.png',
      backgroundOpacity: 0.8,
    };
    const { container } = render(
      <VenueMapDesigner
        map={map}
        venues={[]}
        organizationId={ORG_ID}
        onSave={onSave}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/Private-map upload required/i);
    expect(container.querySelector('image')).toHaveAttribute('href', map.backgroundImageUrl);
    expect(screen.queryByLabelText('Base map image URL')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save & publish Venue Map/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Preview audiences/i }));
    expect(container.querySelector('image')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Back to editing/i }));

    fireEvent.click(screen.getByRole('button', { name: /Remove/i }));
    const save = screen.getByRole('button', { name: /Save & publish Venue Map/i });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ backgroundImageUrl: undefined }),
      undefined,
    ));
    await waitFor(() => expect(screen.getByRole('button', { name: /Save & publish Venue Map/i })).toBeEnabled());
  });

  it('publishes an upload only when storage returns this venue’s managed map reference', async () => {
    uploadImageMock.mockResolvedValue(MANAGED_REF);
    const onSave = vi.fn();
    render(
      <VenueMapDesigner
        map={emptyVenueMapConfig()}
        venues={[]}
        organizationId={ORG_ID}
        onSave={onSave}
      />,
    );

    const file = new File([new Uint8Array([137, 80, 78, 71])], 'property.png', {
      type: 'image/png',
    });
    fireEvent.change(screen.getByLabelText('Upload base map image file'), {
      target: { files: [file] },
    });

    await waitFor(() => expect(uploadImageMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Uploading…')).not.toBeInTheDocument());
    const save = screen.getByRole('button', { name: /Save & publish Venue Map/i });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ backgroundImageUrl: MANAGED_REF }),
      undefined,
    ));
  });
});
