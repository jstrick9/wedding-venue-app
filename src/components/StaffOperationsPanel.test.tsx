import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import StaffOperationsPanel from './StaffOperationsPanel';
import { STORAGE_KEYS } from '../constants/storageKeys';

describe('StaffOperationsPanel (Operations Studio Module)', () => {
  const adminUser = {
    id: 'admin-1',
    username: 'admin',
    email: 'admin@example.com',
    password: '',
    role: 'admin' as const,
    name: 'Jane Administrator',
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const staffUser = {
    id: 'staff-1',
    username: 'staff',
    email: 'staff@example.com',
    password: '',
    role: 'staff' as const,
    name: 'Bob Staffer',
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('renders all 7 navigation tabs including BEO Sheet for authorized admin', () => {
    render(
      <StaffOperationsPanel
        onClose={() => undefined}
        currentUser={adminUser}
        isAdmin={true}
        venueId="v1"
        eventName="Wedding Reception"
        users={[adminUser, staffUser]}
        venues={[{ id: 'v1', name: 'Grand Ballroom', width: 60, height: 40, capacity: 150, category: 'reception', color: '#fff' } as any]}
      />,
    );

    expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^📜\s*beo sheet$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tasks$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /areas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^🕒\s*shifts$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /checklists/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export \/ import/i })).toBeInTheDocument();
  });

  it('adds a staff task, searches/filters tasks, and displays match count', async () => {
    render(
      <StaffOperationsPanel
        onClose={() => undefined}
        currentUser={adminUser}
        isAdmin={true}
        venueId="v1"
        eventName="Wedding Reception"
        users={[adminUser, staffUser]}
        venues={[{ id: 'v1', name: 'Grand Ballroom', width: 60, height: 40, capacity: 150, category: 'reception', color: '#fff' } as any]}
      />,
    );

    // Switch to Tasks tab
    fireEvent.click(screen.getByRole('button', { name: /tasks$/i }));

    const addTaskBtn = screen.getByRole('button', { name: /\+ add task/i });
    fireEvent.click(addTaskBtn);

    // Task "New Task" should now be in the list (1 in Kanban + 1 in print report)
    expect(screen.getAllByText('New Task')).toHaveLength(2);

    // Search for "New Task"
    const searchInput = screen.getByPlaceholderText(/search tasks/i);
    fireEvent.change(searchInput, { target: { value: 'New Task' } });
    expect(screen.getAllByText('New Task')).toHaveLength(2);

    // Search for non-matching string -> interactive Kanban hides it, leaving only 1 in print report
    fireEvent.change(searchInput, { target: { value: 'Unmatched Query' } });
    expect(screen.getAllByText('New Task')).toHaveLength(1);

    // Clear search
    fireEvent.click(screen.getByRole('button', { name: /clear task search/i }));
    expect(screen.getAllByText('New Task')).toHaveLength(2);
  });

  it('adds an operational area and scrubs assignedAreas from tasks when area is deleted', () => {
    // Pre-seed a task assigned to an area
    const initialTask = {
      id: 'task-1',
      title: 'Setup Garden Chairs',
      phase: 'pre-event' as const,
      status: 'not-started' as const,
      priority: 'high' as const,
      assignedStaff: [],
      assignedAreas: ['area-to-delete'],
      checklist: [],
      createdAt: new Date().toISOString(),
      createdBy: adminUser.id,
    };
    const initialArea = {
      id: 'area-to-delete',
      name: 'Rose Garden',
      color: '#4A1942',
      icon: '🌹',
      assignedStaff: [],
      venueId: 'v1',
    };

    localStorage.setItem(STORAGE_KEYS.STAFF_TASKS, JSON.stringify([initialTask]));
    localStorage.setItem(STORAGE_KEYS.STAFF_AREAS, JSON.stringify([initialArea]));

    render(
      <StaffOperationsPanel
        onClose={() => undefined}
        currentUser={adminUser}
        isAdmin={true}
        venueId="v1"
        eventName="Wedding Reception"
        users={[adminUser, staffUser]}
        venues={[{ id: 'v1', name: 'Grand Ballroom', width: 60, height: 40, capacity: 150, category: 'reception', color: '#fff' } as any]}
      />,
    );

    // Switch to Areas tab
    fireEvent.click(screen.getByRole('button', { name: /areas/i }));
    expect(screen.getByText('Rose Garden')).toBeInTheDocument();

    // Click area card to open edit modal
    fireEvent.click(screen.getByText('Rose Garden'));
    const deleteBtn = screen.getByRole('button', { name: /delete area/i });
    fireEvent.click(deleteBtn);

    // Confirm deletion in dialog
    const confirmDeleteBtn = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(confirmDeleteBtn);

    // Verify area is gone from storage
    const storedAreas = JSON.parse(localStorage.getItem(STORAGE_KEYS.STAFF_AREAS) || '[]');
    expect(storedAreas).toHaveLength(0);

    // Verify task assignedAreas is scrubbed
    const storedTasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.STAFF_TASKS) || '[]');
    expect(storedTasks[0].assignedAreas).toEqual([]);
  });

  it('adds a staff shift and formats start/end time using local datetime-local input without timezone shift', () => {
    render(
      <StaffOperationsPanel
        onClose={() => undefined}
        currentUser={adminUser}
        isAdmin={true}
        venueId="v1"
        eventName="Wedding Reception"
        users={[adminUser, staffUser]}
        venues={[{ id: 'v1', name: 'Grand Ballroom', width: 60, height: 40, capacity: 150, category: 'reception', color: '#fff' } as any]}
      />,
    );

    // Switch to Shifts tab
    fireEvent.click(screen.getByRole('button', { name: /^🕒\s*shifts$/i }));
    const addShiftBtn = screen.getByRole('button', { name: /\+ add shift/i });
    fireEvent.click(addShiftBtn);

    // Edit shift modal should open with valid YYYY-MM-DDTHH:mm local strings
    const startInput = screen.getByLabelText(/start time/i) as HTMLInputElement;
    const endInput = screen.getByLabelText(/end time/i) as HTMLInputElement;

    expect(startInput.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(endInput.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('toggles "Show incomplete items only" on Checklists tab', () => {
    const testTask = {
      id: 'task-check',
      title: 'Lighting Setup',
      phase: 'pre-event' as const,
      status: 'in-progress' as const,
      priority: 'medium' as const,
      assignedStaff: [],
      assignedAreas: [],
      checklist: [
        { id: 'c-1', label: 'Done item', completed: true },
        { id: 'c-2', label: 'Pending item', completed: false },
      ],
      createdAt: new Date().toISOString(),
      createdBy: adminUser.id,
    };

    localStorage.setItem(STORAGE_KEYS.STAFF_TASKS, JSON.stringify([testTask]));

    render(
      <StaffOperationsPanel
        onClose={() => undefined}
        currentUser={adminUser}
        isAdmin={true}
        venueId="v1"
        eventName="Wedding Reception"
        users={[adminUser, staffUser]}
        venues={[{ id: 'v1', name: 'Grand Ballroom', width: 60, height: 40, capacity: 150, category: 'reception', color: '#fff' } as any]}
      />,
    );

    // Switch to Checklists tab
    fireEvent.click(screen.getByRole('button', { name: /checklists/i }));

    expect(screen.getAllByText('Done item')).toHaveLength(2);
    expect(screen.getAllByText('Pending item')).toHaveLength(2);

    const toggle = screen.getByLabelText(/show incomplete items only/i);
    fireEvent.click(toggle);

    // Done item is hidden interactively, leaving only 1 in print report
    expect(screen.getAllByText('Done item')).toHaveLength(1);
    expect(screen.getAllByText('Pending item')).toHaveLength(2);
  });

  it('renders .ops-print-report printable Daily Operations Report section', () => {
    const { container } = render(
      <StaffOperationsPanel
        onClose={() => undefined}
        currentUser={adminUser}
        isAdmin={true}
        venueId="v1"
        eventName="Wedding Reception"
        users={[adminUser, staffUser]}
        venues={[{ id: 'v1', name: 'Grand Ballroom', width: 60, height: 40, capacity: 150, category: 'reception', color: '#fff' } as any]}
      />,
    );

    const printReport = container.querySelector('.ops-print-report');
    expect(printReport).not.toBeNull();
    expect(screen.getByRole('heading', { name: /daily operations report/i })).toBeInTheDocument();
  });

  it('calls window.print() when the Print BEO button is clicked on the BEO Sheet tab', () => {
    const testCouple = {
      id: 'cpl-beo-1',
      coupleName: 'Elena & Marcus',
      eventDate: '2026-11-20',
      guestCount: 200,
      inviteToken: 'token-beo-123',
      layoutStatus: 'approved',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.COUPLE_EVENTS, JSON.stringify([testCouple]));

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(
      <StaffOperationsPanel
        onClose={() => undefined}
        currentUser={adminUser}
        isAdmin={true}
        venueId="v1"
        eventName="Wedding Reception"
        users={[adminUser, staffUser]}
        venues={[{ id: 'v1', name: 'Grand Ballroom', width: 60, height: 40, capacity: 150, category: 'reception', color: '#fff' } as any]}
      />,
    );

    // Switch to BEO Sheet tab
    fireEvent.click(screen.getByRole('button', { name: /^📜\s*beo sheet$/i }));

    const printBtn = screen.getByRole('button', { name: /print beo/i });
    fireEvent.click(printBtn);

    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it('backs up corrupt JSON in localStorage without crashing when loading', () => {
    localStorage.setItem(STORAGE_KEYS.STAFF_TASKS, '{invalid-json');

    render(
      <StaffOperationsPanel
        onClose={() => undefined}
        currentUser={adminUser}
        isAdmin={true}
        venueId="v1"
        eventName="Wedding Reception"
        users={[adminUser, staffUser]}
        venues={[{ id: 'v1', name: 'Grand Ballroom', width: 60, height: 40, capacity: 150, category: 'reception', color: '#fff' } as any]}
      />,
    );

    expect(screen.getByRole('heading', { name: /staff & operations/i })).toBeInTheDocument();
    const backupKeys = Object.keys(localStorage).filter((k) =>
      k.startsWith(`${STORAGE_KEYS.STAFF_TASKS}_backup_`),
    );
    expect(backupKeys.length).toBeGreaterThan(0);
  });

  it('detects and flags overlapping staff shifts for the same staff member', () => {
    const shift1 = {
      id: 'shift-1',
      staffId: adminUser.id,
      role: 'coordinator' as const,
      startTime: '2026-08-08T10:00:00.000Z',
      endTime: '2026-08-08T14:00:00.000Z',
      venueId: 'v1',
      eventName: 'Wedding Reception',
    };
    const shift2 = {
      id: 'shift-2',
      staffId: adminUser.id,
      role: 'setup' as const,
      startTime: '2026-08-08T12:00:00.000Z',
      endTime: '2026-08-08T16:00:00.000Z',
      venueId: 'v1',
      eventName: 'Wedding Reception',
    };
    localStorage.setItem(STORAGE_KEYS.STAFF_SHIFTS, JSON.stringify([shift1, shift2]));

    render(
      <StaffOperationsPanel
        onClose={() => undefined}
        currentUser={adminUser}
        isAdmin={true}
        venueId="v1"
        eventName="Wedding Reception"
        users={[adminUser, staffUser]}
        venues={[{ id: 'v1', name: 'Grand Ballroom', width: 60, height: 40, capacity: 150, category: 'reception', color: '#fff' } as any]}
      />,
    );

    // Switch to Shifts tab
    fireEvent.click(screen.getByRole('button', { name: /shifts/i }));

    expect(screen.getByText(/Schedule Conflict Detected:/i)).toBeInTheDocument();
    expect(screen.getByText(/2 shifts overlap/i)).toBeInTheDocument();

    const warningBadges = screen.getAllByLabelText(/Schedule conflict warning/i);
    expect(warningBadges.length).toBeGreaterThan(0);
  });

  it('resets all completed checklist items across tasks when "Reset for Next Event" is confirmed', () => {
    const testTask = {
      id: 'task-reset',
      title: 'Setup Ballroom Table Linens',
      phase: 'pre-event' as const,
      status: 'completed' as const,
      priority: 'high' as const,
      assignedStaff: [adminUser.id],
      assignedAreas: [],
      checklist: [
        { id: 'item-1', label: 'Place white tablecloths', completed: true, completedAt: '2026-08-08T10:00:00.000Z', completedBy: adminUser.id },
        { id: 'item-2', label: 'Set napkins', completed: true, completedAt: '2026-08-08T10:05:00.000Z', completedBy: adminUser.id },
      ],
      createdAt: new Date().toISOString(),
      createdBy: adminUser.id,
    };
    localStorage.setItem(STORAGE_KEYS.STAFF_TASKS, JSON.stringify([testTask]));

    render(
      <StaffOperationsPanel
        onClose={() => undefined}
        currentUser={adminUser}
        isAdmin={true}
        venueId="v1"
        eventName="Wedding Reception"
        users={[adminUser, staffUser]}
        venues={[{ id: 'v1', name: 'Grand Ballroom', width: 60, height: 40, capacity: 150, category: 'reception', color: '#fff' } as any]}
      />,
    );

    // Switch to Checklists tab
    fireEvent.click(screen.getByRole('button', { name: /checklists/i }));

    const resetBtn = screen.getByRole('button', { name: /reset for next event/i });
    fireEvent.click(resetBtn);

    expect(screen.getByRole('heading', { name: /reset checklists for next event\?/i })).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /reset checklists/i });
    fireEvent.click(confirmBtn);

    const storedTasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.STAFF_TASKS) || '[]');
    expect(storedTasks[0].status).toBe('not-started');
    expect(storedTasks[0].checklist[0].completed).toBe(false);
    expect(storedTasks[0].checklist[0].completedAt).toBeUndefined();
    expect(storedTasks[0].checklist[1].completed).toBe(false);
  });

  it('switches to BEO Sheet tab and displays master Banquet Event Order with couple, layout, schedule, and print BEO button', () => {
    const testCouple = {
      id: 'cpl-beo-1',
      coupleName: 'Elena & Marcus',
      eventDate: '2026-11-20',
      guestCount: 200,
      inviteToken: 'token-beo-123',
      layoutStatus: 'approved',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.COUPLE_EVENTS, JSON.stringify([testCouple]));

    render(
      <StaffOperationsPanel
        onClose={() => undefined}
        currentUser={adminUser}
        isAdmin={true}
        venueId="v1"
        eventName="Wedding Reception"
        users={[adminUser, staffUser]}
        venues={[{ id: 'v1', name: 'Grand Ballroom', width: 60, height: 40, capacity: 150, category: 'reception', color: '#fff' } as any]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^📜\s*beo sheet$/i }));

    expect(screen.getAllByText('BANQUET EVENT ORDER (BEO)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Elena & Marcus').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/200 guests/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/section 1: event & client summary/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /print beo/i })).toBeInTheDocument();
  });

  it('loads default operational areas and phase checklists from Admin Settings when clicking Load Checklists from Admin', () => {
    render(
      <StaffOperationsPanel
        onClose={() => undefined}
        currentUser={adminUser}
        isAdmin={true}
        venueId="v1"
        eventName="Wedding Reception"
        users={[adminUser, staffUser]}
        venues={[{ id: 'v1', name: 'Grand Ballroom', width: 60, height: 40, capacity: 150, category: 'reception', color: '#fff' } as any]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /checklists/i }));

    const loadAdminBtn = screen.getByRole('button', { name: /load checklists from admin/i });
    fireEvent.click(loadAdminBtn);

    const storedAreas = JSON.parse(localStorage.getItem(STORAGE_KEYS.STAFF_AREAS) || '[]');
    const storedTasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.STAFF_TASKS) || '[]');
    expect(storedAreas.some((a: any) => a.name.includes('Main Manor'))).toBe(true);
    expect(storedTasks.some((t: any) => t.checklist.some((ci: any) => ci.label.includes('Confirm floor plan approval')))).toBe(true);
  });
});
