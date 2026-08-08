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

  it('renders all 6 navigation tabs and Print Sheet header button for authorized admin', () => {
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
    expect(screen.getByRole('button', { name: /tasks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /areas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /shifts/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /checklists/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export \/ import/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /print sheet/i })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /tasks/i }));

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
    fireEvent.click(screen.getByRole('button', { name: /shifts/i }));
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

  it('calls window.print() when the header Print Sheet button is clicked', () => {
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

    const printBtn = screen.getByRole('button', { name: /print sheet/i });
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
});
