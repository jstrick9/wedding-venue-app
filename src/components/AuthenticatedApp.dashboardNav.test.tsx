import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
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

  it('rewrites leftover #/dashboard and #/venue hashes to #/home', async () => {
    window.location.hash = '#/dashboard';
    const { unmount } = render(<App />);
    expect(await screen.findByText(/Welcome back/i, {}, { timeout: 4000 })).toBeInTheDocument();
    // The rewrite is a mount passive effect (AuthenticatedApp.tsx); under
    // concurrent React it can fire after findByText's MutationObserver
    // resolves, so poll for the hash instead of asserting immediately.
    await waitFor(() => expect(window.location.hash).toBe('#/home'));
    unmount();

    window.location.hash = '#/venue';
    render(<App />);
    expect(await screen.findByText(/Welcome back/i, {}, { timeout: 4000 })).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe('#/home'));
  });

  it('keeps user on #/home when clicking Vendors and closing Vendors returns to dashboard home', async () => {
    window.location.hash = '#/home';
    render(<App />);

    // Verify on dashboard home
    expect(await screen.findByText(/Welcome back/i, {}, { timeout: 4000 })).toBeInTheDocument();

    // Click "Vendor Showcase" quick action button
    const vendorBtn = screen.getByRole('button', { name: /vendor showcase/i });
    fireEvent.click(vendorBtn);

    // Verify vendors panel opens inline and hash stays #/home
    expect(await screen.findByRole('heading', { name: /preferred vendors/i })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/home');

    // Click Home button in sidebar to return to dashboard home
    const homeBtn = screen.getAllByRole('button', { name: /home/i })[0];
    fireEvent.click(homeBtn);

    // Verify user is back on dashboard home and did not jump to #/studio
    expect(screen.queryByRole('heading', { name: /preferred vendors/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/home');
  });

  it('keeps user on #/home when clicking Timeline Studio and closing returns to dashboard home', async () => {
    window.location.hash = '#/home';
    render(<App />);

    expect(await screen.findByText(/Welcome back/i, {}, { timeout: 4000 })).toBeInTheDocument();

    const timelineBtn = screen.getByRole('button', { name: /timeline studio/i });
    fireEvent.click(timelineBtn);

    expect(await screen.findByRole('heading', { name: /wedding timeline/i })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/home');

    const homeBtn = screen.getAllByRole('button', { name: /home/i })[0];
    fireEvent.click(homeBtn);

    expect(screen.queryByRole('heading', { name: /wedding timeline/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/home');
  });

  it('keeps user on #/home when clicking Operations Studio and closing returns to dashboard home', async () => {
    window.location.hash = '#/home';
    render(<App />);

    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();

    const opsBtn = screen.getByRole('button', { name: /operations studio/i });
    fireEvent.click(opsBtn);

    expect(await screen.findByRole('heading', { name: /staff & operations/i })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/home');

    const homeBtn = screen.getAllByRole('button', { name: /home/i })[0];
    fireEvent.click(homeBtn);

    expect(screen.queryByRole('heading', { name: /staff & operations/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/home');
  });

  it('emits spm_open_timeline to navigate directly to #/home timeline section and close returns to home', async () => {
    window.location.hash = '#/home';
    render(<App />);

    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();

    act(() => {
      emit('spm_open_timeline');
    });

    expect(await screen.findByRole('heading', { name: /wedding timeline/i })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/home');

    const homeBtn = screen.getAllByRole('button', { name: /home/i })[0];
    fireEvent.click(homeBtn);

    expect(screen.queryByRole('heading', { name: /wedding timeline/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/home');
  });

  it('keeps user on #/home when clicking Portal Chat & DMs and close returns to home', async () => {
    window.location.hash = '#/home';
    render(<App />);

    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();

    const chatBtn = screen.getByRole('button', { name: /portal chat & dms/i });
    fireEvent.click(chatBtn);

    expect(
      await screen.findByRole('heading', { name: /portal chat & direct messages/i })
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#/home');

    const homeBtn = screen.getAllByRole('button', { name: /home/i })[0];
    fireEvent.click(homeBtn);

    expect(
      screen.queryByRole('heading', { name: /portal chat & direct messages/i })
    ).not.toBeInTheDocument();
    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/home');
  });

  it('emits spm_open_chat to navigate directly to #/home chat section', async () => {
    window.location.hash = '#/home';
    render(<App />);

    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();

    act(() => {
      emit('spm_open_chat');
    });

    expect(
      await screen.findByRole('heading', { name: /portal chat & direct messages/i })
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#/home');

    const homeBtn = screen.getAllByRole('button', { name: /home/i })[0];
    fireEvent.click(homeBtn);

    expect(
      screen.queryByRole('heading', { name: /portal chat & direct messages/i })
    ).not.toBeInTheDocument();
    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/home');
  });

  it('never writes #/dashboard as a venue workspace destination', () => {
    const source = readFileSync(resolve(__dirname, 'AuthenticatedApp.tsx'), 'utf8');
    expect(source).not.toMatch(/window\.location\.hash = '#\/dashboard'/);
    expect(source).toContain('window.location.hash = VENUE_HOME_HASH');
  });

  it('does not show a Header Menu or studio-specific layout actions on Home', async () => {
    window.location.hash = '#/home';
    render(<App />);

    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();

    // Landing sidebar stays on screen; the overlay ☰ Menu hamburger is gone.
    expect(screen.queryByRole('button', { name: /toggle navigation menu/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Menu')).not.toBeInTheDocument();

    // Vendors and Timeline remain reachable from the dashboard; studio canvas actions do not.
    expect(screen.getAllByText(/vendors/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/timeline/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('💾 Save Layout')).not.toBeInTheDocument();
    expect(screen.queryByText('📂 Load Layout')).not.toBeInTheDocument();
    expect(screen.queryByText('👑 Save as Master Layout')).not.toBeInTheDocument();
  });
});
