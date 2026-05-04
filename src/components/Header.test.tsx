import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from './Header';

const venues = [
  { id: 'v1', name: 'Reception Hall', category: 'reception', width: 50, height: 30, capacity: 150 },
  { id: 'v2', name: 'Lodge', category: 'lodging', width: 30, height: 20, capacity: 40 },
  { id: 'v3', name: 'Garden', category: 'outdoor', width: 80, height: 60, capacity: 200 },
] as any;

function renderHeader(overrides: Partial<React.ComponentProps<typeof Header>> = {}) {
  return render(
    <Header
      currentVenue={venues[0]}
      venues={venues}
      onChangeVenue={vi.fn()}
      onSaveLayout={vi.fn()}
      onPrint={vi.fn()}
      onShowGuests={vi.fn()}
      onShowTemplates={vi.fn()}
      onShowAdmin={vi.fn()}
      onLogout={vi.fn()}
      savedLayouts={[]}
      onLoadSavedLayout={vi.fn()}
      onDeleteSavedLayout={vi.fn()}
      mobileMenuOpen={false}
      setMobileMenuOpen={vi.fn()}
      onSaveMasterLayout={vi.fn()}
      onClearMasterLayout={vi.fn()}
      selectedVenueCategories={[]}
      onChangeVenueCategories={vi.fn()}
      userName="Admin"
      isAdmin
      {...overrides}
    />
  );
}

describe('Header venue category filter', () => {
  it('opens filter menu and sends selected category', async () => {
    const user = userEvent.setup();
    const onChangeVenueCategories = vi.fn();
    renderHeader({ onChangeVenueCategories });

    await user.click(screen.getByTitle('Filter venues by category'));
    await user.click(screen.getByRole('button', { name: /Reception/i }));

    expect(onChangeVenueCategories).toHaveBeenCalledWith(['reception']);
  });

  it('clears selected categories', async () => {
    const user = userEvent.setup();
    const onChangeVenueCategories = vi.fn();

    renderHeader({
      selectedVenueCategories: ['reception', 'lodging'],
      onChangeVenueCategories,
    });

    await user.click(screen.getByTitle('Filter venues by category'));
    await user.click(screen.getByRole('button', { name: /Clear all/i }));

    expect(onChangeVenueCategories).toHaveBeenCalledWith([]);
  });
});
