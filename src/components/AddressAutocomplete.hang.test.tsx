import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const autocompleteMock = vi.fn();

vi.mock('../services/platform/geocodingService', () => ({
  autocompleteVenueAddress: (...args: unknown[]) => autocompleteMock(...args),
}));

import AddressAutocomplete from './AddressAutocomplete';

const emptyValue = {
  addressLine1: '',
  addressLine2: '',
  city: '',
  stateRegion: '',
  postalCode: '',
  country: 'US',
};

describe('AddressAutocomplete hang guards', () => {
  beforeEach(() => {
    autocompleteMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not stay on Looking up addresses when autocomplete never returns", async () => {
    autocompleteMock.mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers();
    render(
      <AddressAutocomplete
        value={emptyValue}
        onChange={vi.fn()}
        verified={false}
        onVerifiedChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '100 N Tryon' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.getByText('Looking up addresses…')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15100);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/timed out/i);
    expect(screen.queryByText('Looking up addresses…')).not.toBeInTheDocument();
  });

  it("clears Looking up addresses when autocomplete throws", async () => {
    autocompleteMock.mockRejectedValue(new Error('Address service unavailable'));
    vi.useFakeTimers();
    render(
      <AddressAutocomplete
        value={emptyValue}
        onChange={vi.fn()}
        verified={false}
        onVerifiedChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '100 N Tryon' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/address service unavailable/i);
    expect(screen.queryByText('Looking up addresses…')).not.toBeInTheDocument();
  });
});
