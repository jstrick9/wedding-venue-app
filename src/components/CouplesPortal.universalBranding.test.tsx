import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import CouplesPortal from './CouplesPortal';
import { EventQuestionsWizard } from './EventQuestionsWizard';
import { CoupleLayoutEditor } from './CoupleLayoutEditor';
import {
  createCoupleEvent,
  saveCoupleSession,
  getCoupleEvents,
  resolveCoupleInviteToken,
} from '../services/couples/coupleService';

vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>();
  return {
    ...actual,
    useBrandingConfig: () => ({
      ...actual.defaultConfig,
      primaryColor: '#10b981',
      primaryDark: '#047857',
      primaryLight: '#34d399',
      venueName: 'Emerald Manor',
    }),
  };
});

describe('CouplesPortal - Universal Branding Integration (#159)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function setupTestEvent() {
    const ev = createCoupleEvent({
      coupleName: 'Branded Couple',
      eventDate: '2028-10-10',
      guestCount: 150,
      availableSpaces: [],
    });
    const owner = resolveCoupleInviteToken(ev.inviteToken)!;
    saveCoupleSession(owner.event.id, owner.collaborator.id);
    return getCoupleEvents()[0];
  }

  it('applies branding settings (primaryColor and venueName) to Header, Hero Banner, and Tab buttons', () => {
    setupTestEvent();
    render(<CouplesPortal onExitPortal={() => {}} />);

    // 1. Verify venue name from config is displayed in Header and footer
    expect(screen.getAllByText(/Emerald Manor/i).length).toBeGreaterThan(0);

    // 2. Verify active Overview tab has inline backgroundColor matching primaryColor (#10b981)
    const overviewTab = screen.getByRole('tab', { name: /Overview/i });
    expect(overviewTab.getAttribute('style')).toContain('background-color: rgb(16, 185, 129)');

    // 3. Verify Switch Couple button has inline color matching primaryColor (#10b981)
    const switchBtn = screen.getByTitle('Switch to another couple event or test token');
    expect(switchBtn.getAttribute('style')).toContain('color: rgb(16, 185, 129)');
  });

  it('applies branding settings to EventQuestionsWizard primary action buttons', () => {
    render(
      <EventQuestionsWizard
        questions={[
          {
            id: 'q1',
            group: 'Ceremony',
            text: 'Outdoor ceremony?',
            answerType: 'dropdown',
            required: false,
          },
        ]}
        initialAnswers={[]}
        userId="user-1"
        eventId="ev-1"
        onSaveAnswers={() => {}}
        onVenueFilterChange={() => {}}
      />
    );

    const saveBtn = screen.getByRole('button', { name: /Save & Continue/i });
    expect(saveBtn.getAttribute('style')).toContain('background-color: rgb(16, 185, 129)');
  });

  it('applies branding settings to CoupleLayoutEditor header gradient and save button', () => {
    render(
      <CoupleLayoutEditor
        venue={{
          id: 'v1',
          name: 'Emerald Hall',
          category: 'reception',
          width: 50,
          height: 40,
          capacity: 100,
        }}
        onSave={() => {}}
        onClose={() => {}}
      />
    );

    const saveLayoutBtn = screen.getByRole('button', { name: /Save layout/i });
    expect(saveLayoutBtn.getAttribute('style')).toContain('color: rgb(16, 185, 129)');

    const titleEl = screen.getByText('Layout editor — Emerald Hall');
    const headerEl = titleEl.parentElement?.parentElement;
    expect(headerEl?.getAttribute('style')).toContain('linear-gradient(135deg, rgb(16, 185, 129), rgb(4, 120, 87))');
  });
});
