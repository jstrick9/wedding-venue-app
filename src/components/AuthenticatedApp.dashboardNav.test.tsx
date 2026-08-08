import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from '../App';
import { emit } from '../utils/appEvents';

describe('Venue Portal Navigation & Dashboard Inline Panels (#144)', () => {
  beforeEach(() => {
    localStorage.clear();
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const admin = {
      id: 'u1',
      username: 'admin',
      password: '',
      role: 'admin' as const,
      name: 'Administrator',
      email: 'admin@example.com',
      isActive: true,
      requiresPasswordChange: false,
      sessionVersion: 1,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem('spm_users', JSON.stringify([admin]));
    localStorage.setItem(
      'spm_session_v2',
      JSON.stringify({
        v: 2,
        userId: 'u1',
        issuedAt: new Date().toISOString(),
        expiresAt: future,
        isGuest: false,
        sessionVersion: 1,
      }),
    );
  });

  it('keeps user on #dashboard when clicking Vendors and closing Vendors returns to dashboard home', async () => {
    window.location.hash = '#/dashboard';
    render(<App />);

    // Verify on dashboard home
    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();

    // Click "Vendor Showcase" quick action button
    const vendorBtn = screen.getByRole('button', { name: /vendor showcase/i });
    fireEvent.click(vendorBtn);

    // Verify vendors panel opens inline and hash stays #/dashboard
    expect(await screen.findByRole('heading', { name: /preferred vendors/i })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/dashboard');

    // Click close button in Vendors header
    const closeBtn = screen.getByRole('button', { name: /←\s*dashboard/i });
    fireEvent.click(closeBtn);

    // Verify user is back on dashboard home and did not jump to #/studio
    expect(screen.queryByRole('heading', { name: /preferred vendors/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/dashboard');
  });

  it('keeps user on #dashboard when clicking Timeline Studio and closing returns to dashboard home', async () => {
    window.location.hash = '#/dashboard';
    render(<App />);

    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();

    const timelineBtn = screen.getByRole('button', { name: /timeline studio/i });
    fireEvent.click(timelineBtn);

    expect(await screen.findByRole('heading', { name: /wedding timeline/i })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/dashboard');

    const closeBtn = screen.getByRole('button', { name: /←\s*dashboard/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('heading', { name: /wedding timeline/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/dashboard');
  });

  it('keeps user on #dashboard when clicking Operations Studio and closing returns to dashboard home', async () => {
    window.location.hash = '#/dashboard';
    render(<App />);

    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();

    const opsBtn = screen.getByRole('button', { name: /operations studio/i });
    fireEvent.click(opsBtn);

    expect(await screen.findByRole('heading', { name: /staff & operations/i })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/dashboard');

    const closeBtn = screen.getByRole('button', { name: /←\s*dashboard/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('heading', { name: /staff & operations/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/dashboard');
  });

  it('emits spm_open_timeline to navigate directly to #dashboard timeline section and close returns to home', async () => {
    window.location.hash = '#/dashboard';
    render(<App />);

    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();

    act(() => {
      emit('spm_open_timeline');
    });

    expect(await screen.findByRole('heading', { name: /wedding timeline/i })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/dashboard');

    const closeBtn = screen.getByRole('button', { name: /←\s*dashboard/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('heading', { name: /wedding timeline/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/dashboard');
  });

  it('keeps user on #dashboard when clicking Portal Chat & DMs and close returns to home', async () => {
    window.location.hash = '#/dashboard';
    render(<App />);

    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();

    const chatBtn = screen.getByRole('button', { name: /portal chat & dms/i });
    fireEvent.click(chatBtn);

    expect(
      await screen.findByRole('heading', { name: /portal chat & direct messages/i })
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#/dashboard');

    const closeBtn = screen.getByRole('button', { name: /←\s*dashboard home/i });
    fireEvent.click(closeBtn);

    expect(
      screen.queryByRole('heading', { name: /portal chat & direct messages/i })
    ).not.toBeInTheDocument();
    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/dashboard');
  });

  it('emits spm_open_chat to navigate directly to #dashboard chat section', async () => {
    window.location.hash = '#/dashboard';
    render(<App />);

    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();

    act(() => {
      emit('spm_open_chat');
    });

    expect(
      await screen.findByRole('heading', { name: /portal chat & direct messages/i })
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#/dashboard');

    const closeBtn = screen.getByRole('button', { name: /←\s*dashboard home/i });
    fireEvent.click(closeBtn);

    expect(
      screen.queryByRole('heading', { name: /portal chat & direct messages/i })
    ).not.toBeInTheDocument();
    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/dashboard');
  });

  it('hides studio-specific menu items (Save Layout, Load Layout, Templates) from Header menu when on dashboard', async () => {
    window.location.hash = '#/dashboard';
    render(<App />);

    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();

    // Click menu button
    const menuBtn = screen.getByText('Menu').closest('button')!;
    fireEvent.click(menuBtn);

    // Vendors and Timeline should be in menu, but Save Layout and Load Layout should not be present
    expect(screen.getAllByText(/vendors/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/timeline/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('💾 Save Layout')).not.toBeInTheDocument();
    expect(screen.queryByText('📂 Load Layout')).not.toBeInTheDocument();
    expect(screen.queryByText('👑 Save as Master Layout')).not.toBeInTheDocument();
  });
});
