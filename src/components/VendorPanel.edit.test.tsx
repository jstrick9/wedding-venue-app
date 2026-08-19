import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VendorPanel } from './VendorPanel';
import { STORAGE_KEYS } from '../constants/storageKeys';

function seedVendor() {
  localStorage.setItem(
    STORAGE_KEYS.VENDORS,
    JSON.stringify([
      {
        id: 'vendor-1',
        name: 'Elegant Flowers',
        category: 'florist',
        contactName: 'Jane',
        email: 'jane@florist.com',
        phone: '704-555-0100',
        website: '',
        notes: 'Loves peonies',
        rating: 0,
        isPreferred: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]),
  );
}

function storedVendors(): any[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.VENDORS) || '[]');
}

describe('VendorPanel edit flow', () => {
  beforeEach(() => {
    localStorage.clear();
    seedVendor();
  });

  it('renders the Edit button and lets a user update a vendor', () => {
    render(<VendorPanel onClose={() => {}} />);

    const editButton = screen.getByText('Edit');
    expect(editButton).toBeTruthy();

    fireEvent.click(editButton);

    // Name field is pre-filled with the current vendor name.
    const nameInput = screen.getByDisplayValue('Elegant Flowers');
    fireEvent.change(nameInput, { target: { value: 'Elegant Blooms Co.' } });

    fireEvent.click(screen.getByText('💾 Save changes'));

    expect(screen.queryByText('💾 Save changes')).toBeNull();
    const stored = storedVendors();
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Elegant Blooms Co.');
    expect(stored[0].contactName).toBe('Jane'); // untouched fields preserved
  });

  it('cancels an edit without saving', () => {
    render(<VendorPanel onClose={() => {}} />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(storedVendors()[0].name).toBe('Elegant Flowers');
  });

  it('removes a vendor via the confirm dialog', () => {
    render(<VendorPanel onClose={() => {}} />);
    fireEvent.click(screen.getByText('Remove'));

    expect(screen.getByText('Remove vendor?')).toBeTruthy();
    fireEvent.click(screen.getByText('Cancel'));
    expect(storedVendors()).toHaveLength(1);

    fireEvent.click(screen.getByText('Remove'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
    expect(storedVendors()).toHaveLength(0);
  });
});
