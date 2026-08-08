import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VenueChatPanel } from './VenueChatPanel';
import { STORAGE_KEYS } from '../constants/storageKeys';
import type { CoupleEvent, User } from '../types';

const testUser: User = {
  id: 'usr-admin-1',
  username: 'admin',
  name: 'Administrator',
  role: 'admin',
  email: 'admin@sevenpathsmanor.com',
  password: '',
  isActive: true,
  createdAt: new Date().toISOString(),
};

const testCouple: CoupleEvent = {
  id: 'cpl-1',
  coupleName: 'Sarah & John',
  eventDate: '2026-10-10',
  guestCount: 150,
  inviteToken: 'token-sarah-john',
  layoutStatus: 'approved',
  status: 'active',
  availableSpaces: [],
  selectedSpaces: [],
  layoutHistory: [],
  collaborators: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('VenueChatPanel Portal-to-Portal Chat & DMs (#146)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.COUPLE_EVENTS, JSON.stringify([testCouple]));
  });

  it('renders both Couples Portal Chat and Internal Team DMs tabs', () => {
    render(<VenueChatPanel user={testUser} isAdmin={true} onClose={() => {}} />);

    expect(
      screen.getByRole('button', { name: /couples portal chat/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /internal team dms/i })
    ).toBeInTheDocument();
  });

  it('displays couple event details in thread list and active chat header', () => {
    render(<VenueChatPanel user={testUser} isAdmin={true} onClose={() => {}} />);

    // Check thread list item
    expect(screen.getAllByText('Sarah & John').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/150 guests/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('approved').length).toBeGreaterThan(0);
    expect(screen.getByText(/token-sarah-john/i)).toBeInTheDocument();
  });

  it('allows sending a message to the selected couple event', () => {
    render(<VenueChatPanel user={testUser} isAdmin={true} onClose={() => {}} />);

    const textarea = screen.getByPlaceholderText(/message sarah & john/i);
    fireEvent.change(textarea, { target: { value: 'Welcome to your Seven Paths Manor portal!' } });

    const sendBtn = screen.getByRole('button', { name: /send →/i });
    fireEvent.click(sendBtn);

    expect(screen.getByText('Welcome to your Seven Paths Manor portal!')).toBeInTheDocument();
    expect(screen.getByText('Venue Team')).toBeInTheDocument();
  });

  it('populates message composer when clicking a Quick Reply template', () => {
    render(<VenueChatPanel user={testUser} isAdmin={true} onClose={() => {}} />);

    const quickReplyBtn = screen.getByRole('button', { name: /✨ layout approved/i });
    fireEvent.click(quickReplyBtn);

    const textarea = screen.getByPlaceholderText(/message sarah & john/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('approved your floor plan');
  });

  it('calls onClose when clicking ← Dashboard Home or ✕ close buttons', () => {
    const onClose = vi.fn();
    render(<VenueChatPanel user={testUser} isAdmin={true} onClose={onClose} />);

    const backBtn = screen.getByRole('button', { name: /←\s*dashboard home/i });
    fireEvent.click(backBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByRole('button', { name: /close chat panel/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
