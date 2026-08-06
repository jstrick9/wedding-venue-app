import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useConfirm } from './useConfirm';

function Harness({ onYes = () => {}, onNo = () => {} }: { onYes?: (v: boolean) => void; onNo?: () => void }) {
  const { confirm, confirmDialog } = useConfirm();
  const ask = async () => {
    const ok = await confirm({ title: 'Delete?', message: 'Permanently remove?', tone: 'danger', confirmLabel: 'Delete' });
    if (ok) onYes(true);
    else onNo();
  };
  return (
    <div>
      <button onClick={() => void ask()}>Ask</button>
      {confirmDialog}
    </div>
  );
}

describe('useConfirm', () => {
  it('renders the shared ConfirmDialog and resolves true on confirm', async () => {
    const onYes = vi.fn();
    render(<Harness onYes={onYes} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Permanently remove?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await act(async () => { await Promise.resolve(); });
    expect(onYes).toHaveBeenCalledWith(true);
    // Dialog closes after resolving.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('resolves false when cancelled', async () => {
    const onNo = vi.fn();
    render(<Harness onNo={onNo} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => { await Promise.resolve(); });
    expect(onNo).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
