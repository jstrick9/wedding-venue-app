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
  onOpenGuests: () => {},
  onOpenTemplates: () => {},
  onClose: () => {},
};

describe('EventOverview access gating', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.VENDORS, '[]');
    localStorage.setItem(STORAGE_KEYS.VENDOR_PAYMENTS, '[]');
  });

  it('shows Manage Guests when canManageGuests is true/default', () => {
    render(<EventOverview {...(baseProps as any)} />);
    expect(screen.getByText('Manage Guests')).toBeTruthy();
  });

  it('hides Manage Guests when canManageGuests is false', () => {
    render(<EventOverview {...(baseProps as any)} canManageGuests={false} />);
    expect(screen.queryByText('Manage Guests')).toBeNull();
    // Read-only actions still available.
    expect(screen.getByText('Load a Template')).toBeTruthy();
  });
});
