import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AdminPanel } from './AdminPanel';

describe('AdminPanel Tables/Seating tab', () => {
  it('shows separate Table Types and Seating Types sections', async () => {
    const user = userEvent.setup();

    render(
      <AdminPanel
        onClose={() => undefined}
        currentLayout={{ tables: [], fixtures: [], venueId: 'v1', category: 'reception' }}
        onLoadTemplateForEdit={() => undefined}
      />,
    );

    const tablesTab = screen.getByRole('button', { name: /tables\/seating/i });
    await user.click(tablesTab);

    expect(screen.getByText(/table types/i)).toBeInTheDocument();
    expect(screen.getByText(/seating types/i)).toBeInTheDocument();
  });
});
