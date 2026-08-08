import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from '../App';
import { cleanupToastListeners } from './Toast';

describe('Design Studio empty Master Layout warning', () => {
  beforeEach(() => {
    localStorage.clear();
    cleanupToastListeners();
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const admin = {
      id: 'u1',
      username: 'admin',
      password: '',
      role: 'admin',
      name: 'Administrator',
      email: 'weddings@sevenpathsmanor.com',
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

  it('warns before saving an empty layout as Master Layout and saves on confirm', async () => {
    window.location.hash = '#/studio';
    render(<App />);

    await screen.findByText(/Layout Studio/i);

    // Open the header Layout Menu (☰ / Menu button).
    const menuButtons = await screen.findAllByRole('button', { name: /menu/i });
    fireEvent.click(menuButtons[0]);

    // Find and click "Save as Master Layout"
    const saveMasterBtn = await screen.findByRole('button', { name: /save as master layout/i });
    fireEvent.click(saveMasterBtn);

    // Because the layout has 0 tables, 0 fixtures, and 0 decor items, a warning dialog should open.
    expect(await screen.findByRole('heading', { name: /save empty master layout\?/i })).toBeInTheDocument();
    expect(screen.getByText(/has no tables, fixtures, or decor items/i)).toBeInTheDocument();

    // Confirm saving the empty master layout
    const confirmBtn = screen.getByRole('button', { name: /save empty master/i });
    fireEvent.click(confirmBtn);

    // The toast message should indicate it was saved.
    const toasts = await screen.findAllByText(/saved as the master layout for/i);
    expect(toasts.length).toBeGreaterThan(0);
  });

  it('closes the empty Master Layout warning without saving when cancelled', async () => {
    window.location.hash = '#/studio';
    render(<App />);

    await screen.findByText(/Layout Studio/i);

    const menuButtons = await screen.findAllByRole('button', { name: /menu/i });
    fireEvent.click(menuButtons[0]);

    const saveMasterBtn = await screen.findByRole('button', { name: /save as master layout/i });
    fireEvent.click(saveMasterBtn);

    expect(await screen.findByRole('heading', { name: /save empty master layout\?/i })).toBeInTheDocument();

    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /^cancel$/i });
    fireEvent.click(cancelBtn);

    // The confirm dialog should close and no save toast should appear.
    expect(screen.queryByRole('heading', { name: /save empty master layout\?/i })).not.toBeInTheDocument();
    expect(screen.queryAllByText(/saved as the master layout for/i).length).toBe(0);
  });
});
