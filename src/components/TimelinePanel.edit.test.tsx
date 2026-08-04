import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelinePanel } from './TimelinePanel';
import { STORAGE_KEYS } from '../constants/storageKeys';
import type { WeddingTimeline } from '../types/timeline';

const timeline: WeddingTimeline = {
  id: 'tl-1',
  name: 'Our Big Day',
  weddingDate: '2026-06-06',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  days: [
    {
      id: 'day-1',
      date: '2026-06-06',
      label: 'Wedding Day',
      events: [
        {
          id: 'evt-1',
          title: 'Ceremony',
          description: '',
          startTime: '16:00',
          endTime: '17:00',
          date: '2026-06-06',
          category: 'ceremony',
          location: 'The Chapel',
          notes: '',
        },
      ],
    },
  ],
};

function storedTimelines(): WeddingTimeline[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.TIMELINES) || '[]');
}

describe('TimelinePanel event edit flow', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.TIMELINES, JSON.stringify([timeline]));
  });

  it('lets a user edit an existing event via the pencil button', () => {
    render(<TimelinePanel onClose={() => {}} />);

    // Select the timeline.
    fireEvent.click(screen.getByText('Our Big Day'));

    // The event pencil button opens the edit modal.
    const pencil = screen.getByTitle('Edit event');
    fireEvent.click(pencil);

    expect(screen.getByText('✏️ Edit Event')).toBeTruthy();

    // Change the title and save.
    const titleInput = screen.getByDisplayValue('Ceremony');
    fireEvent.change(titleInput, { target: { value: 'Ceremony & Vows' } });

    fireEvent.click(screen.getByText('Save Changes'));

    expect(screen.queryByText('✏️ Edit Event')).toBeNull();
    const updated = storedTimelines();
    expect(updated[0].days[0].events[0].title).toBe('Ceremony & Vows');
    expect(updated[0].days[0].events[0].startTime).toBe('16:00'); // untouched preserved
  });

  it('closes without saving on cancel', () => {
    render(<TimelinePanel onClose={() => {}} />);
    fireEvent.click(screen.getByText('Our Big Day'));
    fireEvent.click(screen.getByTitle('Edit event'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('✏️ Edit Event')).toBeNull();
    expect(storedTimelines()[0].days[0].events[0].title).toBe('Ceremony');
  });
});
