import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AdminPanel } from './AdminPanel';

describe('AdminPanel Fixtures default-collapsed behavior', () => {
  it('shows section headers collapsed by default and expands each section on demand', async () => {
    const user = userEvent.setup();

    render(
      <AdminPanel
        onClose={() => undefined}
        currentLayout={{ tables: [], fixtures: [], venueId: 'v1', category: 'reception' }}
        onLoadTemplateForEdit={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: /fixtures/i }));

    const venueSection = screen.getByText('Venue Fixtures').closest('div')?.parentElement as HTMLElement;
    const lodgingSection = screen.getByText(/Lodging\/Utilities Fixtures/i).closest('div')?.parentElement as HTMLElement;
    const exteriorSection = screen.getByText(/Architectural\/Landscape Features/i).closest('div')?.parentElement as HTMLElement;

    expect(venueSection).toBeTruthy();
    expect(lodgingSection).toBeTruthy();
    expect(exteriorSection).toBeTruthy();

    // Explicit default-collapsed assertions.
    expect(screen.queryByText('Dance Floor')).not.toBeInTheDocument();
    expect(screen.queryByText('Power Outlet')).not.toBeInTheDocument();
    expect(screen.queryByText('Fountain')).not.toBeInTheDocument();

    await user.click(within(venueSection).getByRole('button', { name: /expand/i }));
    expect(screen.getByText('Dance Floor')).toBeInTheDocument();

    await user.click(within(lodgingSection).getByRole('button', { name: /expand/i }));
    expect(screen.getByText('Power Outlet')).toBeInTheDocument();

    await user.click(within(exteriorSection).getByRole('button', { name: /expand/i }));
    expect(screen.getByText('Fountain')).toBeInTheDocument();
  });
});
