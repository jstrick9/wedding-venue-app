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
        phone: '555-0100',
        website: '',
        notes: 'Loves peonies',
        contractAmount: 2500,
        contractSigned: false,
        depositPaid: false,
        rating: 0,
        isPreferred: false,
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

    const editButton = screen.getByText('✏️ Edit');
    expect(editButton).toBeTruthy();

    fireEvent.click(editButton);

    expect(screen.getByText('✏️ Edit Vendor')).toBeTruthy();

    // Name field is pre-filled with the current vendor name.
    const nameInput = screen.getByDisplayValue('Elegant Flowers');
    fireEvent.change(nameInput, { target: { value: 'Elegant Blooms Co.' } });

    fireEvent.click(screen.getByText('Save Changes'));

    expect(screen.queryByText('✏️ Edit Vendor')).toBeNull();
    const stored = storedVendors();
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Elegant Blooms Co.');
    expect(stored[0].contactName).toBe('Jane'); // untouched fields preserved
  });

  it('persists toggled checkboxes on save', () => {
    render(<VendorPanel onClose={() => {}} />);
    fireEvent.click(screen.getByText('✏️ Edit'));

    // First checkbox in the edit form is "Contract Signed".
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByText('Save Changes'));

    expect(storedVendors()[0].contractSigned).toBe(true);
  });

  it('closes without saving when cancelled', () => {
    render(<VendorPanel onClose={() => {}} />);
    fireEvent.click(screen.getByText('✏️ Edit'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('✏️ Edit Vendor')).toBeNull();
    expect(storedVendors()[0].name).toBe('Elegant Flowers');
  });
});
