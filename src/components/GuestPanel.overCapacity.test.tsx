import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GuestPanel } from './GuestPanel';
import { STORAGE_KEYS } from '../constants/storageKeys';

const tableSpecs = [
  { id: 'round-8', name: 'Round 8', capacity: 8, shape: 'circle' },
];

function renderPanel({ guests, tables }: { guests: any[]; tables: any[] }) {
  return render(
    <GuestPanel
      guests={guests}
      tables={tables as any}
      fixtures={[]}
      venue={{ id: 'v1', name: 'Hall', capacity: 100 } as any}
      eventName="Wedding"
      venueName="Hall"
      onAddGuest={vi.fn() as any}
      onUpdateGuest={vi.fn() as any}
      onRemoveGuest={vi.fn() as any}
      onAssignToTable={vi.fn() as any}
      onAssignToRoom={vi.fn() as any}
      onImportCSV={vi.fn() as any}
      onExportCSV={vi.fn() as any}
      onClose={() => {}}
    />,
  );
}

describe('GuestPanel over-capacity detection', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.TABLE_SPECS, JSON.stringify(tableSpecs));
  });

  it('flags a table as over capacity', () => {
    const guests = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
      id: `g${n}`,
      name: `Guest ${n}`,
      tableId: 't1',
    }));
    const tables = [{ id: 't1', label: 'Table 1', specId: 'round-8', guests: ['g1','g2','g3','g4','g5','g6','g7','g8','g9'] }];

    renderPanel({ guests, tables });

    // Switch to the assignments tab.
    fireEvent.click(screen.getByText('Tables'));

    expect(screen.getByText('⚠️ Over capacity by 1')).toBeTruthy();
    expect(screen.getByText('9/8')).toBeTruthy();
  });
});
