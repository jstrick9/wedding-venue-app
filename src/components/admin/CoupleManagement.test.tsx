import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoupleManagement } from './CoupleManagement';
import { createCoupleEvent, getCoupleEvents } from '../../services/couples/coupleService';
import type { Config, User } from '../../types';

const mockConfig: Config = {
  logoUrl: '',
  venueName: 'Seven Paths Manor',
  tagline: 'Weddings Reimagined',
  location: 'Spring Hope, NC',
  websiteUrl: 'https://www.sevenpathsmanor.com',
  supportEmail: 'weddings@sevenpathsmanor.com',
  phone: '',
  primaryColor: '#4A1942',
  primaryDark: '#3d1a45',
  primaryLight: '#6b2c5c',
  accentColor: '#8B5A8B',
  backgroundColor: '#f3f4f6',
  textColor: '#1f2937',
  fontFamily: 'Inter, system-ui, sans-serif',
  headingFontFamily: 'Inter, system-ui, sans-serif',
  headerTextColor: '#FFFFFF',
  bodyTextColor: '#374151',
  accentTextColor: '#4A1942',
};

const mockUser: User = {
  id: 'admin-1',
  username: 'admin',
  email: 'admin@sevenpathsmanor.com',
  password: 'hashedpassword123',
  name: 'Sarah Admin',
  role: 'admin',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('CoupleManagement - manual testing without external infrastructure', () => {
  beforeEach(() => {
    localStorage.clear();
    createCoupleEvent({
      coupleName: 'Elena & Marcus',
      primaryEmail: 'elena.marcus@example.com',
      eventDate: '2026-11-20',
      guestCount: 150,
      availableSpaces: ['v1'],
    });
  });

  it('renders Copy invite, Open, and Email invite buttons for couples to test portal without external infrastructure', () => {
    const onShowSuccess = vi.fn();
    render(
      <CoupleManagement
        config={mockConfig}
        venues={[]}
        user={mockUser}
        isAdmin={true}
        onShowSuccess={onShowSuccess}
      />
    );

    const couples = getCoupleEvents();
    expect(couples.length).toBeGreaterThan(0);

    const firstCouple = couples[0];
    expect(screen.getByText(firstCouple.coupleName)).toBeInTheDocument();

    const emailBtns = screen.getAllByRole('button', { name: /✉️ Email invite/i });
    expect(emailBtns.length).toBeGreaterThanOrEqual(1);

    // Verify clicking Email invite invokes a mailto fallback URL containing token
    // without requiring external email infrastructure.
    const originalLocationHref = window.location.href;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: 'http://localhost/' },
    });

    fireEvent.click(emailBtns[0]);
    expect(window.location.href).toContain('mailto:');
    expect(window.location.href).toContain('couples-portal');
    expect(window.location.href).toContain(firstCouple.inviteToken);
    expect(onShowSuccess).toHaveBeenCalledWith(
      expect.stringContaining('Opened your email app')
    );

    // Restore window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: originalLocationHref },
    });
  });
});
