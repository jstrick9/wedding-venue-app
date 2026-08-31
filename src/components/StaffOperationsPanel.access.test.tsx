import { render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import StaffOperationsPanel from './StaffOperationsPanel';

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

const guestUser = {
  id: 'guest-1',
  username: 'guest-user',
  role: 'guest' as const,
  name: 'Guest User',
  isActive: true,
  createdAt: new Date().toISOString(),
};

const venues = [
  { id: 'v1', name: 'Grand Ballroom', width: 60, height: 40, capacity: 150, category: 'reception', color: '#fff' } as any,
];

describe('StaffOperationsPanel access guard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows access denied for unauthorized users', () => {
    render(
      <StaffOperationsPanel
        onClose={() => undefined}
        currentUser={guestUser as any}
        isAdmin={false}
        venueId="v1"
        eventName="Test Event"
        users={[] as any}
        venues={venues}
      />,
    );

    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    expect(
      screen.getByText(/you do not have permission to access staff operations/i),
    ).toBeInTheDocument();
  });

  // Review #245 P1-B regression: the access guard used to return BEFORE the
  // hook block. A permission revoked while the panel was mounted produced
  // "Rendered fewer hooks than expected" and crashed the workspace. Hooks must
  // run on every render; only the render branch is conditional.
  it('does not crash when permission is revoked while the panel is mounted', () => {
    const view = render(
      <StaffOperationsPanel
        onClose={() => undefined}
        currentUser={adminUser}
        isAdmin
        venueId="v1"
        eventName="Test Event"
        users={[adminUser]}
        venues={venues}
      />,
    );

    expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument();

    // Same mounted component, now unauthorized: must swap to the denied dialog
    // without throwing a hook-count error.
    expect(() => {
      view.rerender(
        <StaffOperationsPanel
          onClose={() => undefined}
          currentUser={guestUser as any}
          isAdmin={false}
          venueId="v1"
          eventName="Test Event"
          users={[adminUser]}
          venues={venues}
        />,
      );
    }).not.toThrow();

    expect(screen.getByText(/access denied/i)).toBeInTheDocument();

    // And back again: authorization restored while still mounted.
    expect(() => {
      view.rerender(
        <StaffOperationsPanel
          onClose={() => undefined}
          currentUser={adminUser}
          isAdmin
          venueId="v1"
          eventName="Test Event"
          users={[adminUser]}
          venues={venues}
        />,
      );
    }).not.toThrow();

    expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument();
  });
});
