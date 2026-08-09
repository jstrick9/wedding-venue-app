import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OperationsSettingsManagement } from './OperationsSettingsManagement';

describe('OperationsSettingsManagement (#147)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const dummyProps: any = {
    config: { primaryColor: '#4A1942' },
    onShowSuccess: vi.fn(),
  };

  it('renders default checklist items and allows adding a new checklist item', () => {
    render(<OperationsSettingsManagement {...dummyProps} />);

    // Check default checklist item exists
    expect(
      screen.getByText(/confirm floor plan approval and final guest count/i)
    ).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/e.g., verify bridal suite/i);
    const saveBtn = screen.getByRole('button', { name: /save checklist item/i });

    fireEvent.change(textarea, {
      target: { value: 'Inspect outdoor arbor floral arrangements' },
    });
    fireEvent.click(saveBtn);

    expect(
      screen.getByText('Inspect outdoor arbor floral arrangements')
    ).toBeInTheDocument();
  });

  it('switches to operational zones tab and allows adding a new zone', () => {
    render(<OperationsSettingsManagement {...dummyProps} />);

    const zonesTab = screen.getByRole('button', {
      name: /standard operational zones/i,
    });
    fireEvent.click(zonesTab);

    expect(screen.getByText(/main manor & great hall/i)).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/e.g., east lawn pavilion/i);
    const descInput = screen.getByPlaceholderText(/describe standard setup/i);
    const saveBtn = screen.getByRole('button', { name: /save operational zone/i });

    fireEvent.change(nameInput, { target: { value: 'Lakeside Patio' } });
    fireEvent.change(descInput, { target: { value: 'Cocktail hour tables & bar' } });
    fireEvent.click(saveBtn);

    expect(screen.getByText(/lakeside patio/i)).toBeInTheDocument();
    expect(screen.getByText(/cocktail hour tables & bar/i)).toBeInTheDocument();
  });
});
