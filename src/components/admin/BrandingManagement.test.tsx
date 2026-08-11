import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrandingManagement } from './BrandingManagement';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import type { Config } from '../../types';

const testConfig: Config = {
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

describe('BrandingManagement UI/UX & Live Branding Theme Engine (#149)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const dummyProps: any = {
    config: testConfig,
    handleSaveConfig: vi.fn(),
    onShowSuccess: vi.fn(),
    expandedBrandingSections: new Set(['typography', 'colors', 'preview']),
    setExpandedBrandingSections: vi.fn(),
  };

  it('renders Quick Presets, color pickers, WCAG contrast badge, and Portal Theme preview tabs', () => {
    render(<BrandingManagement {...dummyProps} />);

    expect(screen.getByText(/quick presets/i)).toBeInTheDocument();
    expect(screen.getByText('Deep Plum')).toBeInTheDocument();
    expect(screen.getByText('Navy & Gold')).toBeInTheDocument();
    expect(screen.getByText(/wcag aa text contrast/i)).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /home & landing page/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /dashboard kpi/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /portal chat/i })
    ).toBeInTheDocument();
  });

  it('switches between Header Banner, Dashboard KPI, and Portal Chat preview tabs', () => {
    render(<BrandingManagement {...dummyProps} />);

    // Initially Header Banner preview is visible
    expect(screen.getAllByText('● Active Brand')[0]).toBeInTheDocument();

    // Click Dashboard KPI tab
    const dashTab = screen.getByRole('button', { name: /dashboard kpi/i });
    fireEvent.click(dashTab);
    expect(
      screen.getByText('Dashboard KPI Card Preview')
    ).toBeInTheDocument();
    expect(screen.getByText('Active Brand')).toBeInTheDocument();

    // Click Portal Chat tab
    const chatTab = screen.getByRole('button', { name: /portal chat/i });
    fireEvent.click(chatTab);
    expect(
      screen.getByText('Couples Portal Chat Message Preview')
    ).toBeInTheDocument();
    expect(screen.getByText('Venue Coordinator')).toBeInTheDocument();
  });

  it('displays WCAG AA pass badge for high-contrast primary colors (#4A1942)', () => {
    render(<BrandingManagement {...dummyProps} />);

    expect(
      screen.getByText(/passes accessibility guidelines/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /auto-fix contrast/i })
    ).not.toBeInTheDocument();
  });

  it('displays Low Contrast Warning and Auto-Fix button for low-contrast primary colors', () => {
    const lowContrastConfig = { ...testConfig, primaryColor: '#FDE68A' };
    render(
      <BrandingManagement
        {...dummyProps}
        config={lowContrastConfig}
      />
    );

    expect(
      screen.getByText(/low contrast warning/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /auto-fix contrast/i })
    ).toBeInTheDocument();
  });
});
