import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const autocompleteMock = vi.fn();

vi.mock('../services/platform/geocodingService', () => ({
  autocompleteVenueAddress: (...args: unknown[]) => autocompleteMock(...args),
}));

import AddressAutocomplete from './AddressAutocomplete';

const verifiedSuggestion = {
  addressLine1: '100 N Tryon St',
  addressLine2: '',
  city: 'Charlotte',
  stateRegion: 'NC',
  postalCode: '28202',
  country: 'US',
  latitude: 35.227,
  longitude: -80.843,
  formatted: '100 N Tryon St, Charlotte, NC 28202, United States of America',
  placeId: 'p1',
  resultType: 'building',
  confidence: 1,
  verified: true,
};

describe('AddressAutocomplete', () => {
  beforeEach(() => {
    autocompleteMock.mockReset().mockResolvedValue([verifiedSuggestion]);
  });

  it('fills city, state, and ZIP from a selected suggestion', async () => {
    const onChange = vi.fn();
    const onVerifiedChange = vi.fn();
    render(
      <AddressAutocomplete
        value={{ addressLine1: '', addressLine2: '', city: '', stateRegion: '', postalCode: '', country: 'US' }}
        onChange={onChange}
        verified={false}
        onVerifiedChange={onVerifiedChange}
      />,
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '100 N Tryon' } });
    expect(await screen.findByRole('option', { name: /100 n tryon/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /100 n tryon/i }));
    await waitFor(() => {
      expect(onVerifiedChange).toHaveBeenCalledWith(true);
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      addressLine1: '100 N Tryon St',
      city: 'Charlotte',
      stateRegion: 'NC',
      postalCode: '28202',
    }), verifiedSuggestion);
  });
});
