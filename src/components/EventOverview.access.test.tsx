import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventOverview } from './EventOverview';
import { STORAGE_KEYS } from '../constants/storageKeys';

const baseProps = {
  guests: [],
  tables: [],
  tableSpecs: [],
  venue: { id: 'v1', name: 'Garden', width: 60, height: 40, category: 'garden' } as any,
  eventName: 'Our Wedding',
  venueName: 'Garden',
  onOpenTemplates: () => {},
  onClose: () => {},
};

describe('EventOverview access gating', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.VENDORS, '[]');
    localStorage.setItem(STORAGE_KEYS.VENDOR_PAYMENTS, '[]');
  });

  it('no longer exposes guest management from the venue overview', () => {
    render(<EventOverview {...(baseProps as any)} />);
    // Guest management was removed from the venue portal.
    expect(screen.queryByText('Manage Guests')).toBeNull();
    // Read-only actions still available.
    expect(screen.getByText('Load a Template')).toBeTruthy();
  });
});
