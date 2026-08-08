import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelinePanel } from './TimelinePanel';
import { STORAGE_KEYS } from '../constants/storageKeys';
import type { WeddingTimeline } from '../types/timeline';

const testTimeline: WeddingTimeline = {
  id: 'tl-100',
  name: 'Smith Wedding Schedule',
  weddingDate: '2026-09-15',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  days: [
    {
      id: 'day-1',
      date: '2026-09-15',
      label: 'Wedding Day',
      events: [
        {
          id: 'evt-1',
          title: 'Ceremony Setup',
          description: '',
          startTime: '10:00',
          endTime: '12:00',
          date: '2026-09-15',
          category: 'vendor-arrival',
          location: 'Garden',
          assignedTo: [],
          isCompleted: true,
        },
        {
          id: 'evt-2',
          title: 'Vows Ceremony',
          description: '',
          startTime: '16:00',
          endTime: '17:00',
          date: '2026-09-15',
          category: 'ceremony',
          location: 'Chapel',
          assignedTo: [],
          isCompleted: false,
        },
        {
          id: 'evt-3',
          title: 'Reception Dinner',
          description: '',
          startTime: '18:00',
          endTime: '22:00',
          date: '2026-09-15',
          category: 'reception',
          location: 'Main Ballroom',
          assignedTo: [],
          isCompleted: false,
        },
      ],
    },
  ],
};

describe('TimelinePanel UI/UX enhancements & navigation (#145)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.TIMELINES, JSON.stringify([testTimeline]));
  });

  it('renders explicit "← Dashboard" and "✕" close buttons and calls onClose when clicked', () => {
    const onClose = vi.fn();
    render(<TimelinePanel onClose={onClose} />);

    const dashboardBtn = screen.getByRole('button', { name: /←\s*dashboard/i });
    expect(dashboardBtn).toBeInTheDocument();

    fireEvent.click(dashboardBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByRole('button', { name: /close timeline panel/i });
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('displays KPI stats summary bar for active timeline', () => {
    render(<TimelinePanel onClose={() => {}} />);
    fireEvent.click(screen.getByText('Smith Wedding Schedule'));

    expect(screen.getByText('3 events')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('(33%)')).toBeInTheDocument();
  });

  it('provides a print button when active timeline is loaded', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<TimelinePanel onClose={() => {}} />);
    fireEvent.click(screen.getByText('Smith Wedding Schedule'));

    const printBtn = screen.getByRole('button', { name: /print/i });
    expect(printBtn).toBeInTheDocument();

    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('filters timeline events by search term, category dropdown, and hide-completed toggle', () => {
    render(<TimelinePanel onClose={() => {}} />);
    fireEvent.click(screen.getByText('Smith Wedding Schedule'));

    // Initially all 3 events are displayed
    expect(screen.getByText('Ceremony Setup')).toBeInTheDocument();
    expect(screen.getByText('Vows Ceremony')).toBeInTheDocument();
    expect(screen.getByText('Reception Dinner')).toBeInTheDocument();

    // 1. Filter by category "ceremony"
    const catSelect = screen.getByLabelText(/filter events by category/i);
    fireEvent.change(catSelect, { target: { value: 'ceremony' } });

    expect(screen.queryByText('Ceremony Setup')).not.toBeInTheDocument();
    expect(screen.getByText('Vows Ceremony')).toBeInTheDocument();
    expect(screen.queryByText('Reception Dinner')).not.toBeInTheDocument();

    // Reset category
    fireEvent.change(catSelect, { target: { value: 'all' } });
    expect(screen.getByText('Ceremony Setup')).toBeInTheDocument();

    // 2. Filter by search text "ballroom" (matches Reception Dinner location)
    const searchInput = screen.getByPlaceholderText(/search timeline events/i);
    fireEvent.change(searchInput, { target: { value: 'ballroom' } });

    expect(screen.queryByText('Ceremony Setup')).not.toBeInTheDocument();
    expect(screen.queryByText('Vows Ceremony')).not.toBeInTheDocument();
    expect(screen.getByText('Reception Dinner')).toBeInTheDocument();

    // 3. Click "Clear filters" link
    const clearBtn = screen.getByRole('button', { name: /clear filters/i });
    fireEvent.click(clearBtn);

    expect(screen.getByText('Ceremony Setup')).toBeInTheDocument();
    expect(screen.getByText('Vows Ceremony')).toBeInTheDocument();
    expect(screen.getByText('Reception Dinner')).toBeInTheDocument();

    // 4. Toggle "Show incomplete only" checkbox
    const hideCompletedCheckbox = screen.getByLabelText(/show incomplete only/i);
    fireEvent.click(hideCompletedCheckbox);

    // Ceremony Setup isCompleted=true so it should be hidden
    expect(screen.queryByText('Ceremony Setup')).not.toBeInTheDocument();
    expect(screen.getByText('Vows Ceremony')).toBeInTheDocument();
    expect(screen.getByText('Reception Dinner')).toBeInTheDocument();
  });
});
