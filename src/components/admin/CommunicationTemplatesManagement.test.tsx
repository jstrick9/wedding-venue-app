import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommunicationTemplatesManagement } from './CommunicationTemplatesManagement';
import { STORAGE_KEYS } from '../../constants/storageKeys';

describe('CommunicationTemplatesManagement (#147)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const dummyProps: any = {
    config: { primaryColor: '#4A1942' },
    showSuccess: vi.fn(),
  };

  it('renders configured Quick Reply templates and allows adding a new template', () => {
    render(<CommunicationTemplatesManagement {...dummyProps} />);

    // Check default templates are shown
    expect(screen.getByText(/✨ layout approved/i)).toBeInTheDocument();
    expect(screen.getByText(/⏱️ timeline check-in/i)).toBeInTheDocument();

    // Add new template
    const labelInput = screen.getByPlaceholderText(/e.g., ✨ Floor Plan Approved/i);
    const bodyInput = screen.getByPlaceholderText(/write the response wording/i);
    const saveBtn = screen.getByRole('button', { name: /save template/i });

    fireEvent.change(labelInput, { target: { value: '🍷 Alcohol Selection' } });
    fireEvent.change(bodyInput, {
      target: { value: 'Please confirm your bar package and wine preferences.' },
    });
    fireEvent.click(saveBtn);

    expect(screen.getByText('🍷 Alcohol Selection')).toBeInTheDocument();
    expect(
      screen.getByText('Please confirm your bar package and wine preferences.')
    ).toBeInTheDocument();
  });

  it('switches to email invite wording tab and supports merge tag copying', () => {
    render(<CommunicationTemplatesManagement {...dummyProps} />);

    const emailTab = screen.getByRole('button', {
      name: /email invite wording/i,
    });
    fireEvent.click(emailTab);

    expect(
      screen.getByText(/couples portal email invitation wording/i)
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('You are invited to {coupleName}’s Wedding Portal at {venueName}')
    ).toBeInTheDocument();

    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: mockWriteText } });
    const copyTagBtn = screen.getByText('{coupleName}').closest('button')!;
    fireEvent.click(copyTagBtn);

    expect(mockWriteText).toHaveBeenCalledWith('{coupleName}');
  });
});
