import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalProvider, useModals } from './ModalContext';
import { openConfirmDialog, closeConfirmDialog, isConfirmDialogOpen } from '../utils/modalEscape';

function Harness() {
  const { modals, open, close } = useModals();
  return (
    <div>
      <button onClick={() => open('vendors')}>Open vendors</button>
      <button onClick={() => open('timeline')}>Open timeline</button>
      <button onClick={() => close('vendors')}>Close vendors</button>
      <div data-testid="vendors-open">{String(modals.vendors)}</div>
      <div data-testid="timeline-open">{String(modals.timeline)}</div>
    </div>
  );
}

function renderHarness() {
  return render(
    <ModalProvider>
      <Harness />
    </ModalProvider>,
  );
}

describe('ModalContext Escape handling', () => {
  it('opens a modal and Escape closes it', () => {
    renderHarness();
    fireEvent.click(screen.getByText('Open vendors'));
    expect(screen.getByTestId('vendors-open').textContent).toBe('true');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('vendors-open').textContent).toBe('false');
  });

  it('does not close modals while a confirm dialog is open', () => {
    openConfirmDialog();
    try {
      renderHarness();
      fireEvent.click(screen.getByText('Open timeline'));
      expect(screen.getByTestId('timeline-open').textContent).toBe('true');

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.getByTestId('timeline-open').textContent).toBe('true');
    } finally {
      closeConfirmDialog();
      expect(isConfirmDialogOpen()).toBe(false);
    }
  });
});
