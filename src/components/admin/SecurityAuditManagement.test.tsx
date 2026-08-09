import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SecurityAuditManagement } from './SecurityAuditManagement';
import { STORAGE_KEYS } from '../../constants/storageKeys';

vi.mock('../../hooks/useRBAC', () => ({
  useRBAC: () => ({
    auditLog: [
      {
        id: 'aud-1',
        action: 'ROLE_UPDATED',
        performedBy: 'admin-1',
        performedByName: 'Administrator',
        targetType: 'Role',
        targetName: 'Master Admin',
        details: 'Added permission couples:spaces:edit',
        timestamp: new Date().toISOString(),
      },
    ],
  }),
}));

describe('SecurityAuditManagement (#147)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const dummyProps: any = {
    config: { primaryColor: '#4A1942' },
    onShowSuccess: vi.fn(),
  };

  it('renders security settings controls and supports saving settings and clearing cache', () => {
    render(<SecurityAuditManagement {...dummyProps} />);

    expect(
      screen.getByText(/workspace authentication & security rules/i)
    ).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', {
      name: /save security settings/i,
    });
    fireEvent.click(saveBtn);
    expect(dummyProps.onShowSuccess).toHaveBeenCalledWith(
      'System security & privacy settings saved!'
    );

    const clearCacheBtn = screen.getByRole('button', {
      name: /clear expired sessions & cache/i,
    });
    fireEvent.click(clearCacheBtn);
    expect(dummyProps.onShowSuccess).toHaveBeenCalledWith(
      'Cleared temporary edit sessions and cache cleanly.'
    );
  });

  it('switches to audit trail tab, displays audit log entries, and supports CSV export', () => {
    render(<SecurityAuditManagement {...dummyProps} />);

    const auditTab = screen.getByRole('button', {
      name: /comprehensive audit trail/i,
    });
    fireEvent.click(auditTab);

    expect(
      screen.getByText(/administrative & access control audit log/i)
    ).toBeInTheDocument();
    expect(screen.getByText('ROLE UPDATED')).toBeInTheDocument();
    expect(screen.getByText('Master Admin')).toBeInTheDocument();

    const csvBtn = screen.getByRole('button', { name: /export csv/i });
    expect(csvBtn).not.toBeDisabled();
  });
});
