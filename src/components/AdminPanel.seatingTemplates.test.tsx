import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AdminPanel } from './AdminPanel';

describe('AdminPanel Seating template behavior', () => {
  it('creates a seating template and allows venue-category restriction editing', async () => {
    const user = userEvent.setup();

    render(
      <AdminPanel
        onClose={() => undefined}
        currentLayout={{ tables: [], fixtures: [], venueId: 'v1', category: 'ceremony' }}
        onLoadTemplateForEdit={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: /tables\/seating/i }));

    // Expand Seating Types section.
    const seatingHeader = screen.getByText('Seating Types').closest('div');
    expect(seatingHeader).toBeTruthy();
    await user.click(
      seatingHeader!.parentElement!.querySelector('button') as HTMLButtonElement,
    );

    // Add a quick seating template.
    await user.click(screen.getByRole('button', { name: /ceremony row/i }));

    expect(screen.getByText(/Ceremony Row/i)).toBeInTheDocument();

    // Expand created seating type and verify category controls.
    await user.click(screen.getByText(/Ceremony Row/i));
    expect(screen.getByText(/Assign venue categories/i)).toBeInTheDocument();

    // Category buttons are available for restrictions.
    expect(screen.getByRole('button', { name: /Ceremony/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reception/i })).toBeInTheDocument();
  });
});
