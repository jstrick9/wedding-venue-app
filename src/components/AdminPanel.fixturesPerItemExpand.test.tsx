import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AdminPanel } from './AdminPanel';

describe('AdminPanel Fixtures per-item expand/collapse', () => {
  it('expands and collapses one item in each fixture section', async () => {
    const user = userEvent.setup();

    render(
      <AdminPanel
        onClose={() => undefined}
        currentLayout={{ tables: [], fixtures: [], venueId: 'v1', category: 'reception' }}
        onLoadTemplateForEdit={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: /fixtures/i }));

    // Expand all sections first
    const sectionExpandButtons = screen.getAllByRole('button', { name: /expand/i });
    for (const btn of sectionExpandButtons) {
      await user.click(btn);
    }

    // Venue fixture item
    await user.click(screen.getByText('Dance Floor'));
    expect(screen.getByText(/Visible to Basic\/Guest users/i)).toBeInTheDocument();
    await user.click(screen.getByText('Dance Floor'));

    // Lodging fixture item
    const lodgingItem = screen.getByText(/Power Outlet|Single Bed|Sofa|Toilet/i);
    await user.click(lodgingItem);
    expect(screen.getByText(/Lodging\/Utilities Type/i)).toBeInTheDocument();
    await user.click(lodgingItem);

    // Exterior fixture item
    await user.click(screen.getByText('Fountain'));
    expect(screen.getByText(/Visible on Layout/i)).toBeInTheDocument();
    await user.click(screen.getByText('Fountain'));
  });
});
